"use client";
import Link from "next/link";
import { categoryOptions } from "@/lib/categoryTree";
import { useActionState, useEffect, useRef, useState } from "react";
import { ClipboardPaste, Loader2, Plus, ScanBarcode, X } from "lucide-react";
import { compressImage } from "@/lib/imageCompress";
import { BarcodeScanner } from "./BarcodeScanner";
import { DuplicateHint } from "./DuplicateHint";
import { useHidScanner } from "@/lib/hidScanner";
import { createClient } from "@/lib/supabase/client";
import { fetchRemoteImage, saveProduct, type ActionState } from "@/app/admin/actions";
import type { Category, Product } from "@/lib/types";
import { ProductImage } from "@/components/shop/ProductImage";
import { calcMargin, marginTone, pctTR } from "@/lib/margin";
import { formatTL } from "@/lib/format";

const num = (v: string) => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
};

export function ProductForm({
  product,
  categories,
  initialBarcode,
  initial,
  cost,
  returnTo,
}: {
  product?: Product;
  categories: Category[];
  initialBarcode?: string;
  /** Fotoğraftan tanıma gibi yerlerden gelen ön doldurma (yalnızca yeni üründe) */
  initial?: { name?: string; unit_label?: string; category_id?: string; image_url?: string };
  cost?: number | null;
  /** Kaydet / Vazgeç sonrası dönülecek liste adresi (filtreler korunur) */
  returnTo?: string;
}) {
  const [priceS, setPriceS] = useState(product?.price != null ? String(product.price) : "");
  const [saleS, setSaleS] = useState(product?.sale_price != null ? String(product.sale_price) : "");
  const [costS, setCostS] = useState(cost != null ? String(cost) : "");
  const mNormal = calcMargin(num(priceS), num(costS));
  const mSale = num(saleS) != null ? calcMargin(num(saleS), num(costS)) : null;
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProduct, {});
  // Görseller: ilk = ana (vitrin) görsel, diğerleri ek görseller
  const [images, setImages] = useState<string[]>(() =>
    [product?.image_url ?? initial?.image_url ?? "", ...(product?.extra_images ?? [])].filter(Boolean).slice(0, 11),
  );
  const imageUrl = images[0] ?? "";
  const [active, setActive] = useState(0);
  const addImage = (url: string) => setImages((list) => (list.includes(url) || list.length >= 11 ? list : [...list, url]));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState(product?.barcode ?? initialBarcode ?? "");
  const [nameS, setNameS] = useState(product?.name ?? initial?.name ?? "");
  const [scanning, setScanning] = useState(false);
  // El barkod okuyucu: form neredeyse okutulan barkod Barkod alanına yazılır (Enter formu göndermez)
  useHidScanner((code) => {
    setBarcode(code);
    return true;
  });

  async function upload(file: Blob) {
    setUploadError(null);
    if (!file.type.startsWith("image/")) return setUploadError("Bu bir görsel değil.");
    setUploading(true);
    const img = await compressImage(file);
    if (img.size > 3 * 1024 * 1024) {
      setUploading(false);
      return setUploadError("Görsel en fazla 3 MB olmalı.");
    }
    const ext = img.type === "image/webp" ? "webp" : img.type === "image/png" ? "png" : "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("product-images").upload(path, img, { cacheControl: "31536000", contentType: img.type });
    if (error) setUploadError("Yükleme başarısız: " + error.message);
    else addImage(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
    setUploading(false);
  }

  /** Kopyalanan görsel bağlantısını (Google görseller → "Resim adresini kopyala") indirip yükler */
  async function uploadFromUrl(url: string) {
    setUploadError(null);
    if (url.startsWith("data:image/")) {
      const blob = await (await fetch(url)).blob();
      return upload(blob);
    }
    setUploading(true);
    const r = await fetchRemoteImage(url);
    setUploading(false);
    if (!r.ok) return setUploadError(r.error);
    const bin = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
    await upload(new Blob([bin], { type: r.type }));
  }
  const uploadRef = useRef({ upload, uploadFromUrl });
  useEffect(() => {
    uploadRef.current = { upload, uploadFromUrl };
  });

  // Ctrl+V / Cmd+V: panodaki görsel (veya görsel bağlantısı) sayfanın her yerinde yapıştırılabilir
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData;
      if (!dt) return;
      const file = Array.from(dt.items).find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
      if (file) {
        e.preventDefault();
        void uploadRef.current.upload(file);
        return;
      }
      const t = e.target as HTMLElement | null;
      const inText = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
      const text = dt.getData("text/plain").trim();
      const html = dt.getData("text/html");
      const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const url = src && /^(https?:|data:image\/)/.test(src) ? src : /^(https?:\/\/\S+|data:image\/\S+)$/i.test(text) ? text : null;
      if (url && (!inText || (t as HTMLElement).dataset.imagePaste === "1" || src)) {
        e.preventDefault();
        void uploadRef.current.uploadFromUrl(url);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function pasteFromClipboard() {
    setUploadError(null);
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith("image/"));
        if (type) return upload(await it.getType(type));
      }
      for (const it of items) {
        if (it.types.includes("text/plain")) {
          const txt = (await (await it.getType("text/plain")).text()).trim();
          if (/^(https?:|data:image\/)/i.test(txt)) return uploadFromUrl(txt);
        }
      }
      setUploadError("Panoda görsel yok. Google'da görsele sağ tıklayıp 'Resmi kopyala' deyin.");
    } catch {
      setUploadError("Pano okunamadı. Ctrl+V (Mac: ⌘+V) ile yapıştırmayı deneyin.");
    }
  }

  return (
    <form action={action} className="space-y-4">
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      {scanning && (
        <BarcodeScanner
          onResult={(code) => {
            setBarcode(code);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="image_url" value={imageUrl} />
      <input type="hidden" name="extra_images" value={JSON.stringify(images.slice(1))} />

      <section className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-4 ring-1 ring-line sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="space-y-2">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
              if (f) void upload(f);
              else {
                const u = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
                if (u) void uploadFromUrl(u.split("\n")[0].trim());
              }
            }}
            className="relative"
            title="Görseli buraya sürükleyebilir veya Ctrl+V ile yapıştırabilirsin"
          >
            <ProductImage src={images[Math.min(active, images.length - 1)] || null} emoji={product?.emoji ?? null} alt="Ürün görseli" />
            {uploading && (
              <span className="absolute inset-0 grid place-items-center rounded-2xl bg-white/70">
                <Loader2 className="animate-spin text-brand" />
              </span>
            )}
          </div>
          {/* Görsel şeridi: ana görsel ★, tıkla → büyük önizleme, "Ana yap", ✕ sil; + ile çoklu ekle */}
          <div className="grid grid-cols-4 gap-1.5">
            {images.map((u, i) => (
              <div key={u} className={`group relative aspect-square overflow-hidden rounded-lg bg-white ring-2 ${i === Math.min(active, images.length - 1) ? "ring-brand" : "ring-line"}`}>
                <button type="button" onClick={() => setActive(i)} className="h-full w-full" title={i === 0 ? "Ana görsel" : "Önizle"}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-contain p-0.5" />
                </button>
                {i === 0 ? (
                  <span className="absolute left-0.5 top-0.5 rounded bg-brand px-1 text-[9px] font-black text-white">ANA</span>
                ) : (
                  <button
                    type="button"
                    title="Ana görsel yap"
                    onClick={() => {
                      setImages((l) => [u, ...l.filter((x) => x !== u)]);
                      setActive(0);
                    }}
                    className="absolute bottom-0.5 left-0.5 rounded bg-white/90 px-1 text-[9px] font-black text-brand opacity-0 shadow group-hover:opacity-100"
                  >
                    ★ Ana
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Görseli kaldır"
                  onClick={() => {
                    setImages((l) => l.filter((x) => x !== u));
                    setActive(0);
                  }}
                  className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-white/90 text-muted shadow hover:text-brand"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            {images.length < 11 && (
              <label
                title="Görsel ekle (birden fazla seçebilirsin)"
                className="grid aspect-square cursor-pointer place-items-center rounded-lg border-2 border-dashed border-brand/50 bg-brand-soft/40 text-brand hover:bg-brand-soft"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} strokeWidth={3} />}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, 11 - images.length);
                    e.target.value = "";
                    for (const f of files) await upload(f);
                  }}
                />
              </label>
            )}
          </div>
          <p className="text-[11px] text-muted">{images.length ? `${images.length} görsel · ilk görsel vitrinde görünür` : "Görsel yok"}</p>
          <button type="button" onClick={() => void pasteFromClipboard()} disabled={uploading} className="btn-ghost w-full py-2 text-sm">
            <ClipboardPaste size={16} /> Panodan yapıştır
          </button>
          <input
            data-image-paste="1"
            placeholder="veya görsel bağlantısı yapıştır"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = (e.target as HTMLInputElement).value.trim();
                if (v) void uploadFromUrl(v).then(() => ((e.target as HTMLInputElement).value = ""));
              }
            }}
            className="w-full rounded-lg border border-dashed border-line px-2 py-1.5 text-xs"
          />
          <p className="text-[11px] leading-snug text-muted">İpucu: Google Görseller&apos;de resme sağ tıkla → <b>Resmi kopyala</b>, sonra bu sayfada <b>Ctrl+V</b>.</p>
          {images.length > 1 && (
            <button type="button" onClick={() => setImages([])} className="flex w-full items-center justify-center gap-1 text-xs font-semibold text-muted hover:text-brand">
              <X size={14} /> Tüm görselleri kaldır
            </button>
          )}
          {uploadError && <p className="text-xs font-semibold text-brand">{uploadError}</p>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <F label="Ürün adı *" className="sm:col-span-2"><input name="name" required value={nameS} onChange={(e) => setNameS(e.target.value)} className="input" /></F>
          <F label="Kategori">
            <select name="category_id" defaultValue={product?.category_id ?? initial?.category_id ?? ""} className="input">
              <option value="">— Seçin —</option>
              {categoryOptions(categories).map((o) => <option key={o.id} value={o.id}>{o.depth ? `  ↳ ${o.label}` : o.label}</option>)}
            </select>
          </F>
          <F label="Birim (ör. 1 kg, 500 g, 1 L)"><input name="unit_label" defaultValue={product?.unit_label ?? initial?.unit_label ?? ""} className="input" /></F>
          <F label="Emoji (görsel yoksa)"><input name="emoji" defaultValue={product?.emoji ?? ""} maxLength={4} className="input" /></F>
          <F label="Bağlantı adı (slug)"><input name="slug" defaultValue={product?.slug ?? ""} placeholder="Boşsa addan üretilir" className="input" /></F>
          <F label="Barkod" className="sm:col-span-2">
            <div className="flex gap-2">
              <input name="barcode" data-barcode="1" value={barcode} onChange={(e) => setBarcode(e.target.value)} inputMode="numeric" placeholder="Ör. 8690504012345" className="input font-mono" />
              <button type="button" onClick={() => setScanning(true)} className="btn-ghost shrink-0 px-3" aria-label="Kamerayla barkod okut">
                <ScanBarcode size={20} /> Okut
              </button>
            </div>
          </F>
          <DuplicateHint id={product?.id} barcode={barcode} name={nameS} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:grid-cols-3">
        <F label="Alış fiyatı (₺)">
          <input name="cost_price" inputMode="decimal" value={costS} onChange={(e) => setCostS(e.target.value)} placeholder="KDV dahil maliyet" className="input" />
        </F>
        <F label="Satış fiyatı (₺) *"><input name="price" required inputMode="decimal" value={priceS} onChange={(e) => setPriceS(e.target.value)} className="input" /></F>
        <F label="İndirimli fiyat (₺)"><input name="sale_price" inputMode="decimal" value={saleS} onChange={(e) => setSaleS(e.target.value)} placeholder="Boş = indirim yok" className="input" /></F>
        <div className="rounded-xl bg-bg p-3 text-sm sm:col-span-3">
          {mNormal ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>
                Kâr: <b className={marginTone(mNormal)}>{formatTL(mNormal.profit)}</b>
              </span>
              <span>
                Kâr marjı: <b className={marginTone(mNormal)}>{pctTR(mNormal.marginPct)}</b> <span className="text-xs text-muted">(satışa göre)</span>
              </span>
              {mNormal.markupPct != null && (
                <span>
                  Kâr oranı: <b>{pctTR(mNormal.markupPct)}</b> <span className="text-xs text-muted">(alışa göre)</span>
                </span>
              )}
              {mSale && (
                <span className="w-full">
                  İndirimli satışta: kâr <b className={marginTone(mSale)}>{formatTL(mSale.profit)}</b>, marj <b className={marginTone(mSale)}>{pctTR(mSale.marginPct)}</b>
                  {mSale.profit < 0 && <b className="ml-2 text-red-600">⚠️ Zararına satış!</b>}
                </span>
              )}
              {mNormal.profit < 0 && <b className="w-full text-red-600">⚠️ Satış fiyatı alış fiyatının altında.</b>}
            </div>
          ) : (
            <span className="text-muted">Alış ve satış fiyatını girince kâr ve marj burada hesaplanır. Alış fiyatı yalnızca yönetim panelinde görünür.</span>
          )}
        </div>
        <F label="Sıralama"><input name="sort_order" type="number" defaultValue={product?.sort_order ?? 0} className="input" /></F>
        <F label="Stok *"><input name="stock" type="number" min={0} required defaultValue={product?.stock ?? 0} className="input" /></F>
        <F label="Kritik stok uyarısı"><input name="critical_stock" type="number" min={0} defaultValue={product?.critical_stock ?? 5} className="input" /></F>
        <F label="Sipariş başına en fazla"><input name="max_per_order" type="number" min={1} defaultValue={product?.max_per_order ?? 20} className="input" /></F>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <F label="Açıklama"><textarea name="description" defaultValue={product?.description ?? ""} className="input min-h-24" /></F>
        <div className="flex flex-wrap gap-5 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} className="h-4 w-4 accent-brand" /> Satışta</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="is_featured" defaultChecked={product?.is_featured ?? false} className="h-4 w-4 accent-brand" /> Çok satanlarda göster</label>
        </div>
      </section>

      {state.error && <p className="rounded-lg bg-brand-soft p-3 text-sm font-semibold text-brand">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending || uploading} className="btn-primary">{pending && <Loader2 size={16} className="animate-spin" />} Kaydet</button>
        <Link href={returnTo ?? "/admin/urunler"} className="btn-ghost">Vazgeç</Link>
      </div>
    </form>
  );
}

function F({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
