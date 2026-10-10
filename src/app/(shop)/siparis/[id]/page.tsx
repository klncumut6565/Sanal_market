import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { PAYMENT_LABEL, STATUS_FLOW, STATUS_LABEL, formatDate, formatTL } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { AutoRefresh } from "@/components/AutoRefresh";
import { waLink } from "@/lib/whatsapp";
import { displayPhone } from "@/lib/phone";
import { getStoreSettings } from "@/lib/data/catalog";

export const metadata = { title: "Sipariş takibi" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; yeni?: string }> };

const UUID = /^[0-9a-f-]{36}$/i;

export default function OrderPage(props: Props) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" />}>
        <OrderContent {...props} />
      </Suspense>
    </div>
  );
}

async function loadOrder(id: string, token?: string): Promise<{ order: Order; items: OrderItem[] } | null> {
  if (!hasSupabase || !UUID.test(id)) return null;
  const supabase = await createClient();
  if (token && UUID.test(token)) {
    const { data } = await supabase.rpc("get_order_public", { p_order_id: id, p_token: token });
    if (data) return data as { order: Order; items: OrderItem[] };
  }
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) return null;
  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", id);
  return { order: order as Order, items: (items ?? []) as OrderItem[] };
}

async function OrderContent({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [data, settings] = await Promise.all([loadOrder(id, sp.t), getStoreSettings()]);
  if (!data) notFound();
  const { order, items } = data;
  const cancelled = order.status === "iptal";
  const stepIndex = STATUS_FLOW.indexOf(order.status);
  const final = cancelled || order.status === "teslim_edildi";

  return (
    <div className="space-y-4">
      {!final && <AutoRefresh seconds={20} />}
      {sp.yeni && (
        <div className="rounded-2xl bg-ok p-4 text-white">
          <p className="text-lg font-black">Siparişin alındı! 🎉</p>
          <p className="text-sm opacity-90">Bu sayfayı kaydederek siparişini takip edebilirsin.</p>
        </div>
      )}

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black">Sipariş #{order.order_no}</h1>
          <span className="text-xs text-muted">{formatDate(order.created_at)}</span>
        </div>
        {cancelled ? (
          <p className="mt-4 flex items-center gap-2 font-bold text-brand"><XCircle size={20} /> {STATUS_LABEL.iptal}</p>
        ) : (
          <ol className="mt-5 grid grid-cols-4 gap-1">
            {STATUS_FLOW.map((st, i) => {
              const done = i <= stepIndex;
              return (
                <li key={st} className="flex flex-col items-center text-center">
                  <span className={`mb-1.5 h-1.5 w-full rounded-full ${done ? "bg-brand" : "bg-line"}`} />
                  {done ? <CheckCircle2 size={20} className="text-brand" /> : <Circle size={20} className="text-line" />}
                  <span className={`mt-1 text-[11px] font-bold leading-tight ${done ? "" : "text-muted"}`}>{STATUS_LABEL[st]}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 font-extrabold">Ürünler</h2>
        <ul className="divide-y divide-line text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3 py-2">
              <span>
                <b>{it.quantity}×</b> {it.product_name} <span className="text-muted">{it.unit_label}</span>
              </span>
              <span className="font-semibold">{formatTL(it.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Ara toplam</dt><dd>{formatTL(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Teslimat</dt><dd>{Number(order.delivery_fee) === 0 ? "Ücretsiz" : formatTL(order.delivery_fee)}</dd></div>
          <div className="flex justify-between text-base font-extrabold"><dt>Toplam</dt><dd>{formatTL(order.total)}</dd></div>
        </dl>
      </section>

      <section className="space-y-1 rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
        <h2 className="mb-1 font-extrabold">Teslimat & ödeme</h2>
        <p><b>{order.customer_name}</b> · {displayPhone(order.phone)}</p>
        <p className="text-muted">{order.address}{order.address_note ? ` — ${order.address_note}` : ""}</p>
        <p>Teslimat: <b>{order.delivery_slot}</b></p>
        <p>Ödeme: <b>{PAYMENT_LABEL[order.payment_method]}</b></p>
        {order.note && <p className="text-muted">Not: {order.note}</p>}
      </section>

      {settings.whatsapp_phone && !final && (
        <a
          href={waLink(settings.whatsapp_phone, `Merhaba, #${order.order_no} numaralı siparişim hakkında yazıyorum.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-bold text-white"
        >
          WhatsApp&apos;tan bize yaz
        </a>
      )}
      <Link href="/" className="btn-ghost w-full">Alışverişe devam et</Link>
    </div>
  );
}
