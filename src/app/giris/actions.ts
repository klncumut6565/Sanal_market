"use server";
import { redirect } from "next/navigation";
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

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: authErrorTR(error) };
  } catch (e) {
    console.error("[giris] signIn:", e);
    return { error: "Giriş şu an yapılamıyor. Lütfen biraz sonra tekrar dene." };
  }
  redirect(safeNext(fd.get("next")));
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

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {}
  redirect("/");
}
