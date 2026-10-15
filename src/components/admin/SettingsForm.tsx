"use client";
import { useActionState } from "react";
import { saveSettings, type ActionState } from "@/app/admin/actions";
import type { StoreSettings } from "@/lib/types";
import { PhoneInput } from "@/components/PhoneInput";

export function SettingsForm({ settings: s }: { settings: StoreSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, {});
  return (
    <form action={action} className="space-y-4">
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="is_open" defaultChecked={s.is_open} className="h-5 w-5 accent-brand" /> Market açık (sipariş alınıyor)
        </label>
        <F label="Market adı"><input name="store_name" defaultValue={s.store_name} className="input" /></F>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <F label="Telefon"><input name="phone" defaultValue={s.phone ?? ""} className="input" /></F>
          <F label="Teslimat bölgesi notu"><input name="delivery_area_note" defaultValue={s.delivery_area_note ?? ""} className="input" /></F>
          <F label="İşletme WhatsApp numarası (müşterilerin 'WhatsApp'tan bize yaz' ile ulaştığı numara)"><PhoneInput name="whatsapp_phone" defaultValue={s.whatsapp_phone ?? ""} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Açılış saati"><input name="open_time" type="time" required defaultValue={s.open_time ?? "10:00"} className="input" /></F>
            <F label="Kapanış saati"><input name="close_time" type="time" required defaultValue={s.close_time ?? "01:00"} className="input" /></F>
          </div>
        </div>
        <F label="Adres"><textarea name="address" defaultValue={s.address ?? ""} className="input min-h-20" /></F>
        <fieldset className="space-y-3 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-extrabold">Yasal satıcı bilgileri</legend>
          <p className="text-xs text-muted">Mesafeli satış sözleşmesi ve ön bilgilendirme formunda &quot;Satıcı&quot; olarak görünür. Vergi levhasındaki bilgileri gir.</p>
          <F label="Yasal ünvan (şahıs şirketiyse ad soyad)"><input name="legal_name" defaultValue={s.legal_name ?? ""} placeholder="Ör. Ahmet Yılmaz veya ABC Gıda Ltd. Şti." className="input" /></F>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Vergi dairesi"><input name="tax_office" defaultValue={s.tax_office ?? ""} className="input" /></F>
            <F label="Vergi / T.C. kimlik no"><input name="tax_no" defaultValue={s.tax_no ?? ""} inputMode="numeric" className="input" /></F>
            <F label="MERSİS no (şirketse)"><input name="mersis_no" defaultValue={s.mersis_no ?? ""} inputMode="numeric" className="input" /></F>
            <F label="E-posta (şikâyet / cayma bildirimi)"><input name="contact_email" type="email" defaultValue={s.contact_email ?? ""} className="input" /></F>
          </div>
        </fieldset>
      </section>
      <section className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:grid-cols-3">
        <F label="Teslimat ücreti (₺)"><input name="delivery_fee" inputMode="decimal" defaultValue={s.delivery_fee} className="input" /></F>
        <F label="Ücretsiz teslimat eşiği (₺)"><input name="free_delivery_threshold" inputMode="decimal" defaultValue={s.free_delivery_threshold} className="input" /></F>
        <F label="Minimum sipariş (₺)"><input name="min_order_amount" inputMode="decimal" defaultValue={s.min_order_amount} className="input" /></F>
      </section>
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="voice_enabled" defaultChecked={s.voice_enabled ?? true} className="h-5 w-5 accent-brand" /> 🎙️ Sesli sipariş asistanı açık
        </label>
        <div className="grid grid-cols-2 gap-3">
          <F label="Günlük toplam oturum sınırı"><input name="voice_daily_limit" type="number" min={0} max={10000} defaultValue={s.voice_daily_limit ?? 300} className="input" /></F>
          <F label="Cihaz başına saatlik sınır"><input name="voice_hourly_per_user" type="number" min={0} max={100} defaultValue={s.voice_hourly_per_user ?? 8} className="input" /></F>
        </div>
        <p className="text-xs text-muted">Sınırlar Gemini kullanım maliyetini kontrol altında tutar. Bir oturum en fazla 10 dakika sürer.</p>
      </section>
      <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
        <p className="font-bold">Sipariş hedef süreleri (dakika)</p>
        <p className="text-xs text-muted">Siparişler panosundaki gösterge çubuğu bu sürelere göre yeşilden kırmızıya döner.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <F label="Onaylama"><input name="sla_accept_min" type="number" min={1} max={240} defaultValue={s.sla_accept_min ?? 2} className="input" /></F>
          <F label="Hazırlama"><input name="sla_prepare_min" type="number" min={1} max={240} defaultValue={s.sla_prepare_min ?? 7} className="input" /></F>
          <F label="Teslimat (yolda)"><input name="sla_delivery_min" type="number" min={1} max={240} defaultValue={s.sla_delivery_min ?? 20} className="input" /></F>
        </div>
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
