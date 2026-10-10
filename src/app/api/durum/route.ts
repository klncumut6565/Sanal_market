import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** Bağlantı teşhisi: gizli değer göstermez, sadece biçim kontrolü ve deneme sorgusu yapar. */
export async function GET() {
  await connection();
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const check = (v: string | undefined) =>
    v === undefined
      ? "YOK (değişken tanımlı değil)"
      : v !== v.trim()
        ? "HATALI: başında/sonunda boşluk var"
        : v.length === 0
          ? "BOŞ"
          : "var";

  const report: Record<string, unknown> = {
    NEXT_PUBLIC_SUPABASE_URL: check(rawUrl),
    url_gorunen: rawUrl ? rawUrl.trim().replace(/^(https:\/\/[a-z]{4})[a-z]+(\.supabase\.co.*)$/, "$1…$2") : null,
    url_bicim: rawUrl ? (/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(rawUrl.trim()) ? "doğru" : "HATALI biçim") : null,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: check(rawKey),
    key_bicim: rawKey ? (/^(sb_publishable_|eyJ)/.test(rawKey.trim()) ? `doğru (${rawKey.trim().length} karakter)` : "HATALI başlangıç") : null,
  };

  report.kullanilan = rawKey?.trim() ? "Vercel değişkenleri" : "koddaki yedek anahtar (Vercel'de anahtar eksik — sorun değil)";
  {
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
      const { count, error } = await sb.from("products").select("id", { count: "exact", head: true });
      report.veritabani = error ? `HATA: ${error.message || error.code}` : `bağlandı — ${count} ürün`;
    } catch (e) {
      report.veritabani = `HATA: ${(e as Error).message}`;
    }
  }

  return Response.json(report, { headers: { "cache-control": "no-store" } });
}
