import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** E-posta bağlantıları: üyelik doğrulama ve şifre yenileme (recovery).
 *  Hem token_hash (her tarayıcıda çalışır) hem de code (PKCE) biçimi desteklenir. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "";
  const recovery = type === "recovery" || rawNext === "/sifre-yenile";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : recovery ? "/sifre-yenile" : "/siparislerim";
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${recovery ? "/sifre-yenile" : next}`);
  }
  return NextResponse.redirect(`${origin}${recovery ? "/sifre-yenile?hata=suresi-doldu" : "/giris"}`);
}
