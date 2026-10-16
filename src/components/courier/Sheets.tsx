"use client";
import { useRef, useState } from "react";
import { Banknote, Camera, CreditCard, ImagePlus, Loader2, Split, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageCompress";
import { ISSUE_REASONS } from "@/lib/courierShared";
import { tl, type CourierOrder } from "./types";

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button onClick={onClose} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full bg-bg">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const parse = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};

type Receipt = { key: string; file: File; preview: string; amountS: string; path?: string };
export type ReceiptOut = { path: string; amount: number | null };
type Mode = "nakit" | "pos" | "parcali";

/** Teslim: nakit / POS / parçalı tahsilat, POS fişi fotoğrafları, para üstü ve tutar tutarlılığı */
export function DeliverSheet({
  o,
  busy,
  courierId,
  onClose,
  onConfirm,
}: {
  o: CourierOrder;
  busy: boolean;
  courierId: string;
  onClose: () => void;
  onConfirm: (cash: number, pos: number, note: string, receipts: ReceiptOut[]) => void;
}) {
  const [mode, setMode] = useState<Mode>(o.payment_method === "kapida_pos" ? "pos" : "nakit");
  const totalS = String(o.total).replace(".", ",");
  const [cashS, setCashS] = useState(totalS);
  const [posS, setPosS] = useState(totalS);
  const [posTouched, setPosTouched] = useState(false);
  const [givenS, setGivenS] = useState("");
  const [note, setNote] = useState("");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const cash = mode === "pos" ? 0 : (parse(cashS) ?? NaN);
  const pos = mode === "nakit" ? 0 : (parse(posS) ?? NaN);
  const got = r2((Number.isFinite(cash) ? cash : 0) + (Number.isFinite(pos) ? pos : 0));
  const valid = Number.isFinite(cash) && Number.isFinite(pos) && cash >= 0 && pos >= 0 && got > 0;
  const diff = valid && Math.abs(got - o.total) >= 0.01;
  const needReceipt = pos > 0;
  // Fiş tutarları: tek fişte boş bırakılabilir (POS tutarının tamamı sayılır); birden fazlaysa her biri girilmeli ve toplamı POS'a eşit olmalı
  const amounts = receipts.map((r) => parse(r.amountS));
  const multi = receipts.length > 1;
  const receiptSum = r2(amounts.reduce<number>((a, x) => a + (x ?? 0), 0));
  const receiptsOk =
    !needReceipt ||
    (receipts.length > 0 &&
      (multi ? amounts.every((x) => x != null && x > 0) && Math.abs(receiptSum - pos) < 0.01 : amounts[0] == null || Math.abs((amounts[0] ?? 0) - pos) < 0.01));
  const given = parse(givenS);
  const change = given != null && Number.isFinite(cash) && cash > 0 ? r2(given - cash) : null;
  const notes = [50, 100, 200, 500, 1000]
    .map((b) => Math.ceil((Number.isFinite(cash) ? cash : o.total) / b) * b)
    .filter((v, i, a) => v > (Number.isFinite(cash) ? cash : o.total) && a.indexOf(v) === i)
    .slice(0, 4);

  function pickMode(m: Mode) {
    setMode(m);
    setErr(null);
    if (m === "parcali") {
      setCashS("");
      setPosS(totalS);
      setPosTouched(false);
    } else {
      setCashS(totalS);
      setPosS(totalS);
    }
  }
  function onCash(v: string) {
    setCashS(v);
    if (mode === "parcali" && !posTouched) {
      const c = parse(v);
      setPosS(c == null ? totalS : String(Math.max(0, r2(o.total - c))).replace(".", ","));
    }
  }
  function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    setReceipts((rs) => [...rs, ...files.map((file) => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), amountS: "" }))].slice(0, 10));
  }
  function removeReceipt(key: string) {
    setReceipts((rs) => {
      const r = rs.find((x) => x.key === key);
      if (r) URL.revokeObjectURL(r.preview);
      return rs.filter((x) => x.key !== key);
    });
  }

  async function confirm() {
    if (!valid) return;
    setErr(null);
    let out: ReceiptOut[] = [];
    if (needReceipt) {
      setUploading(true);
      try {
        const sb = createClient();
        const done: Receipt[] = [];
        for (const r of receipts) {
          if (r.path) {
            done.push(r);
            continue;
          }
          const img = await compressImage(r.file, 1600, 0.82);
          const ext = img.type === "image/webp" ? "webp" : img.type === "image/png" ? "png" : "jpg";
          const path = `${courierId}/${o.id}/${crypto.randomUUID()}.${ext}`;
          const { error } = await sb.storage.from("pos-receipts").upload(path, img, { contentType: img.type, upsert: false });
          if (error) throw new Error(error.message);
          done.push({ ...r, path });
        }
        setReceipts(done);
        out = done.map((r, i) => ({ path: r.path!, amount: multi ? amounts[i] : (amounts[0] ?? pos) }));
      } catch (e) {
        setErr("Fiş görseli yüklenemedi: " + (e instanceof Error ? e.message : "bağlantı hatası") + ". Tekrar dene.");
        return;
      } finally {
        setUploading(false);
      }
    }
    onConfirm(Number.isFinite(cash) ? cash : 0, Number.isFinite(pos) ? pos : 0, note.trim(), out);
  }

  const working = busy || uploading;
  const blockReason = !valid
    ? "Tutar gir."
    : needReceipt && receipts.length === 0
      ? "POS fişinin fotoğrafını ekle."
      : !receiptsOk
        ? multi
          ? "Her fişin tutarını gir; toplamı POS tutarına eşit olmalı."
          : "Fiş tutarı POS tutarıyla aynı olmalı."
        : diff && note.trim().length < 3
          ? "Tahsilat sipariş tutarından farklı — nedenini not olarak yaz."
          : null;

  return (
    <Sheet title={`Teslim · #${o.order_no}`} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        Sipariş tutarı <b className="text-ink">{tl(o.total)}</b> · müşteri {o.payment_method === "kapida_pos" ? "POS" : "nakit"} seçmişti
      </p>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {(
          [
            ["nakit", "Nakit", Banknote, "bg-emerald-600 ring-emerald-600"],
            ["pos", "Kart (POS)", CreditCard, "bg-violet-600 ring-violet-600"],
            ["parcali", "Parçalı", Split, "bg-amber-500 ring-amber-500"],
          ] as const
        ).map(([m, label, Icon, on]) => (
          <button
            key={m}
            type="button"
            onClick={() => pickMode(m)}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-sm font-black ring-2 ${mode === m ? `${on} text-white` : "bg-white ring-line"}`}
          >
            <Icon size={20} /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {mode !== "pos" && (
          <label className="block text-sm font-bold">
            {mode === "parcali" ? "Nakit alınan (₺)" : "Tahsil edilen nakit (₺)"}
            <input value={cashS} onChange={(e) => onCash(e.target.value)} inputMode="decimal" placeholder="0" className="input mt-1 text-lg font-black tabular-nums" />
          </label>
        )}
        {mode !== "nakit" && (
          <label className="block text-sm font-bold">
            {mode === "parcali" ? "POS ile çekilen (₺)" : "POS ile çekilen tutar (₺)"}
            <input
              value={posS}
              onChange={(e) => {
                setPosS(e.target.value);
                setPosTouched(true);
              }}
              inputMode="decimal"
              className="input mt-1 text-lg font-black tabular-nums"
            />
            {mode === "parcali" && !posTouched && <span className="text-xs font-normal text-muted">Kalan tutar otomatik hesaplanır; farklıysa düzelt.</span>}
          </label>
        )}
      </div>

      {/* Tutarlılık özeti */}
      <div className={`mt-3 rounded-2xl p-3 text-sm ${diff ? "bg-amber-50 ring-1 ring-amber-200" : "bg-bg"}`}>
        <div className="flex justify-between">
          <span>Nakit</span>
          <b className="tabular-nums">{tl(Number.isFinite(cash) ? cash : 0)}</b>
        </div>
        <div className="flex justify-between">
          <span>POS</span>
          <b className="tabular-nums">{tl(Number.isFinite(pos) ? pos : 0)}</b>
        </div>
        <div className="mt-1 flex justify-between border-t border-line pt-1">
          <span className="font-bold">Toplam tahsilat</span>
          <b className="tabular-nums">{tl(got)}</b>
        </div>
        <p className={`mt-1 text-xs font-bold ${diff ? "text-amber-700" : "text-emerald-700"}`}>
          {!valid ? "Tutarları gir." : diff ? `Sipariş tutarından ${got > o.total ? "fazla" : "eksik"}: ${tl(Math.abs(r2(got - o.total)))} — yöneticiye bildirilecek` : "✓ Sipariş tutarıyla eşleşiyor"}
        </p>
      </div>

      {/* Nakit para üstü */}
      {mode !== "pos" && Number.isFinite(cash) && cash > 0 && (
        <div className="mt-3 rounded-2xl bg-bg p-3">
          <p className="mb-1.5 text-sm font-bold">Para üstü (nakit kısım {tl(cash)})</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {notes.map((n) => (
              <button key={n} type="button" onClick={() => setGivenS(String(n))} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold ring-1 ring-line">
                {tl(n)}
              </button>
            ))}
          </div>
          <input value={givenS} onChange={(e) => setGivenS(e.target.value)} inputMode="decimal" placeholder="Müşterinin verdiği para" className="input" />
          {change != null && (
            <p className={`mt-2 text-center text-lg font-black ${change < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {change < 0 ? `Eksik: ${tl(-change)}` : `Para üstü: ${tl(change)}`}
            </p>
          )}
        </div>
      )}

      {/* POS fişleri */}
      {needReceipt && (
        <div className="mt-3 rounded-2xl bg-violet-50 p-3 ring-1 ring-violet-200">
          <p className="text-sm font-bold text-violet-900">🧾 POS fişi fotoğrafı (zorunlu)</p>
          <p className="mb-2 text-xs text-violet-900/70">Parçalı çekimlerde her fişi ayrı ekle ve tutarını yaz.</p>
          <div className="grid grid-cols-3 gap-2">
            {receipts.map((r, i) => (
              <div key={r.key} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.preview} alt={`POS fişi ${i + 1}`} className="aspect-[3/4] w-full rounded-xl bg-white object-cover ring-1 ring-violet-200" />
                <button type="button" onClick={() => removeReceipt(r.key)} aria-label="Kaldır" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 shadow">
                  <X size={13} />
                </button>
                <input
                  value={r.amountS}
                  onChange={(e) => setReceipts((rs) => rs.map((x) => (x.key === r.key ? { ...x, amountS: e.target.value } : x)))}
                  inputMode="decimal"
                  placeholder={multi ? "Tutar" : tl(Number.isFinite(pos) ? pos : 0)}
                  className="input mt-1 px-2 py-1.5 text-center text-sm font-bold tabular-nums"
                />
              </div>
            ))}
            {receipts.length < 10 && (
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => camRef.current?.click()} className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-violet-600 py-3 text-xs font-black text-white">
                  <Camera size={22} /> Fiş çek
                </button>
                <button type="button" onClick={() => galRef.current?.click()} className="flex items-center justify-center gap-1 rounded-xl bg-white py-2 text-xs font-bold ring-1 ring-violet-200">
                  <ImagePlus size={14} /> Galeri
                </button>
              </div>
            )}
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {receipts.length > 0 && (
            <p className={`mt-2 text-xs font-bold ${receiptsOk ? "text-emerald-700" : "text-red-600"}`}>
              {multi
                ? `Fiş toplamı ${tl(receiptSum)} / POS ${tl(Number.isFinite(pos) ? pos : 0)} ${receiptsOk ? "✓" : "— eşit değil"}`
                : receiptsOk
                  ? "✓ Fiş eklendi"
                  : "Fiş tutarı POS tutarıyla aynı olmalı"}
            </p>
          )}
        </div>
      )}

      <label className="mt-4 block text-sm font-bold">
        Not {diff ? "(zorunlu)" : "(isteğe bağlı)"}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ör. 5 TL eksik verdi, kapıya bırakıldı" className="input mt-1" />
      </label>

      {err && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm font-semibold text-red-700">{err}</p>}
      <button
        type="button"
        disabled={working || !!blockReason}
        onClick={() => void confirm()}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white disabled:opacity-50"
      >
        {working && <Loader2 size={18} className="animate-spin" />}
        {uploading ? "Fişler yükleniyor…" : `Teslimi onayla · ${tl(got)}`}
      </button>
      {blockReason && <p className="mt-2 text-center text-xs font-semibold text-muted">{blockReason}</p>}
    </Sheet>
  );
}

/** Teslim edilemedi: neden seç + not */
export function IssueSheet({ o, busy, onClose, onConfirm }: { o: CourierOrder; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const reason = [pick, note.trim()].filter(Boolean).join(" — ");
  return (
    <Sheet title={`Sorun bildir · #${o.order_no}`} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Sipariş açık kalır; yönetici bilgilendirilir ve ne yapılacağına karar verir.</p>
      <div className="space-y-2">
        {ISSUE_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setPick(r)} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold ring-2 ${pick === r ? "bg-red-50 text-red-700 ring-red-400" : "ring-line"}`}>
            {r}
          </button>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Açıklama (isteğe bağlı)" className="input mt-3" />
      <button
        type="button"
        disabled={busy || reason.length < 3}
        onClick={() => onConfirm(reason)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 font-black text-white disabled:opacity-50"
      >
        {busy && <Loader2 size={18} className="animate-spin" />} Yöneticiye bildir
      </button>
    </Sheet>
  );
}
