import "server-only";
// "Hazır · Kuryeye ver" (yolda) seçilince sipariş mesajını kuryeye WhatsApp'tan gönderir.
// Kanal: Meta (kurye son 24 saatte bot numarasına yazdıysa anlık/ücretsiz) → kuryenin CallMeBot anahtarı.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push/server";
import { sendWhatsAppChain, textBody, windowOpenFor, type OrderMsg } from "@/lib/notify";

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

export { BOT_NUMBER_DISPLAY, BOT_WA_LINK, COURIER_REMINDER } from "@/lib/botNumber";

/** Kurye mesajı metni (yönetici bildirimiyle aynı; panel bağlantısı yerine harita). */
export const courierText = (o: OrderMsg) => `🛵 KURYE — ${textBody(o, true)}`;

type CourierCfg = { courier_phone: string | null; courier_apikey: string | null; backup_phone: string | null; callmebot_apikey: string | null };

/** Kuryenin CallMeBot anahtarı; girilmemişse ve kurye numarası yedek numarayla aynıysa onun anahtarı. */
export const courierKey = (n: CourierCfg) =>
  n.courier_apikey?.trim() || (n.courier_phone && n.courier_phone === n.backup_phone ? n.callmebot_apikey : null) || null;

export async function loadCourierCfg(sb: SupabaseClient): Promise<CourierCfg | null> {
  const { data } = await sb.from("notify_settings").select("courier_phone, courier_apikey, backup_phone, callmebot_apikey").eq("id", 1).maybeSingle();
  return (data as CourierCfg | null) ?? null;
}

export async function sendToCourier(n: CourierCfg, text: string) {
  return sendWhatsAppChain({
    phone: n.courier_phone,
    backupPhone: null,
    apikey: courierKey(n),
    text,
    windowOpen: await windowOpenFor(n.courier_phone),
  });
}

export async function notifyCourier(sb: SupabaseClient, orderId: string): Promise<string | null> {
  const n = await loadCourierCfg(sb);
  if (!n?.courier_phone) return null;
  const o = await loadOrderMsg(sb, orderId);
  if (!o) return null;
  // Telefon bildirimi (kurye sayfası ana ekrana eklenmişse) — günlük mesaj gerektirmez
  const { data: tk } = await sb.from("notify_settings").select("courier_token").eq("id", 1).maybeSingle();
  const push = await sendPush("kurye", {
    title: `🛵 Teslimat #${o.order_no} — ${o.customer_name}`,
    body: `${o.address}${o.address_note ? ` (${o.address_note})` : ""}`,
    url: `/kurye?k=${tk?.courier_token ?? ""}`,
    tag: `kurye-${o.order_no}`,
  }).catch(() => ({ sent: 0, failed: 0, total: 0 }));
  const r = await sendToCourier(n, courierText(o));
  const summary = `#${o.order_no} kurye → ${push.sent ? `telefon bildirimi: ${push.sent} cihaz · ` : ""}${r}`;
  await Promise.all([
    sb.from("notify_settings").update({ courier_last_result: `${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} · ${summary}` }).eq("id", 1),
    /gönderildi/.test(r) || push.sent ? sb.from("orders").update({ courier_notified_at: new Date().toISOString() }).eq("id", orderId) : null,
  ]);
  console.log("[kurye]", summary);
  return summary;
}
