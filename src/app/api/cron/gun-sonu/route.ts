import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { runDailyReport } from "@/lib/dailyReport";

// Vercel Cron her gece kapanıştan sonra çağırır (vercel.json). Aynı gün için yalnızca bir kez gönderir.
// CRON_SECRET tanımlıysa Vercel "Authorization: Bearer <CRON_SECRET>" gönderir ve zorunlu tutulur.
export async function GET(req: Request) {
  await connection();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, status: "yetkisiz" }, { status: 401 });
  }
  const secret = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
  if (!secret) return Response.json({ ok: false, status: "WHATSAPP_VERIFY_TOKEN tanımlı değil (Vercel ortam değişkeni)." }, { status: 500 });
  const r = await runDailyReport(createPublicClient(), { secret });
  console.log("[gün sonu]", r.status);
  return Response.json({ ok: r.ok, status: r.status }, { headers: { "cache-control": "no-store" } });
}
