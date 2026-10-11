"use client";
import { useActionState } from "react";
import { BellRing, Loader2, Mail, MessageCircle } from "lucide-react";
import { saveNotifySettings, testNotify, type ActionState } from "@/app/admin/actions";
import { displayPhone } from "@/lib/phone";

type N = {
  email: string | null;
  whatsapp_phone: string | null;
  callmebot_apikey: string | null;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  only_when_away: boolean;
  admin_last_seen: string | null;
};

export function NotifySettingsForm({ n, hasResendKey, panelOpen }: { n: N; hasResendKey: boolean; panelOpen: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveNotifySettings, {});
  const [tState, tAction, tPending] = useActionState<ActionState, FormData>(testNotify, {});
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <BellRing size={20} className="text-brand" /> Sipariş bildirimleri
      </h2>
      <p className="text-sm text-muted">Yönetim paneli kapalıyken gelen her yeni sipariş, aşağıdaki e-posta adresine ve WhatsApp numarasına otomatik bildirilir.</p>

      <form action={action} className="space-y-3">
        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold"><Mail size={15} /> İşyeri e-posta adresi</span>
          <input name="email" type="email" defaultValue={n.email ?? ""} placeholder="ornek@siam.com.tr" className="input" />
        </label>
        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold"><MessageCircle size={15} /> Bildirim WhatsApp numarası</span>
          <input name="whatsapp_phone" type="tel" defaultValue={n.whatsapp_phone ? displayPhone(n.whatsapp_phone) : ""} placeholder="+90 5xx xxx xx xx" className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">CallMeBot WhatsApp anahtarı (apikey)</span>
          <input name="callmebot_apikey" defaultValue={n.callmebot_apikey ?? ""} placeholder="ör. 1234567" autoComplete="off" className="input font-mono" />
        </label>
        <details className="rounded-xl bg-bg p-3 text-sm">
          <summary className="cursor-pointer font-semibold">WhatsApp anahtarı nasıl alınır? (1 dakika, ücretsiz)</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Telefonunun rehberine <b>+34 644 51 95 23</b> numarasını ekle (CallMeBot).</li>
            <li>Bu numaraya WhatsApp&apos;tan <b>I allow callmebot to send me messages</b> yaz.</li>
            <li>Gelen cevaptaki <b>apikey</b> numarasını yukarıya yaz ve kaydet, sonra &quot;WhatsApp test&quot; ile dene.</li>
          </ol>
          <p className="mt-2 text-xs text-muted">Not: Numara değişmiş olabilir; güncel numara callmebot.com sitesindeki WhatsApp sayfasında yazar.</p>
        </details>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="checkbox" name="email_enabled" defaultChecked={n.email_enabled} className="h-4 w-4 accent-brand" /> E-posta gönder</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="whatsapp_enabled" defaultChecked={n.whatsapp_enabled} className="h-4 w-4 accent-brand" /> WhatsApp gönder</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="only_when_away" defaultChecked={n.only_when_away} className="h-4 w-4 accent-brand" /> Yalnızca panel kapalıyken</label>
        </div>

        {state.error && <p className="rounded-lg bg-brand-soft p-2.5 text-sm font-semibold text-brand">{state.error}</p>}
        {state.ok && <p className="rounded-lg bg-emerald-50 p-2.5 text-sm font-semibold text-emerald-700">{state.ok}</p>}
        <button disabled={pending} className="btn-primary">{pending && <Loader2 size={16} className="animate-spin" />} Bildirim ayarlarını kaydet</button>
      </form>

      <form action={tAction} className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button name="kanal" value="email" disabled={tPending} className="btn-ghost py-2 text-sm"><Mail size={15} /> E-posta test</button>
        <button name="kanal" value="whatsapp" disabled={tPending} className="btn-ghost py-2 text-sm"><MessageCircle size={15} /> WhatsApp test</button>
        {tPending && <Loader2 size={18} className="animate-spin self-center text-brand" />}
      </form>
      {tState.error && <p className="rounded-lg bg-brand-soft p-2.5 text-sm font-semibold text-brand">{tState.error}</p>}
      {tState.ok && <p className="rounded-lg bg-emerald-50 p-2.5 text-sm font-semibold text-emerald-700">{tState.ok}</p>}

      {!hasResendKey && (
        <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
          E-posta için Vercel&apos;e <b>RESEND_API_KEY</b> ortam değişkeni eklenmeli (resend.com, ücretsiz). Alan adı doğrulamadan yalnızca Resend hesabını açtığın e-posta
          adresine gönderilebilir — işyeri adresiyle hesap açman yeterli.
        </p>
      )}
      <p className="text-xs text-muted">
        Panel durumu:{" "}
        {panelOpen ? (
          <b className="text-emerald-700">açık (bildirim gönderilmez)</b>
        ) : (
          <b>kapalı</b>
        )}
        . Panel açık bir sekmede her dakika &quot;buradayım&quot; sinyali verir; 2 dakika sinyal gelmezse kapalı sayılır.
      </p>
    </section>
  );
}
