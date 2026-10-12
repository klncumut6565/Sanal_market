"use client";
import { useActionState, useState } from "react";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { signIn, signUp, type AuthState } from "./actions";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { authErrorTR } from "@/lib/auth-errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Şifre yenileme e-postası. "implicit" akış: bağlantı hangi tarayıcıda/uygulamada
 *  açılırsa açılsın çalışır (PKCE'de isteğin yapıldığı tarayıcı gerekir). */
async function sendResetMail(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Geçerli bir e-posta adresi gir." };
  try {
    const sb = createPlainClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } });
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/sifre-yenile` });
    if (error) {
      const msg = authErrorTR(error);
      if (msg.startsWith("Çok fazla")) return { error: "Kısa sürede çok fazla istek yapıldı. Lütfen biraz sonra tekrar dene." };
      console.error("[giris] reset:", error);
    }
  } catch {
    return { error: "Şu an e-posta gönderilemiyor. İnternet bağlantını kontrol edip tekrar dene." };
  }
  return {
    info: "Bu e-postaya kayıtlı bir hesap varsa şifre yenileme bağlantısı gönderdik. Gelen kutunu (gereksiz/spam dahil) kontrol et; bağlantı 1 saat geçerli.",
  };
}
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PhoneInput } from "@/components/PhoneInput";

export function AuthForm({ next, admin = false }: { next: string; admin?: boolean }) {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});
  const [fState, fAction, fPending] = useActionState<AuthState, FormData>(sendResetMail, {});

  if (mode === "forgot")
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <h1 className="text-lg font-extrabold">Şifremi unuttum</h1>
        <p className="mb-3 mt-1 text-sm text-muted">Üye olurken kullandığın e-postayı yaz; şifreni yenilemen için bir bağlantı gönderelim.</p>
        <form action={fAction} className="space-y-3">
          <input name="email" type="email" required placeholder="E-posta" autoComplete="email" className="input" />
          {fState.error && <p className="rounded-lg bg-brand-soft p-2.5 text-sm font-semibold text-brand">{fState.error}</p>}
          {fState.info && <p className="rounded-lg bg-emerald-50 p-2.5 text-sm font-semibold text-emerald-700">{fState.info}</p>}
          <button disabled={fPending} className="btn-primary w-full">{fPending ? "Gönderiliyor…" : "Yenileme bağlantısı gönder"}</button>
        </form>
        <button type="button" onClick={() => setMode("in")} className="mt-3 w-full text-center text-sm font-semibold text-brand">
          ← Girişe dön
        </button>
      </div>
    );

  const state = mode === "in" ? inState : upState;
  const pending = mode === "in" ? inPending : upPending;

  if (admin)
    return (
      <div className="rounded-2xl bg-ink p-5 text-white">
        <h1 className="flex items-center gap-2 text-lg font-extrabold">
          <ShieldCheck size={20} className="text-brand" /> Yönetici girişi
        </h1>
        <p className="mb-3 mt-1 text-sm opacity-75">Yönetim paneline yalnızca yetkili hesaplar girebilir. Yetkin yoksa giriş yaptığında talebin market sahibine iletilir.</p>
        <form action={inAction} className="space-y-3">
          <input type="hidden" name="next" value="/admin" />
          <input type="hidden" name="admin" value="1" />
          <input name="email" type="email" required placeholder="E-posta" autoComplete="email" className="input text-ink" />
          <input name="password" type="password" required placeholder="Şifre" autoComplete="current-password" className="input text-ink" />
          {inState.error && <p className="rounded-lg bg-red-500/20 p-2.5 text-sm font-semibold text-red-100">{inState.error}</p>}
          {inState.info && <p className="rounded-lg bg-white/10 p-2.5 text-sm font-semibold text-amber-200">{inState.info}</p>}
          <button disabled={inPending} className="btn-primary w-full">{inPending ? "Kontrol ediliyor…" : "Yönetim paneline gir"}</button>
        </form>
        <Link href="/giris" className="mt-3 block text-center text-sm font-semibold text-white/70 hover:text-white">
          ← Müşteri girişi
        </Link>
      </div>
    );

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-bg p-1 text-sm font-bold">
        {(["in", "up"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-lg py-2 ${mode === m ? "bg-white shadow-sm" : "text-muted"}`}>
            {m === "in" ? "Giriş yap" : "Üye ol"}
          </button>
        ))}
      </div>
      <form action={mode === "in" ? inAction : upAction} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        {mode === "up" && (
          <>
            <input name="full_name" required placeholder="Ad soyad" autoComplete="name" className="input" />
            <PhoneInput name="phone" required />
          </>
        )}
        <input name="email" type="email" required placeholder="E-posta" autoComplete="email" className="input" />
        <input name="password" type="password" required placeholder="Şifre" autoComplete={mode === "in" ? "current-password" : "new-password"} className="input" />
        {state.error && <p className="rounded-lg bg-brand-soft p-2.5 text-sm font-semibold text-brand">{state.error}</p>}
        {state.info && <p className="rounded-lg bg-bg p-2.5 text-sm font-semibold text-ok">{state.info}</p>}
        <button disabled={pending} className="btn-primary w-full">{mode === "in" ? "Giriş yap" : "Üye ol"}</button>
      </form>
      {mode === "in" && (
        <button type="button" onClick={() => setMode("forgot")} className="mt-3 w-full text-center text-sm font-semibold text-brand">
          Şifremi unuttum
        </button>
      )}
      <p className="mt-3 text-center text-xs text-muted">Üye olmadan da sipariş verebilirsin.</p>
      {mode === "in" && (
        <Link href="/giris?yonetici=1" className="mt-3 flex items-center justify-center gap-1.5 border-t border-line pt-3 text-xs font-bold text-muted hover:text-ink">
          <ShieldCheck size={14} /> Yönetici girişi
        </Link>
      )}
      {mode === "up" && (
        <p className="mt-1 text-center text-xs text-muted">
          Üye olarak <a href="/kvkk" target="_blank" className="font-semibold text-brand underline">KVKK Aydınlatma Metni</a>&apos;ni okuduğunu kabul edersin.
        </p>
      )}
    </div>
  );
}
