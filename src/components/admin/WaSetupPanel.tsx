"use client";
import { useState, useTransition } from "react";
import { Copy, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { waSetupAction } from "@/app/admin/actions";
import type { WaSetupStatus } from "@/lib/waSetup";

const Ok = ({ ok, children }: { ok: boolean | undefined; children: React.ReactNode }) => (
  <li className={ok ? "text-emerald-700" : "text-amber-700"}>
    {ok ? "✅" : "⬜"} {children}
  </li>
);

function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 font-semibold text-muted">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 ring-1 ring-line">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          });
        }}
        className="flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-brand hover:bg-brand-soft"
      >
        <Copy size={13} /> {done ? "Kopyalandı" : "Kopyala"}
      </button>
    </div>
  );
}

/** WhatsApp botunun Meta bağlantısını panelden kurar: abonelik + webhook kaydı + durum kontrolü. */
export function WaSetupPanel({ verifyToken, webhookSeen }: { verifyToken: string | null; webhookSeen: boolean }) {
  const [status, setStatus] = useState<WaSetupStatus | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (step: "durum" | "abone" | "webhook") =>
    start(async () => {
      const r = await waSetupAction(step);
      setStatus(r.status);
      setMsg(r.result);
    });

  const digits = status?.number?.display?.replace(/\D/g, "");
  return (
    <div className="space-y-2.5 rounded-xl border border-line bg-bg/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-extrabold">
          <PlugZap size={16} className="text-brand" /> Bağlantı kurulumu (Meta)
        </p>
        <button type="button" disabled={pending} onClick={() => run("durum")} className="btn-ghost py-1.5 text-xs">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Durumu kontrol et
        </button>
      </div>

      {status && (
        <ul className="space-y-0.5 text-xs">
          <Ok ok={status.env.token && status.env.phoneId}>WhatsApp anahtarları (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)</Ok>
          <Ok ok={!!status.number?.display}>
            Bot numarası: {status.number?.display ? <b>{status.number.display}</b> : status.number?.error ?? "okunamadı"}
            {status.number?.name ? ` · ${status.number.name}` : ""}
          </Ok>
          <Ok ok={status.env.verifyToken}>Doğrulama anahtarı (WHATSAPP_VERIFY_TOKEN)</Ok>
          <Ok ok={status.subscribed?.ok}>
            İşletme hesabı uygulamaya abone {status.subscribed?.ok ? `(${status.subscribed.apps.join(", ")})` : status.subscribed?.error ? `değil — ${status.subscribed.error}` : "değil"}
          </Ok>
          <Ok ok={webhookSeen}>Meta&apos;dan en az bir bildirim geldi {webhookSeen ? "" : "(abonelik + webhook sonrası bota bir mesaj yazınca işaretlenir)"}</Ok>
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run("abone")} className="btn-primary py-2 text-sm">
          1) Aboneliği yap
        </button>
        <button type="button" disabled={pending} onClick={() => run("webhook")} className="btn-ghost py-2 text-sm">
          2) Webhook adresini kaydet
        </button>
      </div>
      {msg && <p className={`rounded-lg p-2 text-xs font-semibold ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-brand-soft text-brand"}`}>{msg.message}</p>}

      <details className="text-xs">
        <summary className="cursor-pointer font-bold text-muted">2. adım için Meta panelinden elle kurulum (WHATSAPP_APP_ID yoksa)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>developers.facebook.com → uygulaman → WhatsApp → <b>Configuration</b> → Webhook → <b>Edit</b>.</li>
          <li>Aşağıdaki iki değeri kopyalayıp yapıştır → <b>Verify and save</b>.</li>
          <li>Webhook fields listesinde <b>messages</b> satırında <b>Subscribe</b>.</li>
        </ol>
        <div className="mt-2 space-y-1.5">
          <CopyField label="Callback URL" value={status?.webhookUrl ?? "…/api/whatsapp/webhook (önce Durumu kontrol et)"} />
          {verifyToken && <CopyField label="Verify token" value={verifyToken} />}
        </div>
      </details>

      {digits && (
        <p className="text-xs">
          Deneme: <b>başka bir telefondan</b> (bildirim numaraların değil){" "}
          <a href={`https://wa.me/${digits}?text=${encodeURIComponent("Merhaba, 2 ekmek istiyorum")}`} target="_blank" rel="noreferrer" className="font-bold text-brand underline">
            bot numarasına yaz
          </a>
          . Cevap birkaç saniye içinde gelmeli; konuşma aşağıdaki listede görünür.
        </p>
      )}
    </div>
  );
}
