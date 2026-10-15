import "server-only";
// WhatsApp Cloud API bağlantı kurulumu (Ayarlar → WhatsApp sipariş botu → "Bağlantı kurulumu").
// Sunucu, Vercel'deki WHATSAPP_TOKEN ile Meta Graph API'ye bağlanır; kullanıcıdan Graph API Explorer kullanması istenmez.
const GRAPH = "https://graph.facebook.com/v21.0";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://sanalmarket.vercel.app").replace(/\/$/, "");
export const WEBHOOK_URL = `${SITE}/api/whatsapp/webhook`;
const token = () => process.env.WHATSAPP_TOKEN?.trim() || "";
const phoneId = () => process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
// İşletme hesabı (WABA) kimliği: Vercel'de WHATSAPP_WABA_ID yoksa kurulumda not edilen değer
export const wabaId = () => process.env.WHATSAPP_WABA_ID?.trim() || "1750497189284542";

async function graph(path: string, init?: RequestInit & { auth?: string }) {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${init?.auth ?? token()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {}
  const err = (body as { error?: { message?: string; code?: number } } | null)?.error;
  return { ok: res.ok && !err, body, error: err ? `${err.code ?? res.status}: ${err.message ?? ""}` : res.ok ? null : `HTTP ${res.status}` };
}

export type WaSetupStatus = {
  env: { token: boolean; phoneId: boolean; verifyToken: boolean; appId: boolean; appSecret: boolean };
  number?: { display?: string; name?: string; quality?: string; error?: string };
  subscribed?: { ok: boolean; apps: string[]; error?: string };
  webhookUrl: string;
  wabaId: string;
};

export async function waSetupStatus(): Promise<WaSetupStatus> {
  const env = {
    token: !!token(),
    phoneId: !!phoneId(),
    verifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN?.trim(),
    appId: !!process.env.WHATSAPP_APP_ID?.trim(),
    appSecret: !!process.env.WHATSAPP_APP_SECRET?.trim(),
  };
  const out: WaSetupStatus = { env, webhookUrl: WEBHOOK_URL, wabaId: wabaId() };
  if (!env.token) return out;
  const [num, subs] = await Promise.all([
    env.phoneId ? graph(`${phoneId()}?fields=display_phone_number,verified_name,quality_rating`) : Promise.resolve(null),
    graph(`${wabaId()}/subscribed_apps`),
  ]);
  if (num) {
    const b = num.body as { display_phone_number?: string; verified_name?: string; quality_rating?: string } | null;
    out.number = num.ok ? { display: b?.display_phone_number, name: b?.verified_name, quality: b?.quality_rating } : { error: num.error ?? "okunamadı" };
  }
  const list = ((subs.body as { data?: { whatsapp_business_api_data?: { name?: string; id?: string } }[] } | null)?.data ?? []).map(
    (d) => d.whatsapp_business_api_data?.name ?? d.whatsapp_business_api_data?.id ?? "uygulama",
  );
  out.subscribed = { ok: subs.ok && list.length > 0, apps: list, error: subs.ok ? undefined : (subs.error ?? undefined) };
  return out;
}

/** İşletme hesabını (WABA) uygulamaya abone eder → gelen mesajlar uygulamanın webhook'una düşer. */
export async function waSubscribeApp() {
  if (!token()) return { ok: false, message: "WHATSAPP_TOKEN tanımlı değil." };
  const r = await graph(`${wabaId()}/subscribed_apps`, { method: "POST" });
  return r.ok ? { ok: true, message: "İşletme hesabı uygulamaya abone edildi." } : { ok: false, message: `Abonelik yapılamadı — ${r.error}` };
}

/** Uygulamanın webhook adresini ve "messages" alanını Meta'ya kaydeder (WHATSAPP_APP_ID + WHATSAPP_APP_SECRET gerekir). */
export async function waRegisterWebhook() {
  const appId = process.env.WHATSAPP_APP_ID?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const verify = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!appId || !appSecret) return { ok: false, message: "Bu adım için Vercel'e WHATSAPP_APP_ID ve WHATSAPP_APP_SECRET eklenmeli (ya da adresi Meta panelinden elle gir)." };
  if (!verify) return { ok: false, message: "WHATSAPP_VERIFY_TOKEN tanımlı değil." };
  const params = new URLSearchParams({ object: "whatsapp_business_account", callback_url: WEBHOOK_URL, verify_token: verify, fields: "messages", include_values: "true" });
  const r = await graph(`${appId}/subscriptions?${params}`, { method: "POST", auth: `${appId}|${appSecret}` });
  return r.ok ? { ok: true, message: "Webhook adresi Meta'ya kaydedildi ve doğrulandı (messages)." } : { ok: false, message: `Webhook kaydedilemedi — ${r.error}` };
}
