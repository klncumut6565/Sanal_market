import "server-only";
// Telefona uygulama bildirimi gönderir (yönetici / kurye cihazları).
// Hedefler ve imza anahtarı gizli anahtarla (WHATSAPP_VERIFY_TOKEN = notify_settings.webhook_secret) okunur,
// böylece müşteri siparişi sonrası (oturumsuz) da gönderilebilir.
import webpush from "web-push";
import { createPublicClient } from "@/lib/supabase/public";
import { VAPID_PUBLIC_KEY, type PushPayload } from "./config";

const secret = () => process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";

type Targets = { vapid_private: string | null; subs: { endpoint: string; p256dh: string; auth: string }[] };

async function deliver(sb: ReturnType<typeof createPublicClient>, t: Targets, payload: PushPayload) {
  if (!t.vapid_private || !t.subs.length) return { sent: 0, failed: 0, total: t.subs?.length ?? 0 };
  webpush.setVapidDetails("mailto:klncumut65@gmail.com", VAPID_PUBLIC_KEY, t.vapid_private);
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    t.subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600, urgency: "high" });
        sent++;
        await sb.rpc("push_mark", { p_secret: secret(), p_endpoint: s.endpoint, p_ok: true });
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        console.error("[push] gönderilemedi", code, (e as Error).message);
        // 404/410: cihaz aboneliği sona ermiş → bir daha deneme
        if (code === 404 || code === 410) await sb.rpc("push_mark", { p_secret: secret(), p_endpoint: s.endpoint, p_ok: false });
      }
    }),
  );
  return { sent, failed, total: t.subs.length };
}

export async function sendPush(role: "admin" | "kurye", payload: PushPayload): Promise<{ sent: number; failed: number; total: number }> {
  if (!secret()) return { sent: 0, failed: 0, total: 0 };
  const sb = createPublicClient();
  const { data, error } = await sb.rpc("push_targets", { p_secret: secret(), p_role: role });
  if (error || !data) {
    console.error("[push] hedefler:", error?.message);
    return { sent: 0, failed: 0, total: 0 };
  }
  return deliver(sb, data as Targets, payload);
}

/** Kurye bildirimi: userId verilirse yalnızca o kuryenin cihazları; null → mesaideki tüm kuryeler + eski gizli bağlantılı cihazlar */
export async function sendPushCourier(userId: string | null, payload: PushPayload): Promise<{ sent: number; failed: number; total: number }> {
  if (!secret()) return { sent: 0, failed: 0, total: 0 };
  const sb = createPublicClient();
  const { data, error } = await sb.rpc("push_targets_courier", { p_secret: secret(), p_user_id: userId });
  if (error || !data) {
    console.error("[push] kurye hedefleri:", error?.message);
    return { sent: 0, failed: 0, total: 0 };
  }
  return deliver(sb, data as Targets, payload);
}
