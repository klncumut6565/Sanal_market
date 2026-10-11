"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { updatePassword, type AuthState } from "@/app/giris/actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="space-y-3">
      <div className="relative">
        <input name="password" type={show ? "text" : "password"} required minLength={8} placeholder="Yeni şifre (en az 8 karakter)" autoComplete="new-password" className="input pr-11!" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <input name="password2" type={show ? "text" : "password"} required minLength={8} placeholder="Yeni şifre (tekrar)" autoComplete="new-password" className="input" />
      {state.error && <p className="rounded-lg bg-brand-soft p-2.5 text-sm font-semibold text-brand">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Kaydediliyor…" : "Şifreyi kaydet"}</button>
    </form>
  );
}
