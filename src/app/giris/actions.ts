"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string };

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/siparislerim";
};

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email") ?? "").trim(),
    password: String(fd.get("password") ?? ""),
  });
  if (error) return { error: "E-posta veya şifre hatalı." };
  redirect(safeNext(fd.get("next")));
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: String(fd.get("email") ?? "").trim(),
    password,
    options: {
      data: { full_name: String(fd.get("full_name") ?? "").trim(), phone: String(fd.get("phone") ?? "").trim() },
      emailRedirectTo: site ? `${site}/auth/confirm` : undefined,
    },
  });
  if (error) return { error: error.message.includes("registered") ? "Bu e-posta zaten kayıtlı." : "Kayıt oluşturulamadı." };
  if (!data.session) return { info: "Kayıt oluşturuldu. E-postana gelen bağlantıyla hesabını doğrula." };
  redirect(safeNext(fd.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
