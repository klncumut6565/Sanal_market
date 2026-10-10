"use client";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { PhoneInput } from "@/components/PhoneInput";

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "in" ? inState : upState;
  const pending = mode === "in" ? inPending : upPending;

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
      <p className="mt-3 text-center text-xs text-muted">Üye olmadan da sipariş verebilirsin.</p>
    </div>
  );
}
