"use client";
import { useState, useTransition } from "react";
import { BarChart3, Loader2, Send } from "lucide-react";
import { sendDailyReportNow, setDailyReportEnabled } from "@/app/admin/actions";

/** Ayarlar: her gece kapanıştan sonra WhatsApp'a gelen gün sonu raporu. */
export function DailyReportCard({ enabled, lastResult, lastAt }: { enabled: boolean; lastResult: string | null; lastAt: string | null }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; status: string; text?: string } | null>(null);
  const fmt = (d: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(d));

  return (
    <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <BarChart3 size={20} className="text-brand" /> Gün sonu raporu
      </h2>
      <p className="text-sm text-muted">
        Her gece kapanıştan sonra (~01:20) sipariş bildirimlerinin gittiği WhatsApp numarasına o günün özeti gelir: <b>online</b> ve <b>mağaza (kasa)</b> satışları
        ayrı ayrı (ciro, nakit/kart, brüt kâr, en çok satanlar) ve tükenen / kritik stoktaki ürünler.
      </p>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.checked;
            setOn(v);
            start(async () => {
              const r = await setDailyReportEnabled(v);
              if (!r.ok) setOn(!v);
            });
          }}
        />
        Gün sonu raporu otomatik gelsin
      </label>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        {(
          [
            ["bugun", "Bugünün raporunu şimdi gönder"],
            ["dun", "Dünün raporunu gönder"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            disabled={pending}
            onClick={() => start(async () => setMsg(await sendDailyReportNow(k)))}
            className="btn-ghost py-2 text-sm"
          >
            <Send size={15} /> {label}
          </button>
        ))}
        {pending && <Loader2 size={18} className="animate-spin self-center text-brand" />}
      </div>
      {msg && (
        <div className={`space-y-2 rounded-lg p-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-brand-soft text-brand"}`}>
          <p className="font-semibold">{msg.status}</p>
          {msg.text && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2.5 font-sans text-xs text-ink ring-1 ring-line">{msg.text}</pre>}
        </div>
      )}
      {lastResult && (
        <p className="rounded-lg bg-bg p-2.5 text-xs">
          <b>Son rapor</b>
          {lastAt && ` (${fmt(lastAt)})`}: {lastResult}
        </p>
      )}
    </section>
  );
}
