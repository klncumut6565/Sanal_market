"use client";
import { useActionState } from "react";
import { saveSettings, type ActionState } from "@/app/admin/actions";
import type { StoreSettings } from "@/lib/types";

export function SettingsForm({ settings: s }: { settings: StoreSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, {});
  return (
    <form action={action} className="space-y-4">
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="is_open" defaultChecked={s.is_open} className="h-5 w-5 accent-brand" /> Market açık (sipariş alınıyor)
        </label>
        <F label="Market adı"><input name="store_name" defaultValue={s.store_name} className="input" /></F>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Telefon"><input name="phone" defaultValue={s.phone ?? ""} className="input" /></F>
          <F label="Teslimat bölgesi notu"><input name="delivery_area_note" defaultValue={s.delivery_area_note ?? ""} className="input" /></F>
          <F label="Çalışma saatleri (sitede görünür)"><input name="working_hours" defaultValue={s.working_hours ?? ""} placeholder="10:00 - 01:00" className="input" /></F>
        </div>
        <F label="Adres"><textarea name="address" defaultValue={s.address ?? ""} className="input min-h-20" /></F>
      </section>
      <section className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:grid-cols-3">
        <F label="Teslimat ücreti (₺)"><input name="delivery_fee" inputMode="decimal" defaultValue={s.delivery_fee} className="input" /></F>
        <F label="Ücretsiz teslimat eşiği (₺)"><input name="free_delivery_threshold" inputMode="decimal" defaultValue={s.free_delivery_threshold} className="input" /></F>
        <F label="Minimum sipariş (₺)"><input name="min_order_amount" inputMode="decimal" defaultValue={s.min_order_amount} className="input" /></F>
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <F label="Teslimat saatleri (her satıra bir seçenek)">
          <textarea name="delivery_slots" defaultValue={s.delivery_slots.join("\n")} className="input min-h-40 font-mono text-sm" />
        </F>
      </section>
      {state.error && <p className="rounded-lg bg-brand-soft p-3 text-sm font-semibold text-brand">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{state.ok}</p>}
      <button disabled={pending} className="btn-primary">Kaydet</button>
    </form>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
