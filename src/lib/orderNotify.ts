import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { sendPush } from "@/lib/push/server";
import { notifyNewOrder } from "@/lib/notify";

/** Yeni sipariş bildirimleri (yönetici telefon bildirimi + e-posta/WhatsApp). Sitedeki ödeme ve WhatsApp botu ortak kullanır. */
export async function notifyOrderPlaced(row: { order_id: string; access_token: string; order_no: number }, customerName: string, source?: string) {
  await Promise.allSettled([
    (async () => {
      try {
        await sendPush("admin", {
          title: `🛒 Yeni sipariş #${row.order_no}${source ? ` (${source})` : ""}`,
          body: `${customerName} · dokun, siparişi aç`,
          url: `/admin/siparisler/${row.order_id}`,
          tag: `siparis-${row.order_no}`,
        });
      } catch (e) {
        console.error("[push]", e);
      }
    })(),
    (async () => {
      try {
        const sb = createPublicClient();
        const { data: payload, error } = await sb.rpc("claim_order_notification", { p_order_id: row.order_id, p_token: row.access_token });
        if (error) console.error("[bildirim] claim:", error.message);
        const summary = payload ? await notifyNewOrder(payload) : null;
        if (summary) await sb.rpc("record_notification_result", { p_order_id: row.order_id, p_token: row.access_token, p_result: summary });
      } catch (e) {
        console.error("[bildirim]", e);
      }
    })(),
  ]);
}
