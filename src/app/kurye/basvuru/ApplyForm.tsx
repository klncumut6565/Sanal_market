"use client";
import { useActionState } from "react";
import { applyCourier, type ApplyState } from "../actions";
import { VEHICLES } from "@/lib/courierShared";


export function ApplyForm({ vehicle, plate, again }: { vehicle: string; plate: string; again: boolean }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyCourier, {});
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <label className="block text-sm font-semibold">
        Araç
        <select name="vehicle" defaultValue={vehicle} className="input mt-1">
          {VEHICLES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Plaka (varsa)
        <input name="plate" defaultValue={plate} placeholder="59 ABC 123" className="input mt-1 uppercase" />
      </label>
      {state.error && <p className="rounded-lg bg-brand-soft p-2.5 text-sm font-semibold text-brand">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-emerald-50 p-2.5 text-sm font-semibold text-emerald-700">{state.ok}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "Gönderiliyor…" : again ? "Başvuruyu güncelle / yeniden gönder" : "Kurye olarak başvur"}
      </button>
    </form>
  );
}
