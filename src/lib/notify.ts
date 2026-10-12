import "server-only";
// Yeni sipariş bildirimleri: e-posta (Resend) + WhatsApp.
// WhatsApp: Meta WhatsApp Cloud API ayarlıysa (WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID) ANLIK resmi API,
// değilse CallMeBot (ücretsiz, kuyruklu — dakikalarca gecikebilir).
// ÜCRETSİZ KULLANIM: Alıcı (market sahibi) son 24 saatte bot numarasına bir mesaj yazdıysa
// "müşteri hizmeti penceresi" açıktır ve düz metin mesajlar ÜCRETSİZDİR. Pencere kapalıysa
// (Meta hata 131047) ücretli şablon GÖNDERİLMEZ; CallMeBot'a (ücretsiz, gecikmeli) düşülür.
// WHATSAPP_USE_TEMPLATE=1 verilirse pencere kapalıyken ücretli şablon kullanılır.
// Yalnızca sunucuda çalışır; anahtarlar tarayıcıya gitmez.

type Payload = {
  skip?: string;
  email?: string | null;
  whatsapp_phone?: string | null;
  callmebot_apikey?: string | null;
  order?: {
    id: string;
    order_no: number;
    customer_name: string;
    phone: string;
    address: string;
    address_note: string | null;
    note: string | null;
    delivery_slot: string;
    payment_method: string;
    total: number;
    items: string | null;
  };
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://sanalmarket.vercel.app").replace(/\/$/, "");
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(n));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pay = (m: string) => (m === "kapida_pos" ? "Kapıda kart (POS)" : "Kapıda nakit");

function textBody(o: NonNullable<Payload["order"]>) {
  return [
    `🛒 YENİ SİPARİŞ #${o.order_no} — ${tl(o.total)}`,
    `${o.customer_name} · ${o.phone}`,
    `📍 ${o.address}${o.address_note ? ` (${o.address_note})` : ""}`,
    `🕒 ${o.delivery_slot} · ${pay(o.payment_method)}`,
    o.items ? `\n${o.items}` : "",
    o.note ? `\nNot: ${o.note}` : "",
    `\nPanel: ${SITE}/admin/siparisler/${o.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY tanımlı değil (Vercel ortam değişkeni)." };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM?.trim() || "Sanal Market <onboarding@resend.dev>", to: [to], subject, text, html }),
  });
  if (!res.ok) return { ok: false, error: `E-posta gönderilemedi (${res.status}): ${(await res.text()).slice(0, 200)}` };
  return { ok: true };
}

// ---------------- Meta WhatsApp Cloud API ----------------
export const hasWhatsAppCloud = () => !!(process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());

/** Şablon değişkenleri satır sonu / sekme / 4+ boşluk içeremez (Meta kuralı) — tek satıra indir. */
const oneLine = (s: string, max = 900) =>
  s.replace(/[\r\n\t]+/g, " · ").replace(/ {2,}/g, " ").trim().slice(0, max) || "-";

/**
 * Onaylı şablon mesajı gönderir (işletme başlatan mesajlar şablon gerektirir).
 * Varsayılan şablon: "yeni_siparis" (tr), 6 değişken:
 *   {{1}} sipariş no · {{2}} tutar · {{3}} müşteri · {{4}} adres · {{5}} ürünler · {{6}} panel bağlantısı
 */
type CloudResult = { ok: boolean; error?: string; windowClosed?: boolean };

async function cloudPost(body: Record<string, unknown>): Promise<CloudResult> {
  const token = process.env.WHATSAPP_TOKEN!.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  if (res.ok) return { ok: true };
  let msg = `${res.status}`;
  let code = 0;
  try {
    const j = (await res.json()) as { error?: { code?: number; message?: string; error_data?: { details?: string } } };
    code = j.error?.code ?? 0;
    msg += `: ${j.error?.error_data?.details ?? j.error?.message ?? ""}`;
  } catch {}
  // 131047: 24 saatlik pencere kapalı (yalnızca şablon gönderilebilir)
  const windowClosed = code === 131047 || /24 hours|re-engagement/i.test(msg);
  return { ok: false, windowClosed, error: `WhatsApp (Meta) gönderilemedi — ${msg.slice(0, 250)}` };
}

/** Düz metin (ücretsiz; yalnızca alıcı son 24 saatte bot numarasına yazdıysa gider). */
export async function sendWhatsAppCloudText(to: string, text: string) {
  return cloudPost({ to: to.replace(/\D/g, ""), type: "text", text: { body: text.slice(0, 4000), preview_url: false } });
}

export async function sendWhatsAppCloud(to: string, params: string[]) {
  const template = process.env.WHATSAPP_TEMPLATE?.trim() || "yeni_siparis";
  const lang = process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "tr";
  return cloudPost({
    to: to.replace(/\D/g, ""),
    type: "template",
    template: {
      name: template,
      language: { code: lang },
      components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: oneLine(t) })) }],
    },
  });
}

export const templateFallbackEnabled = () => process.env.WHATSAPP_USE_TEMPLATE?.trim() === "1";

const cloudParams = (o: NonNullable<Payload["order"]>) => [
  String(o.order_no),
  tl(o.total),
  `${o.customer_name} (${o.phone})`,
  `${o.address}${o.address_note ? ` (${o.address_note})` : ""} — ${o.delivery_slot}, ${pay(o.payment_method)}${o.note ? ` — Not: ${o.note}` : ""}`,
  o.items ?? "-",
  `${SITE}/admin/siparisler/${o.id}`,
];

/** Test mesajı için örnek değerler (şablon zorunlu olduğundan). */
export const cloudTestParams = () => ["TEST", tl(0), "Test müşteri", "Test adresi", "Bu bir test bildirimidir", `${SITE}/admin`];

// ---------------- CallMeBot ----------------
export async function sendWhatsApp(phone: string, apikey: string, text: string) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone.replace(/\D/g, "")}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "SanalMarket/1.0" } });
  const body = (await res.text()).slice(0, 300);
  if (!res.ok || /error|invalid|not (been )?registered/i.test(body)) return { ok: false, error: `WhatsApp gönderilemedi: ${body.replace(/<[^>]+>/g, " ").trim()}` };
  return { ok: true };
}

/** Sipariş sonrası (after) çağrılır: panel kapalıysa e-posta + WhatsApp gönderir. */
export async function notifyNewOrder(payload: Payload): Promise<string | null> {
  if (payload.skip || !payload.order) return null;
  const results: string[] = [];
  const o = payload.order;
  const text = textBody(o);
  const jobs: Promise<unknown>[] = [];
  if (payload.email) {
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
      <h2 style="color:#e8732a;margin:0 0 8px">Yeni sipariş #${o.order_no} — ${tl(o.total)}</h2>
      <p><b>${esc(o.customer_name)}</b> · ${esc(o.phone)}<br>📍 ${esc(o.address)}${o.address_note ? ` (${esc(o.address_note)})` : ""}<br>🕒 ${esc(o.delivery_slot)} · ${pay(o.payment_method)}</p>
      ${o.items ? `<pre style="font-family:inherit;background:#f6f6f6;padding:10px;border-radius:8px">${esc(o.items)}</pre>` : ""}
      ${o.note ? `<p><b>Not:</b> ${esc(o.note)}</p>` : ""}
      <p><a href="${SITE}/admin/siparisler/${o.id}" style="background:#e8732a;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">Siparişi aç</a></p></div>`;
    jobs.push(
      sendEmail(payload.email, `🛒 Yeni sipariş #${o.order_no} — ${tl(o.total)}`, text, html)
        .then((r) => results.push(r.ok ? "E-posta: gönderildi" : `E-posta: ${r.error}`))
        .catch((e) => results.push(`E-posta: ${(e as Error).message}`)),
    );
  }
  if (payload.whatsapp_phone && hasWhatsAppCloud()) {
    const phone = payload.whatsapp_phone;
    const apikey = payload.callmebot_apikey;
    jobs.push(
      (async () => {
        const r = await sendWhatsAppCloudText(phone, text);
        if (r.ok) return results.push("WhatsApp (Meta, ücretsiz): gönderildi");
        if (r.windowClosed && templateFallbackEnabled()) {
          const t = await sendWhatsAppCloud(phone, cloudParams(o));
          return results.push(t.ok ? "WhatsApp (Meta şablon, ücretli): gönderildi" : t.error!);
        }
        if (r.windowClosed && apikey) {
          const c = await sendWhatsApp(phone, apikey, text);
          return results.push(
            `WhatsApp: 24 saatlik ücretsiz pencere kapalı → CallMeBot ile gönderildi${c.ok ? "" : ` (hata: ${c.error})`}. Pencereyi açmak için bot numarasına WhatsApp'tan bir mesaj yaz.`,
          );
        }
        results.push(r.windowClosed ? "WhatsApp: 24 saatlik ücretsiz pencere kapalı — bot numarasına WhatsApp'tan bir mesaj yaz." : r.error!);
      })().catch((e) => results.push(`WhatsApp (Meta): ${(e as Error).message}`)),
    );
  } else if (payload.whatsapp_phone && payload.callmebot_apikey) {
    jobs.push(
      sendWhatsApp(payload.whatsapp_phone, payload.callmebot_apikey, text)
        .then((r) => results.push(r.ok ? "WhatsApp: gönderildi" : `WhatsApp: ${r.error}`))
        .catch((e) => results.push(`WhatsApp: ${(e as Error).message}`)),
    );
  } else if (payload.whatsapp_phone || payload.callmebot_apikey) results.push("WhatsApp: numara veya anahtar eksik");
  await Promise.allSettled(jobs);
  if (!results.length) results.push("Bildirim hedefi yok (e-posta/WhatsApp ayarlanmamış)");
  const summary = `#${o.order_no} → ${results.join(" · ")}`;
  console.log("[bildirim]", summary);
  return summary;
}
