// Sesli asistan oturumu: kalıcı GEMINI_API_KEY ile Google'dan kısa ömürlü (tek kullanımlık)
// token alır ve tarayıcıya verir. Kalıcı anahtar tarayıcıya ASLA gitmez.
// (TMGD Asistan'daki /api/assistant/realtime/session ile aynı akış; müşteriye açık olduğu için
//  ek olarak cihaz başına saatlik ve günlük toplam oturum sınırı uygulanır.)
import { connection, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

const TOKEN_DK = 15;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  await connection();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return json({ error: "Sesli asistan henüz etkinleştirilmedi." }, 503);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "bilinmiyor";
  const clientKey = await sha256(`sanal-market:${ip}`);
  const { data: izin, error: izinHata } = await createPublicClient().rpc("voice_session_allow", { p_client_key: clientKey });
  if (izinHata) return json({ error: "Sesli asistan şu an kullanılamıyor." }, 503);
  if (izin === "kapali") return json({ error: "Sesli asistan şu an kapalı." }, 403);
  if (izin === "saatlik") return json({ error: "Kısa sürede çok fazla sesli oturum açıldı. Biraz sonra tekrar dene." }, 429);
  if (izin === "gunluk") return json({ error: "Sesli asistan bugünlük yoğun. Ürünleri arama kutusundan bulabilirsin." }, 429);

  const expireTime = new Date(Date.now() + TOKEN_DK * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const govde = JSON.stringify({ uses: 1, expireTime });
  const hatalar: string[] = [];
  for (const surum of ["v1beta", "v1alpha"]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/${surum}/auth_tokens`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: govde,
      });
      if (res.ok) {
        const j = (await res.json()) as { name?: string; expireTime?: string };
        if (!j.name) break;
        return json({ sessionId: crypto.randomUUID(), token: j.name, expiresAt: j.expireTime ?? expireTime, apiVersion: surum });
      }
      hatalar.push(`${surum}: ${res.status}`);
    } catch (e) {
      hatalar.push(`${surum}: ${(e as Error).message}`);
    }
  }
  console.error("[sesli-asistan] token alınamadı:", hatalar.join(" | "));
  return json({ error: "Sesli asistana şu an bağlanılamıyor. Biraz sonra tekrar dene." }, 502);
}
