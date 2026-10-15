// Meta WhatsApp webhook:
//  GET  → doğrulama (hub.verify_token = WHATSAPP_VERIFY_TOKEN)
//  POST → gelen mesajlar (24 saatlik ücretsiz pencereyi açar) + mesaj durumları.
//         Teslim edilemeyen ("failed") bildirimler CallMeBot ile yedek numaraya gönderilir.
import { after, connection, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { sendWhatsApp } from "@/lib/notify";
import { handleBotMessage, type InboundMessage } from "@/lib/waBot";

// Bot cevabı (yapay zekâ + araçlar) birkaç saniye sürebilir
export const maxDuration = 60;

const secret = () => process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";

export async function GET(req: NextRequest) {
  await connection();
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && secret() && p.get("hub.verify_token") === secret()) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

async function validSignature(raw: string, header: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!appSecret) return true; // isteğe bağlı: tanımlıysa imza zorunlu
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
  return hex === header.slice(7);
}

type Change = {
  value?: {
    messages?: {
      from?: string;
      id?: string;
      type?: string;
      text?: { body?: string };
      button?: { text?: string };
      interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
    }[];
    contacts?: { wa_id?: string; profile?: { name?: string } }[];
    statuses?: { id?: string; status?: string; errors?: { code?: number; title?: string; message?: string }[] }[];
  };
};

export async function POST(req: NextRequest) {
  await connection();
  if (!secret()) return new Response("not configured", { status: 503 });
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) return new Response("bad signature", { status: 401 });

  let body: { entry?: { changes?: Change[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok");
  }
  const inbound: string[] = [];
  const botMsgs: InboundMessage[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const e of body.entry ?? [])
    for (const c of e.changes ?? []) {
      for (const m of c.value?.messages ?? []) {
        if (!m.from) continue;
        inbound.push(m.from);
        if (m.id)
          botMsgs.push({
            from: m.from,
            id: m.id,
            type: m.type ?? "",
            name: c.value?.contacts?.find((k) => k.wa_id === m.from)?.profile?.name,
            text: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title,
          });
      }
      for (const s of c.value?.statuses ?? [])
        if (s.status === "failed" && s.id) {
          const er = s.errors?.[0];
          failed.push({ id: s.id, error: `${er?.code ?? ""} ${er?.title ?? er?.message ?? ""}`.trim() });
        }
    }

  // WhatsApp sipariş botu: Meta'ya hemen 200 dön, cevabı arkada hazırla (aynı mesaj tekrar gelirse veritabanı eler)
  for (const m of botMsgs) after(() => handleBotMessage(m).catch((e) => console.error("[wa bot]", e)));
  const { data, error } = await createPublicClient().rpc("wa_ingest", { p_secret: secret(), p_inbound: inbound, p_failed: failed });
  if (error) {
    console.error("[whatsapp webhook]", error.message);
    return new Response("ok"); // Meta'nın tekrar tekrar denemesini önle
  }
  // Teslim edilemeyenler → CallMeBot yedeği
  for (const f of (data ?? []) as { phone: string; apikey: string; body: string; error: string }[]) {
    try {
      const r = await sendWhatsApp(f.phone, f.apikey, f.body);
      console.log("[whatsapp webhook] yedek", f.phone, r.ok ? "gönderildi" : r.error, "| Meta hatası:", f.error);
    } catch (e) {
      console.error("[whatsapp webhook] yedek hata", e);
    }
  }
  return new Response("ok");
}
