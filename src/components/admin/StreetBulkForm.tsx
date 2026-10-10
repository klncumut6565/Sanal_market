"use client";
import { useActionState, useRef, useEffect } from "react";
import { addStreets, type ActionState } from "@/app/admin/actions";

export function StreetBulkForm({ neighborhoodId }: { neighborhoodId: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addStreets, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="neighborhood_id" value={neighborhoodId} />
      <textarea name="names" required placeholder={"Atatürk Caddesi\nGül Sokak\n1. Sokak"} className="input min-h-36 font-mono text-sm" />
      {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}
      {state.ok && <p className="text-sm font-semibold text-emerald-700">{state.ok}</p>}
      <button disabled={pending} className="btn-primary">Ekle</button>
    </form>
  );
}
