"use client";
import { useState, useTransition } from "react";
import { Bot } from "lucide-react";
import { setWaBotEnabled } from "@/app/admin/actions";
import { WaSetupPanel } from "./WaSetupPanel";

function Item({ ok, label }: { ok: boolean; label: string }) {
  return <li className={ok ? "text-emerald-700" : "text-amber-700"}>{ok ? "✅" : "⚠️"} {label}</li>;
}

type ChatRow = { phone: string; name: string | null; updated_at: string; cart: unknown[] };

/** Ayarlar: WhatsApp sipariş botu aç/kapat + son konuşmalar. */
export function WaBotCard({ enabled, ready, chats, botNumberHint, verifyToken }: { enabled: boolean; ready: { gemini: boolean; cloud: boolean; webhook: boolean }; chats: ChatRow[]; botNumberHint: string; verifyToken: string | null }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const fmt = (d: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(d));
  return (
    <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Bot size={20} className="text-brand" /> WhatsApp sipariş botu
      </h2>
      <p className="text-sm text-muted">
        Müşteriler {botNumberHint} WhatsApp numarasına yazarak sipariş verebilir: bot ürünleri bulur, sepeti kurar, adres ve ödeme bilgisini alır, özeti gösterip
        müşteri <b>EVET</b> yazınca siparişi açar. Siparişler sitedeki siparişlerle aynı listeye düşer (notunda &quot;WhatsApp siparişi&quot; yazar). Alkol ve tütün
        bottan satılmaz. Bildirim/kurye numaralarından gelen mesajlara bot cevap vermez.
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
              const r = await setWaBotEnabled(v);
              if (!r.ok) setOn(!v);
            });
          }}
        />
        Bot müşterilere cevap versin
      </label>
      <ul className="space-y-0.5 rounded-lg bg-bg p-2.5 text-xs">
        <Item ok={ready.gemini} label="Yapay zekâ anahtarı (GEMINI_API_KEY)" />
        <Item ok={ready.cloud} label="WhatsApp Business bağlantısı (WHATSAPP_TOKEN / PHONE_NUMBER_ID)" />
        <Item ok={ready.webhook} label={ready.webhook ? "Gelen mesajlar alınıyor (webhook)" : "Gelen mesajlar henüz hiç alınmadı — Meta'da webhook aboneliği (subscribed_apps) yapılmalı"} />
      </ul>
      <WaSetupPanel verifyToken={verifyToken} webhookSeen={ready.webhook} />
      {chats.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold text-muted">Son konuşmalar</p>
          <ul className="divide-y divide-line text-sm">
            {chats.map((c) => (
              <li key={c.phone} className="flex justify-between gap-2 py-1.5">
                <span>
                  <b>{c.name ?? "—"}</b> <span className="text-xs text-muted">{c.phone}</span>
                </span>
                <span className="text-xs text-muted">
                  {Array.isArray(c.cart) && c.cart.length ? `sepette ${c.cart.length} ürün · ` : ""}
                  {fmt(c.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
