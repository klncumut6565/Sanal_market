"use client";
// Kurye sayfası: hazırlanan / yoldaki siparişler + telefona bildirim. Gizli bağlantıyla (?k=) açılır.
import { useCallback, useEffect, useState } from "react";
import { Bike, MapPin, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PushSetup } from "@/components/PushSetup";
import { waLink } from "@/lib/whatsapp";
import { displayPhone } from "@/lib/phone";

type O = {
  id: string;
  order_no: number;
  status: "yolda" | "hazirlaniyor";
  customer_name: string;
  phone: string;
  address: string;
  address_note: string | null;
  note: string | null;
  payment_method: string;
  total: number;
  items: string | null;
};
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(n));
const pay = (m: string) => (m === "kapida_pos" ? "Kapıda kart (POS)" : "Kapıda nakit");
const maps = (a: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a}, Çorlu, Tekirdağ`)}`;

export function CourierBoard({ token }: { token: string }) {
  const [orders, setOrders] = useState<O[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!/^[0-9a-f-]{36}$/i.test(token)) return setErr("Bağlantı geçersiz. Marketten yeni kurye bağlantısı iste.");
    const { data, error } = await createClient().rpc("courier_orders", { p_token: token });
    if (error) setErr("Bağlantı geçersiz ya da süresi dolmuş. Marketten yeni kurye bağlantısı iste.");
    else {
      setErr(null);
      setOrders((data ?? []) as O[]);
    }
  }, [token]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 15_000);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [load]);

  const subscribe = async (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, device: string) => {
    const { error } = await createClient().rpc("courier_push_subscribe", {
      p_token: token,
      p_endpoint: sub.endpoint,
      p_p256dh: sub.keys.p256dh,
      p_auth: sub.keys.auth,
      p_device: device,
    });
    return error ? { error: "Kaydedilemedi: bağlantı geçersiz olabilir." } : {};
  };

  const onRoad = (orders ?? []).filter((o) => o.status === "yolda");
  const preparing = (orders ?? []).filter((o) => o.status === "hazirlaniyor");

  return (
    <div className="mx-auto min-h-dvh max-w-lg space-y-3 bg-bg p-4">
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-black">
          <Bike className="text-brand" /> Sanal Market Kurye
        </h1>
        <button onClick={load} className="grid h-9 w-9 place-items-center rounded-full bg-white ring-1 ring-line" aria-label="Yenile">
          <RefreshCw size={16} />
        </button>
      </header>

      {err ? (
        <p className="rounded-2xl bg-brand-soft p-4 text-sm font-semibold text-brand">{err}</p>
      ) : (
        <>
          <PushSetup title="Teslimat bildirimleri" onSubscribe={subscribe} />

          <h2 className="pt-1 font-extrabold">Teslim edilecek ({onRoad.length})</h2>
          {orders === null ? (
            <div className="h-32 animate-pulse rounded-2xl bg-white" />
          ) : onRoad.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line p-4 text-center text-sm text-muted">Şu an teslim edilecek sipariş yok.</p>
          ) : (
            onRoad.map((o) => (
              <article key={o.id} className="space-y-2 rounded-2xl bg-white p-4 ring-2 ring-sky-500">
                <div className="flex items-center justify-between">
                  <b className="text-lg">#{o.order_no}</b>
                  <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-bold text-white">Yolda</span>
                </div>
                <p className="font-bold">{o.customer_name}</p>
                <p className="text-sm">
                  📍 {o.address}
                  {o.address_note && <span className="text-muted"> ({o.address_note})</span>}
                </p>
                {o.items && <pre className="whitespace-pre-wrap rounded-xl bg-bg p-2 font-sans text-sm">{o.items}</pre>}
                {o.note && <p className="text-sm"><b>Not:</b> {o.note}</p>}
                <p className="text-sm font-bold">
                  {tl(o.total)} · {pay(o.payment_method)}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1 text-sm font-bold">
                  <a href={maps(o.address)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-xl bg-ink py-2.5 text-white">
                    <MapPin size={16} /> Harita
                  </a>
                  <a href={`tel:${o.phone}`} className="flex items-center justify-center gap-1 rounded-xl bg-white py-2.5 ring-1 ring-line">
                    <Phone size={16} /> Ara
                  </a>
                  <a href={waLink(o.phone, `Merhaba, Sanal Market siparişiniz (#${o.order_no}) yolda.`)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-xl bg-[#25D366] py-2.5 text-white">
                    <MessageCircle size={16} /> Yaz
                  </a>
                </div>
                <p className="text-xs text-muted">{displayPhone(o.phone)}</p>
              </article>
            ))
          )}

          {preparing.length > 0 && (
            <>
              <h2 className="pt-1 font-extrabold text-muted">Hazırlanıyor ({preparing.length})</h2>
              {preparing.map((o) => (
                <article key={o.id} className="rounded-2xl bg-white p-3 text-sm opacity-80 ring-1 ring-line">
                  <b>#{o.order_no}</b> · {o.customer_name} · {o.address}
                </article>
              ))}
            </>
          )}
          <p className="pt-2 text-center text-xs text-muted">Sayfa her 15 saniyede bir yenilenir.</p>
        </>
      )}
    </div>
  );
}
