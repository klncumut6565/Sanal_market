"use client";
// Siparişler sayfası: kurye WhatsApp numarası. "Hazır · Kuryeye ver" seçilince sipariş mesajı bu numaraya gider.
import { useActionState } from "react";
import { Bike, Loader2 } from "lucide-react";
import { saveCourierSettings, testCourier, type ActionState } from "@/app/admin/actions";
import { displayPhone } from "@/lib/phone";

export function CourierSettingsForm({ phone, apikey, lastResult }: { phone: string | null; apikey: string | null; lastResult: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCourierSettings, {});
  const [tState, tAction, tPending] = useActionState<ActionState, FormData>(testCourier, {});
  return (
    <details className="rounded-2xl bg-white p-3 ring-1 ring-line" open={!phone}>
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold">
        <Bike size={18} className="text-brand" /> Kurye WhatsApp:
        <span className={phone ? "" : "text-brand"}>{phone ? displayPhone(phone) : "numara girilmedi"}</span>
      </summary>
      <form action={action} className="mt-3 space-y-2">
        <p className="text-xs text-muted">
          Siparişte <b>Hazır · Kuryeye ver</b> seçilince sipariş mesajı (ürünler, adres, harita bağlantısı) bu numaraya WhatsApp&apos;tan otomatik gider.
        </p>
        <div className="flex flex-wrap gap-2">
          <input name="courier_phone" type="tel" defaultValue={phone ? displayPhone(phone) : ""} placeholder="Kurye no: +90 5xx xxx xx xx" className="input min-w-0 flex-1" />
          <input name="courier_apikey" defaultValue={apikey ?? ""} placeholder="Kuryenin CallMeBot anahtarı (isteğe bağlı)" autoComplete="off" className="input min-w-0 flex-1 font-mono" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={pending} className="btn-primary py-2 text-sm">{pending && <Loader2 size={15} className="animate-spin" />} Kaydet</button>
          <button formAction={tAction} formNoValidate disabled={tPending} className="btn-ghost py-2 text-sm">
            {tPending && <Loader2 size={15} className="animate-spin" />} Kuryeye test mesajı
          </button>
        </div>
        {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}
        {state.ok && <p className="text-sm font-semibold text-ok">{state.ok}</p>}
        {tState.error && <p className="text-sm font-semibold text-brand">{tState.error}</p>}
        {tState.ok && <p className="text-sm font-semibold text-ok">{tState.ok}</p>}
        {lastResult && <p className="rounded-lg bg-bg p-2 text-xs"><b>Son kurye mesajı:</b> {lastResult}</p>}
        <details className="text-xs text-muted">
          <summary className="cursor-pointer font-semibold">Kurye mesajı nasıl gider?</summary>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Önce Meta ile anlık gider: kurye numarası Meta&apos;daki alıcı listesine eklenmiş ve kurye son 24 saatte <b>+1 555 157 4236</b>&apos;ya mesaj yazmış olmalı.</li>
            <li>Gitmezse kuryenin CallMeBot anahtarıyla (birkaç dk gecikmeli) gider. Kurye kendi telefonundan CallMeBot&apos;a <i>I allow callmebot to send me messages</i> yazıp gelen anahtarı sana verir.</li>
            <li>Her durumda sipariş detayındaki <b>Kuryeye WhatsApp&apos;tan gönder</b> butonuyla tek dokunuşla kendin de gönderebilirsin.</li>
          </ul>
        </details>
      </form>
    </details>
  );
}
