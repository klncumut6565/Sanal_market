"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { authErrorTR } from "@/lib/auth-errors";
import { normalizeTrMobile } from "@/lib/phone";

export type AuthState = { error?: string; info?: string };

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/siparislerim";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!EMAIL_RE.test(email)) return { error: "Geçerli bir e-posta adresi gir." };
  if (!password) return { error: "Şifreni gir." };

  const adminLogin = fd.get("admin") === "1";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: authErrorTR(error) };
    if (adminLogin) {
      // Yönetici girişi: yetkisi yoksa talep oluştur, kurucu onaylayınca panel açılır
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (prof?.role !== "admin") {
        const { error: reqErr } = await supabase.rpc("request_admin_access");
        if (reqErr) console.error("[giris] admin talebi:", reqErr.message);
        return {
          info: "Bu hesabın yönetici yetkisi yok. Yetki talebin market sahibine iletildi; onaylandığında bu ekrandan giriş yapıp yönetim paneline geçebilirsin.",
        };
      }
    }
  } catch (e) {
    console.error("[giris] signIn:", e);
    return { error: "Giriş şu an yapılamıyor. Lütfen biraz sonra tekrar dene." };
  }
  redirect(adminLogin ? "/admin" : safeNext(fd.get("next")));
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const fullName = String(fd.get("full_name") ?? "").trim();
  if (fullName.length < 3) return { error: "Ad soyad gir." };
  const phone = normalizeTrMobile(String(fd.get("phone") ?? ""));
  if (!phone) return { error: "Geçerli bir cep telefonu gir (ör. +90 541 673 58 63)." };
  if (!EMAIL_RE.test(email)) return { error: "Geçerli bir e-posta adresi gir." };
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };

  try {
    const supabase = await createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: site ? `${site}/auth/confirm` : undefined,
      },
    });
    if (error) return { error: authErrorTR(error) };
    // Supabase, kayıtlı e-postaya tekrar kayıt denendiğinde hata yerine boş kimlikli kullanıcı döner
    if (data.user && data.user.identities?.length === 0)
      return { error: "Bu e-posta zaten kayıtlı. “Giriş yap” sekmesinden giriş yapabilirsin." };
    if (!data.session)
      return { info: "Kayıt oluşturuldu! E-postana gelen doğrulama bağlantısına tıkla, sonra giriş yap. (Gelmediyse gereksiz/spam klasörüne bak.)" };
  } catch (e) {
    console.error("[giris] signUp:", e);
    return { error: "Kayıt şu an yapılamıyor. Lütfen biraz sonra tekrar dene." };
  }
  redirect(safeNext(fd.get("next")));
}

async function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "sanalmarket.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** "Şifremi unuttum": e-postaya şifre yenileme bağlantısı gönderir.
 *  Hesap olup olmadığını belli etmemek için her durumda aynı mesaj gösterilir. */
export async function requestPasswordReset(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Geçerli bir e-posta adresi gir." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteOrigin()}/auth/confirm?next=/sifre-yenile`,
    });
    if (error) {
      const msg = authErrorTR(error);
      if (msg.startsWith("Çok fazla")) return { error: msg };
      console.error("[giris] reset:", error.code, error.message);
    }
  } catch (e) {
    console.error("[giris] reset:", e);
    return { error: "Şu an e-posta gönderilemiyor. Lütfen biraz sonra tekrar dene." };
  }
  return {
    info: "Bu e-postaya kayıtlı bir hesap varsa şifre yenileme bağlantısı gönderdik. Gelen kutunu (gereksiz/spam dahil) kontrol et; bağlantı 1 saat geçerli.",
  };
}

/** Yenileme bağlantısıyla açılan oturumda yeni şifreyi kaydeder. */
export async function updatePassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const password = String(fd.get("password") ?? "");
  const again = String(fd.get("password2") ?? "");
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  if (password !== again) return { error: "Şifreler aynı değil." };
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { error: "Şifre yenileme bağlantısının süresi dolmuş. Lütfen yeniden bağlantı iste." };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: authErrorTR(error) };
  } catch (e) {
    console.error("[giris] updatePassword:", e);
    return { error: "Şifre şu an değiştirilemiyor. Lütfen biraz sonra tekrar dene." };
  }
  redirect("/siparislerim?sifre=yenilendi");
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {}
  redirect("/");
}
