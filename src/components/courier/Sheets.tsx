"use client";
import { useState } from "react";
import { Banknote, CreditCard, Loader2, X } from "lucide-react";
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

/** Teslim: tahsilat yöntemi, tutar, nakitte para üstü hesabı */
export function DeliverSheet({ o, busy, onClose, onConfirm }: { o: CourierOrder; busy: boolean; onClose: () => void; onConfirm: (m: "nakit" | "pos", amount: number, note: string) => void }) {
  const [method, setMethod] = useState<"nakit" | "pos">(o.payment_method === "kapida_pos" ? "pos" : "nakit");
  const [amountS, setAmountS] = useState(String(o.total).replace(".", ","));
  const [givenS, setGivenS] = useState("");
  const [note, setNote] = useState("");
  const amount = parse(amountS);
  const given = parse(givenS);
  const change = method === "nakit" && given != null && amount != null ? Math.round((given - amount) * 100) / 100 : null;
  const diff = amount != null && Math.abs(amount - o.total) >= 0.01;
  const notes = [50, 100, 200, 500, 1000].map((b) => Math.ceil(o.total / b) * b).filter((v, i, a) => v > o.total && a.indexOf(v) === i).slice(0, 4);

  return (
    <Sheet title={`Teslim · #${o.order_no}`} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        {o.customer_name} · Sipariş tutarı <b className="text-ink">{tl(o.total)}</b>
      </p>

      <p className="mb-1.5 text-sm font-bold">Ödeme nasıl alındı?</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["nakit", "pos"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 font-black ring-2 ${
              method === m ? (m === "nakit" ? "bg-emerald-600 text-white ring-emerald-600" : "bg-violet-600 text-white ring-violet-600") : "bg-white ring-line"
            }`}
          >
            {m === "nakit" ? <Banknote size={20} /> : <CreditCard size={20} />} {m === "nakit" ? "Nakit" : "Kart (POS)"}
          </button>
        ))}
      </div>
      {method !== (o.payment_method === "kapida_pos" ? "pos" : "nakit") && (
        <p className="-mt-2 mb-3 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">Müşteri siparişte {o.payment_method === "kapida_pos" ? "POS" : "nakit"} seçmişti.</p>
      )}

      <label className="block text-sm font-bold">
        Tahsil edilen tutar (₺)
        <input value={amountS} onChange={(e) => setAmountS(e.target.value)} inputMode="decimal" className="input mt-1 text-lg font-black tabular-nums" />
      </label>
      {diff && <p className="mt-1 text-xs font-semibold text-amber-700">Sipariş tutarından farklı — yöneticiye bildirilecek. Nedenini not olarak yaz.</p>}

      {method === "nakit" && (
        <div className="mt-4 rounded-2xl bg-bg p-3">
          <p className="mb-1.5 text-sm font-bold">Para üstü hesabı</p>
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

      <label className="mt-4 block text-sm font-bold">
        Not (isteğe bağlı)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ör. kapıya bırakıldı, 5 TL eksik verdi" className="input mt-1" />
      </label>

      <button
        type="button"
        disabled={busy || amount == null || amount < 0 || (diff && note.trim().length < 3)}
        onClick={() => amount != null && onConfirm(method, amount, note.trim())}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white disabled:opacity-50"
      >
        {busy && <Loader2 size={18} className="animate-spin" />}
        Teslimi onayla · {amount != null ? tl(amount) : "—"} {method === "nakit" ? "nakit" : "POS"}
      </button>
      {diff && note.trim().length < 3 && <p className="mt-2 text-center text-xs text-muted">Tutar farklıysa not yazmak zorunlu.</p>}
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
