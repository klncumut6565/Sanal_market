/** Supabase Auth hata kodlarını müşteriye gösterilecek Türkçe mesajlara çevirir. */
export function authErrorTR(err: { code?: string; message?: string; status?: number } | null | undefined): string {
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials"))
    return "E-posta veya şifre hatalı.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed"))
    return "E-posta adresin henüz doğrulanmadı. Gelen kutundaki (gereksiz/spam klasörü dahil) doğrulama bağlantısına tıkla.";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered"))
    return "Bu e-posta zaten kayıtlı. “Giriş yap” sekmesinden giriş yapabilirsin.";
  if (code === "weak_password" || msg.includes("password should be"))
    return "Şifre çok zayıf. En az 8 karakter, harf ve rakam içeren bir şifre seç.";
  if (code === "email_address_invalid" || code === "validation_failed" || msg.includes("invalid format") || msg.includes("is invalid"))
    return "Geçerli bir e-posta adresi gir.";
  if (code.startsWith("over_") || err?.status === 429 || msg.includes("rate limit"))
    return "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.";
  if (code === "same_password" || msg.includes("should be different"))
    return "Yeni şifre eskisiyle aynı olamaz.";
  if (code === "session_not_found" || code === "session_expired" || msg.includes("auth session missing"))
    return "Şifre yenileme bağlantısının süresi dolmuş. Lütfen yeniden bağlantı iste.";
  if (code === "signup_disabled") return "Yeni üyelik şu an kapalı.";
  if (code === "user_banned") return "Bu hesap kullanıma kapatılmış.";
  if (code === "email_address_not_authorized")
    return "Bu e-posta adresine şu an doğrulama e-postası gönderilemiyor. Lütfen farklı bir adres dene veya bizimle iletişime geç.";
  if (msg.includes("fetch") || msg.includes("network"))
    return "Sunucuya bağlanılamadı. İnternet bağlantını kontrol edip tekrar dene.";
  return "Bir sorun oluştu, lütfen tekrar dene.";
}
