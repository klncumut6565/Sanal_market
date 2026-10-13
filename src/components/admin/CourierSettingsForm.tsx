"use client";
// Siparişler sayfası: kurye WhatsApp numarası. "Hazır · Kuryeye ver" seçilince sipariş mesajı bu numaraya gider.
import { useActionState } from "react";
import { Bike, Loader2 } from "lucide-react";
import { saveCourierSettings, testCourier, type ActionState } from "@/app/admin/actions";
import { displayPhone } from "@/lib/phone";
import { PhoneInput } from "@/components/PhoneInput";
import { BOT_NUMBER_DISPLAY, COURIER_REMINDER } from "@/lib/botNumber";
import { waLink } from "@/lib/whatsapp";

export function CourierSettingsForm({ phone, apikey, lastResult, courierToken }: { phone: string | null; apikey: string | null; lastResult: string | null; courierToken?: string | null }) {
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
          <div className="min-w-[220px] flex-1">
            <PhoneInput name="courier_phone" defaultValue={phone ?? ""} />
          </div>
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
        {courierToken && (
          <div className="space-y-1 rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-900 ring-1 ring-emerald-200">
            <b>Önerilen: Kurye uygulaması (günlük mesaj gerekmez, ücretsiz, anlık)</b>
            <p>Kurye bu bağlantıyı telefonunda açar → Ana Ekrana Ekle → simgeden açıp &quot;Bildirimleri aç&quot;. Siparişi &quot;Hazır · Kuryeye ver&quot; yapınca telefonuna bildirim düşer, adres ve harita sayfada görünür.</p>
            <CourierLink token={courierToken} phone={phone} />
          </div>
        )}
        {phone && (
          <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 ring-1 ring-amber-200">
            <b>Kuryeye hatırlatma:</b> {BOT_NUMBER_DISPLAY} numarasına her gün WhatsApp&apos;tan &quot;merhaba&quot; yazmalı, yoksa sipariş bildirimleri gelmez.
            Numara kaydedilince bu hatırlatma kuryeye otomatik gönderilir.{" "}
            <a href={waLink(phone, COURIER_REMINDER)} target="_blank" rel="noopener noreferrer" className="font-bold text-[#128c4a] underline">
              Hatırlatmayı kendi WhatsApp&apos;ımdan gönder
            </a>
          </div>
        )}
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

function CourierLink({ token, phone }: { token: string; phone: string | null }) {
  const url = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://sanalmarket.vercel.app").replace(/\/$/, "")}/kurye?k=${token}`;
  const text = `🛵 Sanal Market kurye sayfan: ${url}\nTelefonunda aç → (iPhone: Safari Paylaş → Ana Ekrana Ekle) → simgeden açıp "Bildirimleri aç"a dokun. Teslimatlar buraya bildirim olarak gelecek.`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="max-w-full truncate rounded bg-white px-1.5 py-0.5">{url}</code>
      {phone && (
        <a href={waLink(phone, text)} target="_blank" rel="noopener noreferrer" className="font-bold text-[#128c4a] underline">
          Bağlantıyı kuryeye WhatsApp&apos;tan gönder
        </a>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="font-bold underline">Aç</a>
    </div>
  );
}
