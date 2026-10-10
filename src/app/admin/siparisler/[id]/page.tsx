import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
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

export const metadata = { title: "Sipariş detayı" };

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ hata?: string }> }) {
  const [{ id }, { hata }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();
  const [{ data: items }, settings] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("product_name"),
    getStoreSettings(),
  ]);


  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/siparisler" className="text-sm font-semibold text-muted hover:text-brand">← Siparişler</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black">Sipariş #{order.order_no}</h1>
        <StatusBadge status={order.status} />
        <span className="text-sm text-muted">{formatDate(order.created_at)}</span>
      </div>
      {hata && <p className="rounded-lg bg-brand-soft p-3 text-sm font-semibold text-brand">Durum değiştirilemedi.</p>}

      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-line">
        <OrderSteps order={order} />
        {isOpen(order.status) && (
          <SlaBar since={stageStart(order)} targetMin={stageTargetMin(order.status, settings)} label={STAGES[order.status as "alindi"].waitingFor} />
        )}
        <NextStepForm order={order} back={`/admin/siparisler/${order.id}`} big />
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

      <WhatsAppActions order={order} storeName={settings.store_name} />

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 font-extrabold">Ürünler (toplama listesi)</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {((items ?? []) as OrderItem[]).map((it) => (
              <tr key={it.id}>
                <td className="w-12 py-2 text-lg font-black">{it.quantity}×</td>
                <td>{it.product_name} <span className="text-muted">{it.unit_label}</span></td>
                <td className="text-right text-muted">{formatTL(it.unit_price)}</td>
                <td className="w-28 text-right font-bold">{formatTL(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Ara toplam</dt><dd>{formatTL(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Teslimat</dt><dd>{formatTL(order.delivery_fee)}</dd></div>
          <div className="flex justify-between font-extrabold"><dt>Toplam</dt><dd>{formatTL(order.total)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
