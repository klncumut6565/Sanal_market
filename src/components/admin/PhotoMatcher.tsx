"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, ImagePlus, Loader2, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { compressImage } from "@/lib/imageCompress";
import { uploadImageBlob } from "@/lib/imageUpload";
import { formatTL } from "@/lib/format";
import { ProductImage } from "@/components/shop/ProductImage";
import { attachProductImage, identifyPhoto, searchForPhoto } from "@/app/admin/urunler/foto/actions";
import type { Candidate, VisionGuess } from "@/lib/productVision";

type Item = {
  key: string;
  file: File;
  preview: string;
  status: "bekliyor" | "taniniyor" | "hazir" | "hata" | "kaydedildi";
  error?: string;
  guess?: VisionGuess;
  categoryId?: string | null;
  candidates?: Candidate[];
  savedName?: string;
};

const CONF: Record<VisionGuess["confidence"], string> = { yuksek: "Net okundu", orta: "Kısmen okundu", dusuk: "Belirsiz" };

async function toBase64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function PhotoMatcher() {
  const [items, setItems] = useState<Item[]>([]);
  const running = useRef(false);
  const queue = useRef<Item[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Item>) => setItems((s) => s.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function analyse(it: Item) {
    patch(it.key, { status: "taniniyor", error: undefined });
    try {
      const small = await compressImage(it.file, 768, 0.8);
      const r = await identifyPhoto(await toBase64(small), small.type);
      if (r.ok) patch(it.key, { status: "hazir", guess: r.guess, categoryId: r.categoryId, candidates: r.candidates });
      else patch(it.key, { status: "hata", error: r.error });
    } catch {
      patch(it.key, { status: "hata", error: "Bağlantı hatası. Tekrar deneyin." });
    }
  }

  async function pump() {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) await analyse(queue.current.shift()!);
    running.current = false;
  }

  function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/")).slice(0, 20);
    if (!files.length) return;
    const fresh: Item[] = files.map((file) => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: "bekliyor" }));
    setItems((s) => [...fresh, ...s]);
    queue.current.push(...fresh);
    void pump();
  }

  const remove = (key: string) =>
    setItems((s) => {
      const it = s.find((x) => x.key === key);
      if (it) URL.revokeObjectURL(it.preview);
      queue.current = queue.current.filter((x) => x.key !== key);
      return s.filter((x) => x.key !== key);
    });

  const done = items.filter((i) => i.status === "kaydedildi").length;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <button type="button" onClick={() => camRef.current?.click()} className="btn-primary py-2.5">
          <Camera size={18} /> Fotoğraf çek
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost py-2.5">
          <ImagePlus size={18} /> Galeriden seç (çoklu)
        </button>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        {items.length > 0 && (
          <span className="ml-auto text-sm font-semibold text-muted">
            {done}/{items.length} görsel eklendi
          </span>
        )}
      </div>

      {items.map((it) => (
        <PhotoCard key={it.key} it={it} onPatch={(p) => patch(it.key, p)} onRemove={() => remove(it.key)} onRetry={() => { queue.current.push(it); void pump(); }} />
      ))}
    </div>
  );
}

function PhotoCard({ it, onPatch, onRemove, onRetry }: { it: Item; onPatch: (p: Partial<Item>) => void; onRemove: () => void; onRetry: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [newHref, setNewHref] = useState<string | null>(null);

  async function attach(c: Candidate) {
    if (c.image_url && !confirm(`"${c.name}" ürününün zaten görseli var. Bu fotoğrafla değiştirilsin mi?`)) return;
    setBusy(c.id);
    setErr(null);
    const up = await uploadImageBlob(it.file);
    if (!up.ok) {
      setBusy(null);
      return setErr(up.error);
    }
    const r = await attachProductImage(c.id, up.url);
    setBusy(null);
    if (!r.ok) return setErr(r.error ?? "Kaydedilemedi.");
    onPatch({ status: "kaydedildi", savedName: c.name });
  }

  async function newProduct() {
    setBusy("yeni");
    setErr(null);
    const up = await uploadImageBlob(it.file);
    setBusy(null);
    if (!up.ok) return setErr(up.error);
    const g = it.guess;
    const u = new URLSearchParams({ gorsel: up.url });
    if (g?.name) u.set("ad", g.name);
    if (g?.barcode) u.set("barkod", g.barcode);
    if (g?.size) u.set("birim", g.size);
    if (it.categoryId) u.set("kategori", it.categoryId);
    setNewHref(`/admin/urunler/yeni?${u}`);
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setFound(await searchForPhoto(q));
    setSearching(false);
  }

  const list = found ?? it.candidates ?? [];

  return (
    <div className={`card flex flex-col gap-4 p-4 sm:flex-row ${it.status === "kaydedildi" ? "ring-2 ring-emerald-400" : ""}`}>
      <div className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={it.preview} alt="Çekilen fotoğraf" className="h-40 w-40 rounded-xl bg-white object-contain ring-1 ring-black/5" />
        <button type="button" onClick={onRemove} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-white shadow ring-1 ring-black/10" aria-label="Kaldır">
          <X size={14} />
        </button>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        {(it.status === "bekliyor" || it.status === "taniniyor") && (
          <p className="flex items-center gap-2 font-semibold text-muted">
            <Loader2 size={18} className="animate-spin" /> {it.status === "bekliyor" ? "Sırada…" : "Ürün tanınıyor…"}
          </p>
        )}
        {it.status === "hata" && (
          <div className="space-y-2">
            <p className="font-semibold text-red-600">{it.error}</p>
            <button type="button" onClick={onRetry} className="btn-ghost py-2 text-sm"><RotateCcw size={16} /> Tekrar dene</button>
          </div>
        )}
        {it.status === "kaydedildi" && (
          <p className="flex items-center gap-2 font-bold text-emerald-700">
            <Check size={18} /> Görsel eklendi: {it.savedName}
          </p>
        )}

        {it.status === "hazir" && it.guess && (
          <>
            <div className="rounded-xl bg-brand-soft/60 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-black"><Sparkles size={16} className="text-brand" /> {it.guess.name}</p>
              <p className="mt-0.5 text-muted">
                {[it.guess.brand && `Marka: ${it.guess.brand}`, it.guess.size && `Gramaj: ${it.guess.size}`, it.guess.barcode && `Barkod: ${it.guess.barcode}`, it.guess.category && `Kategori: ${it.guess.category}`]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                · <span className="font-semibold">{CONF[it.guess.confidence]}</span>
              </p>
            </div>

            <p className="text-sm font-bold">{found ? "Arama sonuçları" : list.length ? "Katalogda olası eşleşmeler — doğru olanı seçin:" : "Katalogda benzer ürün bulunamadı."}</p>
            <ul className="space-y-2">
              {list.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl p-2 ring-1 ring-black/5">
                  <ProductImage src={c.image_url} emoji={c.emoji} alt={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-xs text-muted">
                      {formatTL(c.sale_price ?? c.price)}
                      {c.unit_label ? ` · ${c.unit_label}` : ""}
                      {c.barcode ? ` · ${c.barcode}` : ""}
                      {!c.is_active && " · satışta değil"}
                      {c.reason !== "Arama" && <span className="ml-1 font-semibold text-brand">({c.reason})</span>}
                    </p>
                  </div>
                  <button type="button" disabled={!!busy} onClick={() => attach(c)} className={`${c.image_url ? "btn-ghost" : "btn-primary"} shrink-0 px-3 py-2 text-sm disabled:opacity-50`}>
                    {busy === c.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {c.image_url ? "Görseli değiştir" : "Bu ürün — ekle"}
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={search} className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Doğru ürün listede yoksa: ad veya barkod ara" className="input flex-1" />
              <button type="submit" disabled={searching || q.trim().length < 2} className="btn-ghost px-3 py-2 disabled:opacity-50">
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </form>

            {newHref ? (
              <Link href={newHref} target="_blank" className="btn-primary inline-flex py-2 text-sm">
                <Plus size={16} /> Yeni ürün formunu aç (bilgiler dolu gelir)
              </Link>
            ) : (
            <button type="button" disabled={!!busy} onClick={newProduct} className="flex items-center gap-1.5 text-sm font-bold text-brand underline disabled:opacity-50">
              {busy === "yeni" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Katalogda yok — bu bilgilerle yeni ürün aç
            </button>
            )}
          </>
        )}
        {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
      </div>
    </div>
  );
}
