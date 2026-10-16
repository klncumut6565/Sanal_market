"use client";
import { useState } from "react";
import { AlertTriangle, Banknote, ChevronDown, CreditCard, Hand, Loader2, MessageCircle, Navigation, Package, Phone, Undo2 } from "lucide-react";
import { waLink } from "@/lib/whatsapp";
import { displayPhone } from "@/lib/phone";
import { mapsDirections } from "@/lib/courierShared";
import { since, tl, type CourierOrder } from "./types";

type Props = {
  o: CourierOrder;
  now: number;
  mode: "mine" | "pool";
  busy: boolean;
  canClaim: boolean;
  onClaim: () => void;
  onPickup: () => void;
  onDeliver: () => void;
  onIssue: () => void;
  onRelease: () => void;
};

export function OrderCard({ o, now, mode, busy, canClaim, onClaim, onPickup, onDeliver, onIssue, onRelease }: Props) {
  const [open, setOpen] = useState(mode === "mine");
  const items = (o.order_items ?? []).filter((i) => !i.removed);
  const pieces = items.reduce((a, i) => a + Number(i.quantity), 0);
  const onRoad = o.status === "yolda";
  const pos = o.payment_method === "kapida_pos";
  const late = onRoad && o.picked_up_at && now - Date.parse(o.picked_up_at) > 30 * 60_000;
  const greet = `Merhaba ${o.customer_name.split(" ")[0]}, Sanal Market siparişiniz (#${o.order_no})`;

  return (
    <article
      className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-2 ${
        mode === "pool" ? "ring-line" : o.delivery_issue ? "ring-red-400" : onRoad ? "ring-sky-500" : "ring-amber-400"
      }`}
    >
      <div className={`flex items-center justify-between px-4 py-2 text-sm font-bold ${mode === "pool" ? "bg-bg" : onRoad ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800"}`}>
        <span className="text-base font-black text-ink">#{o.order_no}</span>
        <span className="flex items-center gap-1.5">
          {onRoad ? (
            <>🛵 Yolda · {since(o.picked_up_at ?? o.dispatched_at, now)}</>
          ) : (
            <>👨‍🍳 Hazırlanıyor{o.assigned_at && mode === "mine" ? ` · ${since(o.assigned_at, now)} önce atandı` : ""}</>
          )}
          {late && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] text-white">GECİKTİ</span>}
        </span>
      </div>

      <div className="space-y-2.5 p-4">
        <div>
          <p className="text-lg font-extrabold leading-tight">{o.customer_name}</p>
          <p className="mt-1 font-semibold leading-snug">📍 {o.address}</p>
          {o.address_note && <p className="text-sm text-muted">{o.address_note}</p>}
          {o.delivery_slot && <p className="mt-1 text-sm font-semibold text-sky-700">⏰ {o.delivery_slot}</p>}
        </div>

        {o.note && <p className="rounded-xl bg-amber-50 p-2.5 text-sm ring-1 ring-amber-200"><b>Müşteri notu:</b> {o.note}</p>}
        {o.delivery_issue && (
          <p className="flex gap-2 rounded-xl bg-red-50 p-2.5 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Bildirilen sorun: {o.delivery_issue}
          </p>
        )}

        <div className="flex items-center justify-between rounded-xl bg-bg px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-bold">
            {pos ? <CreditCard size={18} className="text-violet-600" /> : <Banknote size={18} className="text-emerald-600" />}
            {pos ? "Kapıda POS" : "Kapıda nakit"}
          </span>
          <span className="text-xl font-black tabular-nums">{tl(o.total)}</span>
        </div>

        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold text-muted">
          <span className="flex items-center gap-1.5">
            <Package size={16} /> {items.length} çeşit · {pieces} adet
          </span>
          <ChevronDown size={18} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && items.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-bg p-2.5 text-sm">
            {items.map((i, k) => (
              <li key={k} className="flex gap-2">
                <b className="w-8 shrink-0 text-right tabular-nums">{Number(i.quantity)}×</b>
                <span>
                  {i.product_name}
                  {i.unit_label && <span className="text-muted"> ({i.unit_label})</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {mode === "mine" && (
          <div className="grid grid-cols-3 gap-2 text-sm font-bold">
            <a href={mapsDirections(o.address)} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-0.5 rounded-xl bg-ink py-2.5 text-white">
              <Navigation size={18} /> Yol tarifi
            </a>
            <a href={`tel:${o.phone}`} className="flex flex-col items-center gap-0.5 rounded-xl bg-white py-2.5 ring-1 ring-line">
              <Phone size={18} /> Ara
            </a>
            <a
              href={waLink(o.phone, `${greet} ${onRoad ? "yola çıktı, birazdan kapınızdayım." : "hazırlanıyor, birazdan yola çıkacağım."}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-0.5 rounded-xl bg-[#25D366] py-2.5 text-white"
            >
              <MessageCircle size={18} /> WhatsApp
            </a>
          </div>
        )}
        {mode === "mine" && onRoad && (
          <a href={waLink(o.phone, `${greet} kapınızda 🛵`)} target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-bold text-[#128C7E] underline">
            “Kapınızdayım” mesajı gönder
          </a>
        )}
        {mode === "mine" && <p className="text-center text-xs text-muted">{displayPhone(o.phone)}</p>}

        {mode === "pool" ? (
          <button type="button" disabled={busy || !canClaim} onClick={onClaim} className="btn-primary w-full py-3 text-base disabled:opacity-50">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Hand size={18} />} {canClaim ? "Bu siparişi üstlen" : "Üstlenmek için mesaiyi aç"}
          </button>
        ) : onRoad ? (
          <div className="space-y-2">
            <button type="button" disabled={busy} onClick={onDeliver} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-base font-black text-white disabled:opacity-50">
              {busy ? <Loader2 size={18} className="animate-spin" /> : "✅"} Teslim ettim
            </button>
            <button type="button" disabled={busy} onClick={onIssue} className="w-full rounded-xl py-2 text-sm font-bold text-red-600 ring-1 ring-red-200">
              Teslim edilemedi / sorun bildir
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" disabled={busy} onClick={onPickup} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 py-3.5 text-base font-black text-white disabled:opacity-50">
              {busy ? <Loader2 size={18} className="animate-spin" /> : "📦"} Paketi teslim aldım · Yola çıktım
            </button>
            {!o.picked_up_at && (
              <button type="button" disabled={busy} onClick={onRelease} className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-bold text-muted">
                <Undo2 size={14} /> Bu siparişi bırak (havuza geri ver)
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
