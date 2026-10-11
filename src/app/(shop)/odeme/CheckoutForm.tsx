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
import { fmtCountdown, toMin } from "@/lib/hours";
import { AddressPicker, addressIsComplete, emptyAddress, OTHER, type AddressValue } from "@/components/shop/AddressPicker";
import type { DeliveryAreas } from "@/lib/data/areas";
import { PhoneInput } from "@/components/PhoneInput";

const SAVED_KEY = "sanal-market-teslimat";

function loadSaved(areas: DeliveryAreas) {
  const empty = { name: "", phone: "", address: emptyAddress(areas), address_note: "" };
  if (typeof window === "undefined") return empty;
  try {
    const s = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null");
    if (!s) return empty;
    let address = empty.address;
    // Kayıtlı adres hâlâ geçerliyse geri yükle
    const a = s.addr as AddressValue | undefined;
    if (a && areas.neighborhoods.some((n) => String(n.id) === a.neighborhood_id)) {
      const streetOk = a.street_id === OTHER || areas.streets.some((st) => String(st.id) === a.street_id);
      address = { ...empty.address, ...a, street_id: streetOk ? a.street_id : "", street_text: streetOk ? a.street_text : "" };
    }
    return { name: s.name ?? "", phone: s.phone ?? "", address, address_note: s.address_note ?? "" };
  } catch {
    return empty;
  }
}

export function CheckoutForm({ settings, areas }: { settings: StoreSettings; areas: DeliveryAreas }) {
  const router = useRouter();
  const s = useCartSummary(settings);
  const clear = useCart((st) => st.clear);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    ...loadSaved(areas),
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
      const res = await placeOrder({ ...form, delivery_slot: slots.includes(form.delivery_slot) ? form.delivery_slot : (slots[0] ?? form.delivery_slot), items: s.lines.map((l) => ({ product_id: l.id, quantity: l.qty })) });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify({ name: form.name, phone: form.phone, addr: form.address, address_note: form.address_note }));
        const mine = JSON.parse(localStorage.getItem("sanal-market-siparisler") ?? "[]");
        localStorage.setItem("sanal-market-siparisler", JSON.stringify([{ id: res.id, t: res.token, no: res.orderNo }, ...mine].slice(0, 20)));
      } catch {}
      clear();
      router.replace(`/siparis/${res.id}?t=${res.token}&yeni=1`);
    });
  };

  const blocked = s.belowMin || s.closed || !addressIsComplete(form.address);

  // Bu iş gününde bitişi geçmiş teslimat aralıklarını gösterme
  const nowOff = s.hours ? (s.hours.minuteOfDay - toMin(settings.open_time) + 1440) % 1440 : -1;
  const slots = settings.delivery_slots.filter((slot) => {
    const m = slot.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!m) return true; // "En kısa sürede" vb.
    const endOff = (toMin(m[2]) - toMin(settings.open_time) + 1440) % 1440 || 1440;
    return endOff > nowOff;
  });

  return (
    <>
    {s.hours && !s.hours.open && (
      <div className="mb-4 rounded-2xl bg-ink p-4 text-center text-white">
        <p className="text-lg font-black">Şu an kapalıyız 🌙</p>
        <p className="text-sm opacity-90">
          Siparişler her gün <b>{settings.open_time}</b> – <b>{settings.close_time}</b> arası alınır.
          {s.hours.secondsToOpen != null && <> Açılışa {fmtCountdown(s.hours.secondsToOpen)} kaldı.</>}
        </p>
      </div>
    )}
    {s.hours?.lastCall && s.hours.secondsToClose != null && (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-brand p-4 text-white">
        <div>
          <p className="font-black">⏰ Siparişini hemen tamamla!</p>
          <p className="text-sm opacity-90">{settings.close_time}&apos;da sipariş alımı kapanıyor.</p>
        </div>
        <span className="rounded-xl bg-white px-3 py-2 font-mono text-2xl font-black text-brand tabular-nums">{fmtCountdown(s.hours.secondsToClose)}</span>
      </div>
    )}
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 pb-28 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
      <div className="space-y-4">
        <Card icon={<MapPin size={18} />} title="Teslimat bilgileri">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Ad soyad"><input className="input" required autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Cep telefonu"><PhoneInput required value={form.phone} onChange={(v) => set("phone", v)} /></Field>
          </div>
          <AddressPicker areas={areas} value={form.address} onChange={(v) => set("address", v)} />
          <Field label="Adres tarifi (isteğe bağlı)"><input className="input" placeholder="Örn. eczanenin üstü, 3. kat" value={form.address_note} onChange={(e) => set("address_note", e.target.value)} /></Field>
          {settings.delivery_area_note && <p className="text-xs text-muted">{settings.delivery_area_note}</p>}
        </Card>

        <Card icon={<Clock size={18} />} title="Teslimat zamanı">
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <button
                type="button"
                key={slot}
                onClick={() => set("delivery_slot", slot)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold ring-1 transition ${(slots.includes(form.delivery_slot) ? form.delivery_slot : slots[0]) === slot ? "bg-brand-soft text-brand ring-brand" : "bg-white ring-line"}`}
              >
                {slot}
              </button>
            ))}
          </div>
        </Card>

        <Card icon={<CreditCard size={18} />} title="Ödeme yöntemi">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
            <span>Ön bilgilendirme formunu ve mesafeli satış sözleşmesini okudum, onaylıyorum. Kişisel verilerimin <Link href="/kvkk" target="_blank" className="font-semibold text-brand underline">KVKK Aydınlatma Metni</Link> kapsamında işleneceğini biliyorum.</span>
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
    </>
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
