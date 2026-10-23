import Link from "next/link";
import { notFound } from "next/navigation";
import { Bike, MessageCircle, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { StatusBadge } from "@/components/admin/OrderTable";
import { PAYMENT_LABEL, formatDate, formatTL } from "@/lib/format";
import { NextStepForm, OrderSteps } from "@/components/admin/OrderProgress";
import { SlaBar } from "@/components/admin/SlaBar";
import { STAGES, isOpen, stageStart, stageTargetMin } from "@/lib/sla";
import type { Order, OrderItem } from "@/lib/types";
import { WhatsAppActions } from "@/components/admin/WhatsAppActions";
import { waLink } from "@/lib/whatsapp";
import { displayPhone } from "@/lib/phone";
import { getStoreSettings } from "@/lib/data/catalog";
import { courierText, loadOrderMsg } from "@/lib/courier";
import { OrderItems, type Alt } from "@/components/admin/OrderItems";
import { CourierCard, type CourierCols } from "@/components/admin/CourierCard";

export const metadata = { title: "Sipariş detayı" };

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ hata?: string; guncellendi?: string }> }) {
  const [{ id }, { hata, guncellendi }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();
  const [{ data: items }, settings, { data: banned }, { data: courier }, courierMsg] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("product_name"),
    getStoreSettings(),
    supabase.from("customer_blacklist").select("reason").eq("phone", order.phone).maybeSingle(),
    supabase.from("notify_settings").select("courier_phone").eq("id", 1).maybeSingle(),
    loadOrderMsg(supabase, id),
  ]);
  const courierPhone = (courier?.courier_phone as string | null) ?? null;
  const itemList = (items ?? []) as OrderItem[];
  const editable = order.status === "alindi" || order.status === "hazirlaniyor";

  // Her kalem için aynı kategoriden, stokta olan benzer ürünler (fiyatı en yakın 4)
  const alternatives: Record<string, Alt[]> = {};
  if (editable) {
    const ids = itemList.filter((i) => !i.removed && i.product_id).map((i) => i.product_id as string);
    const { data: own } = ids.length ? await supabase.from("products").select("id,category_id").in("id", ids) : { data: [] };
    const cats = Array.from(new Set((own ?? []).map((p) => p.category_id).filter(Boolean))) as string[];
    const { data: pool } = cats.length
      ? await supabase.from("products").select("id,name,unit_label,price,sale_price,stock,category_id").in("category_id", cats).eq("is_active", true).gt("stock", 0)
      : { data: [] };
    for (const it of itemList) {
      if (it.removed || !it.product_id) continue;
      const cat = (own ?? []).find((p) => p.id === it.product_id)?.category_id;
      alternatives[it.id] = (pool ?? [])
        .filter((p) => p.category_id === cat && p.id !== it.product_id)
        .map((p) => ({ id: p.id, name: p.name, unit_label: p.unit_label, price: Number(p.sale_price ?? p.price), stock: p.stock }))
        .sort((a, b) => Math.abs(a.price - Number(it.unit_price)) - Math.abs(b.price - Number(it.unit_price)))
        .slice(0, 4);
    }
  }


  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/siparisler" className="text-sm font-semibold text-muted hover:text-brand">← Siparişler</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black">Sipariş #{order.order_no}</h1>
        {banned && (
          <p className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white" title={banned.reason ?? undefined}>
            ⛔ Müşteri kara listede{banned.reason ? `: ${banned.reason}` : ""}
          </p>
        )}
        <StatusBadge status={order.status} />
        <span className="text-sm text-muted">{formatDate(order.created_at)}</span>
      </div>
      {hata && <p className="rounded-lg bg-brand-soft p-3 text-sm font-semibold text-brand">{hata === "1" ? "Durum değiştirilemedi." : hata}</p>}
      {guncellendi && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Sipariş güncellendi. Müşteriye bilgi vermek için aşağıdaki “Sipariş güncellendi” WhatsApp mesajını kullanabilirsin.</p>}

      <section className="space-y-4 rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
        <OrderSteps order={order} />
        {isOpen(order.status) && (
          <SlaBar since={stageStart(order)} targetMin={stageTargetMin(order.status, settings)} label={STAGES[order.status as "alindi"].waitingFor} />
        )}
        <NextStepForm order={order} back={`/admin/siparisler/${order.id}`} big />
        <CourierCard order={order as Order & CourierCols} />
        {courierMsg && (order.status === "hazirlaniyor" || order.status === "yolda") && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-bg p-2.5 text-sm">
            <Bike size={18} className="text-brand" />
            {courierPhone ? (
              <>
                <span className="flex-1">
                  {order.courier_notified_at
                    ? `Kuryeye otomatik gönderildi (${formatDate(order.courier_notified_at)}).`
                    : order.status === "yolda"
                      ? "Kurye mesajı gönderiliyor…"
                      : "“Hazır · Kuryeye ver” deyince kuryeye otomatik gider."}
                </span>
                <a href={waLink(courierPhone, courierText(courierMsg))} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 font-bold text-white">
                  <MessageCircle size={15} /> Kuryeye WhatsApp&apos;tan gönder
                </a>
              </>
            ) : (
              <Link href="/admin/siparisler" className="font-semibold text-brand">Kurye numarası girilmemiş — Siparişler sayfasından ekle</Link>
            )}
          </div>
        )}
        {order.status === "teslim_edildi" && order.delivered_at && (
          <p className="text-sm font-semibold text-emerald-700">
            Teslim edildi · toplam {Math.round((new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime()) / 60000)} dk
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1 rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
          <h2 className="mb-1 font-extrabold">Müşteri</h2>
          <Link href={`/admin/musteriler/${encodeURIComponent(order.phone)}`} className="font-bold text-brand underline-offset-2 hover:underline">{order.customer_name} →</Link>
          <div className="flex flex-wrap gap-3">
            <a href={`tel:${order.phone}`} className="flex items-center gap-1.5 font-semibold text-brand"><Phone size={14} /> {displayPhone(order.phone)}</a>
            <a href={waLink(order.phone, "")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-semibold text-[#128c4a]"><MessageCircle size={14} /> WhatsApp</a>
          </div>
          <p>{order.address}</p>
          {order.address_note && <p className="text-muted">Tarif: {order.address_note}</p>}
          {order.note && <p className="rounded-lg bg-bg p-2">Not: {order.note}</p>}
        </div>
        <div className="space-y-1 rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
          <h2 className="mb-1 font-extrabold">Teslimat & ödeme</h2>
          <p>Saat: <b>{order.delivery_slot}</b></p>
          <p>Ödeme: <b>{PAYMENT_LABEL[order.payment_method]}</b></p>
          <p>Ödeme durumu: <b>{order.payment_status === "odendi" ? "Ödendi" : order.payment_status === "iade" ? "İade" : "Kapıda tahsil edilecek"}</b></p>
          <p className="pt-2 text-lg font-black">{formatTL(order.total)}</p>
        </div>
      </section>

      <WhatsAppActions order={order} storeName={settings.store_name} items={itemList} />

      <section className="rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
        <h2 className="mb-2 font-extrabold">Ürünler (toplama listesi)</h2>
        <OrderItems order={order} items={itemList} alternatives={alternatives} editable={editable} />
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Ara toplam</dt><dd>{formatTL(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Teslimat</dt><dd>{formatTL(order.delivery_fee)}</dd></div>
          <div className="flex justify-between font-extrabold"><dt>Toplam</dt><dd>{formatTL(order.total)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
