import "server-only";
// Yeni sipariş bildirimleri: e-posta (Resend) + WhatsApp (CallMeBot).
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
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM?.trim() || "Sanal Market <onboarding@resend.dev>", to: [to], subject, text, html }),
  });
  if (!res.ok) return { ok: false, error: `E-posta gönderilemedi (${res.status}): ${(await res.text()).slice(0, 200)}` };
  return { ok: true };
}

export async function sendWhatsApp(phone: string, apikey: string, text: string) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url, { method: "GET" });
  const body = (await res.text()).slice(0, 300);
  if (!res.ok || /error|invalid|not (been )?registered/i.test(body)) return { ok: false, error: `WhatsApp gönderilemedi: ${body.replace(/<[^>]+>/g, " ").trim()}` };
  return { ok: true };
}

/** Sipariş sonrası (after) çağrılır: panel kapalıysa e-posta + WhatsApp gönderir. */
export async function notifyNewOrder(payload: Payload) {
  if (payload.skip || !payload.order) return;
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
    jobs.push(sendEmail(payload.email, `🛒 Yeni sipariş #${o.order_no} — ${tl(o.total)}`, text, html).then((r) => !r.ok && console.error("[bildirim] e-posta:", r.error)));
  }
  if (payload.whatsapp_phone && payload.callmebot_apikey) {
    jobs.push(sendWhatsApp(payload.whatsapp_phone, payload.callmebot_apikey, text).then((r) => !r.ok && console.error("[bildirim] whatsapp:", r.error)));
  }
  await Promise.allSettled(jobs);
}
