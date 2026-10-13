import "server-only";
// "Hazır · Kuryeye ver" (yolda) seçilince sipariş mesajını kuryeye WhatsApp'tan gönderir.
// Kanal: Meta (kurye son 24 saatte bot numarasına yazdıysa anlık/ücretsiz) → kuryenin CallMeBot anahtarı.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppChain, textBody, type OrderMsg } from "@/lib/notify";

export async function loadOrderMsg(sb: SupabaseClient, orderId: string): Promise<OrderMsg | null> {
  const { data: o } = await sb
    .from("orders")
    .select("id, order_no, customer_name, phone, address, address_note, note, delivery_slot, payment_method, total, order_items(quantity, product_name, unit_label, removed)")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return null;
  const items = ((o.order_items ?? []) as { quantity: number; product_name: string; unit_label: string | null; removed?: boolean }[])
    .filter((i) => !i.removed)
    .map((i) => `${i.quantity} × ${i.product_name}${i.unit_label ? ` (${i.unit_label})` : ""}`)
    .sort((a, b) => a.localeCompare(b, "tr"))
    .join("\n");
  return {
    id: o.id,
    order_no: o.order_no,
    customer_name: o.customer_name,
    phone: o.phone,
    address: o.address,
    address_note: o.address_note,
    note: o.note,
    delivery_slot: o.delivery_slot,
    payment_method: o.payment_method,
    total: Number(o.total),
    items: items || null,
  };
}

/** Kurye mesajı metni (yönetici bildirimiyle aynı; panel bağlantısı yerine harita). */
export const courierText = (o: OrderMsg) => `🛵 KURYE — ${textBody(o, true)}`;

export async function notifyCourier(sb: SupabaseClient, orderId: string): Promise<string | null> {
  const { data: n } = await sb.from("notify_settings").select("courier_phone, courier_apikey").eq("id", 1).maybeSingle();
  if (!n?.courier_phone) return null;
  const o = await loadOrderMsg(sb, orderId);
  if (!o) return null;
  const r = await sendWhatsAppChain({ phone: n.courier_phone, backupPhone: null, apikey: n.courier_apikey ?? null, text: courierText(o) });
  const summary = `#${o.order_no} kurye → ${r}`;
  await Promise.all([
    sb.from("notify_settings").update({ courier_last_result: `${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} · ${summary}` }).eq("id", 1),
    sb.from("orders").update({ courier_notified_at: new Date().toISOString() }).eq("id", orderId),
  ]);
  console.log("[kurye]", summary);
  return summary;
}
