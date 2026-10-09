"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Banknote, CreditCard, Lock, MapPin, Clock, Loader2 } from "lucide-react";
import { useCart } from "@/store/cart";
import { CartLines, FreeDeliveryBar, Totals, useCartSummary } from "@/components/shop/CartContents";
import { formatTL } from "@/lib/format";
import type { PaymentMethod, StoreSettings } from "@/lib/types";
import { placeOrder } from "./actions";

const SAVED_KEY = "sanal-market-teslimat";

function loadSaved() {
  const empty = { name: "", phone: "", address: "", address_note: "" };
  if (typeof window === "undefined") return empty;
  try {
    const s = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null");
    return s ? { name: s.name ?? "", phone: s.phone ?? "", address: s.address ?? "", address_note: s.address_note ?? "" } : empty;
  } catch {
    return empty;
  }
}

export function CheckoutForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const s = useCartSummary(settings);
  const clear = useCart((st) => st.clear);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    ...loadSaved(),
    note: "",
    delivery_slot: settings.delivery_slots[0] ?? "",
    payment_method: "kapida_nakit" as PaymentMethod,
    accepted_terms: false,
  }));

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (!s.ready) return <div className="h-96 animate-pulse rounded-2xl bg-white" />;
  if (s.count === 0)
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-line">
        <p className="font-bold">Sepetin boş</p>
        <Link href="/" className="btn-primary mx-auto mt-4 flex w-fit">Alışverişe başla</Link>
      </div>
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await placeOrder({ ...form, items: s.lines.map((l) => ({ product_id: l.id, quantity: l.qty })) });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify({ name: form.name, phone: form.phone, address: form.address, address_note: form.address_note }));
        const mine = JSON.parse(localStorage.getItem("sanal-market-siparisler") ?? "[]");
        localStorage.setItem("sanal-market-siparisler", JSON.stringify([{ id: res.id, t: res.token, no: res.orderNo }, ...mine].slice(0, 20)));
      } catch {}
      clear();
      router.replace(`/siparis/${res.id}?t=${res.token}&yeni=1`);
    });
  };

  const blocked = s.belowMin || !settings.is_open;

  return (
    <form onSubmit={submit} className="grid gap-5 pb-28 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
      <div className="space-y-4">
        <Card icon={<MapPin size={18} />} title="Teslimat bilgileri">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ad soyad"><input className="input" required autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Cep telefonu"><input className="input" required type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          </div>
          <Field label="Adres (mahalle, sokak, bina no, daire)">
            <textarea className="input min-h-24" required autoComplete="street-address" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Adres tarifi (isteğe bağlı)"><input className="input" placeholder="Örn. eczanenin üstü, 3. kat" value={form.address_note} onChange={(e) => set("address_note", e.target.value)} /></Field>
          {settings.delivery_area_note && <p className="text-xs text-muted">{settings.delivery_area_note}</p>}
        </Card>

        <Card icon={<Clock size={18} />} title="Teslimat zamanı">
          <div className="flex flex-wrap gap-2">
            {settings.delivery_slots.map((slot) => (
              <button
                type="button"
                key={slot}
                onClick={() => set("delivery_slot", slot)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold ring-1 transition ${form.delivery_slot === slot ? "bg-brand-soft text-brand ring-brand" : "bg-white ring-line"}`}
              >
                {slot}
              </button>
            ))}
          </div>
        </Card>

        <Card icon={<CreditCard size={18} />} title="Ödeme yöntemi">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <PayOption active={form.payment_method === "kapida_nakit"} onClick={() => set("payment_method", "kapida_nakit")} icon={<Banknote size={22} />} title="Kapıda nakit" desc="Siparişini teslim alırken nakit öde" />
            <PayOption active={form.payment_method === "kapida_pos"} onClick={() => set("payment_method", "kapida_pos")} icon={<CreditCard size={22} />} title="Kapıda kart (POS)" desc="Kurye POS cihazı ile kredi/banka kartı" />
            <PayOption disabled icon={<Lock size={22} />} title="Online kart ile öde" desc="Yakında (iyzico)" />
          </div>
        </Card>

        <Card title="Sipariş notu">
          <input className="input" placeholder="Örn. zile basmayın, poşetsiz olsun" value={form.note} onChange={(e) => set("note", e.target.value)} />
        </Card>
      </div>

      <div className="lg:sticky lg:top-[84px] lg:self-start">
        <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="text-lg font-extrabold">Sipariş özeti</h2>
          <div className="max-h-64 overflow-y-auto"><CartLines /></div>
          <FreeDeliveryBar subtotal={s.subtotal} threshold={settings.free_delivery_threshold} />
          <Totals subtotal={s.subtotal} delivery={s.delivery} savings={s.savings} total={s.total} />
          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" className="mt-0.5 accent-brand" checked={form.accepted_terms} onChange={(e) => set("accepted_terms", e.target.checked)} />
            <span>Ön bilgilendirme formunu ve mesafeli satış sözleşmesini okudum, onaylıyorum. Kişisel verilerim KVKK kapsamında siparişin teslimi için işlenecektir.</span>
          </label>
          {error && <p role="alert" className="rounded-lg bg-brand-soft p-2.5 text-sm font-semibold text-brand">{error}</p>}
          {s.belowMin && <p className="text-center text-xs font-semibold text-muted">Minimum sipariş tutarı {formatTL(settings.min_order_amount)}</p>}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:static lg:mt-3 lg:border-0 lg:bg-transparent lg:p-0">
          <button type="submit" disabled={pending || blocked || !form.accepted_terms} className="btn-primary w-full justify-between">
            <span className="flex items-center gap-2">{pending && <Loader2 size={18} className="animate-spin" />} Siparişi ver</span>
            <span>{formatTL(s.total)}</span>
          </button>
        </div>
      </div>
    </form>
  );
}

function Card({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <h2 className="flex items-center gap-2 font-extrabold"><span className="text-brand">{icon}</span>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function PayOption({ active, disabled, onClick, icon, title, desc }: { active?: boolean; disabled?: boolean; onClick?: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-45 ${active ? "bg-brand-soft ring-2 ring-brand" : "bg-white ring-line hover:ring-brand"}`}
    >
      <span className={active ? "text-brand" : "text-muted"}>{icon}</span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </button>
  );
}
