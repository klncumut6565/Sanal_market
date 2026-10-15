"use client";
// Yönetim paneli sesli asistanı: ciro, karşılaştırma, stok, açık siparişler, müşteriler + onaylı stok/fiyat değişikliği.
import { AdminVisuals } from "./AdminVisuals";
import { useState } from "react";
import { BarChart3, Check, Loader2, Mic, MicOff, X } from "lucide-react";
import type { ProductChange } from "@/lib/voice/adminVisual";
import { useAdminVoice } from "@/lib/voice/useAdminVoice";

const STATUS: Record<string, string> = {
  idle: "",
  connecting: "Bağlanıyor…",
  listening: "Dinliyorum…",
  user_speaking: "Dinliyorum…",
  processing: "Düşünüyorum…",
  tool_calling: "Verilere bakıyorum…",
  speaking: "Konuşuyorum…",
  reconnecting: "Yeniden bağlanıyor…",
  error: "",
};

const EXAMPLES = [
  "Bu haftaki ciromuz ne?",
  "Geçen haftaya göre yüzde kaç iyiyiz?",
  "Stoklarımız ne durumda?",
  "Bu ay en çok ne sattık?",
  "Bekleyen sipariş var mı?",
  "Domates stoğunu 50 yap",
];

export function AdminVoiceAssistant() {
  const [open, setOpen] = useState(false);
  // "Sohbeti kapat" denince asistan kendini kapatır ve panel gizlenir
  const v = useAdminVoice(() => setOpen(false));
  const active = v.state !== "idle" && v.state !== "error";

  const openIt = () => {
    setOpen(true);
    void v.start(); // dokunuş içinde başlat (mikrofon izni)
  };
  const close = () => {
    void v.stop();
    setOpen(false);
  };

  return (
    <>
      {!open && (
        // Kullanılmazken: köşede küçük, yarı saydam simge (TMGD asistanı gibi);
        // üzerine gelince / odaklanınca etiketle genişler. Formların "Kaydet" butonunu kapatmaz.
        <button
          onClick={openIt}
          title="Sesli rapor"
          aria-label="Yönetim sesli asistanı"
          className="group fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-ink p-2 text-white opacity-45 shadow-lg transition-all duration-300 hover:pr-4 hover:opacity-100 focus:pr-4 focus:opacity-100 lg:left-[246px]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand">
            <Mic size={16} />
          </span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-bold opacity-0 transition-all duration-300 group-hover:max-w-[160px] group-hover:opacity-100 group-focus:max-w-[160px] group-focus:opacity-100">
            Sesli rapor
          </span>
        </button>
      )}

      {open && (
        <div className={`fixed inset-x-0 bottom-0 z-[60] p-3 sm:inset-x-auto sm:left-4 lg:left-[246px] ${v.visuals.length ? "sm:w-[26rem]" : "sm:w-96"}`}>
          <div className="space-y-3 rounded-3xl bg-ink p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-black">
                <BarChart3 size={18} className="text-brand" /> Yönetim asistanı
              </p>
              <button onClick={close} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative grid h-14 w-14 shrink-0 place-items-center">
                {active && (
                  <span className={`absolute inset-0 rounded-full bg-brand/40 ${v.state === "user_speaking" || v.state === "speaking" ? "animate-ping" : ""}`} />
                )}
                <span className={`relative grid h-14 w-14 place-items-center rounded-full ${active ? "bg-brand" : "bg-white/15"}`}>
                  {v.state === "connecting" || v.state === "tool_calling" || v.state === "processing" ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : active ? (
                    <Mic size={24} />
                  ) : (
                    <MicOff size={24} />
                  )}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand">{STATUS[v.state]}</p>
                {v.userText && <p className="truncate text-sm opacity-80">Sen: “{v.userText}”</p>}
                {v.state === "listening" && !v.userText && <p className="text-sm opacity-70">İşletmenle ilgili sor.</p>}
              </div>
            </div>

            {v.assistantText && <p className="max-h-32 overflow-y-auto rounded-2xl bg-white/10 p-3 text-sm leading-relaxed">{v.assistantText}</p>}

            {v.change && <ChangeCard c={v.change} onOk={() => void v.confirmChange(v.change!.id)} onNo={() => v.cancelChange(v.change!.id)} />}

            <AdminVisuals visuals={v.visuals} />

            {v.actions.length > 0 && (
              <ul className="space-y-1">
                {v.actions.map((a) => (
                  <li key={a.id} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold">
                    {a.text}
                  </li>
                ))}
              </ul>
            )}

            {v.error && <p className="rounded-2xl bg-red-500/20 p-3 text-sm font-semibold text-red-100">{v.error}</p>}

            {(v.state === "listening" || v.state === "connecting") && !v.userText && !v.assistantText && (
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((e) => (
                  <span key={e} className="rounded-full bg-white/10 px-2.5 py-1 text-xs">
                    “{e}”
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {active ? (
                <button onClick={() => void v.stop()} className="flex-1 rounded-xl bg-white/15 py-2.5 text-sm font-bold">
                  Konuşmayı bitir
                </button>
              ) : (
                <button onClick={() => void v.start()} className="btn-primary flex-1 py-2.5 text-sm">
                  <Mic size={16} /> {v.state === "error" ? "Tekrar başlat" : "Başlat"}
                </button>
              )}
            </div>
            <p className="text-center text-[11px] opacity-60">Stok/fiyat değişikliği yalnızca senin onayınla uygulanır. Sipariş almaz.</p>
          </div>
        </div>
      )}
    </>
  );
}

const CH_STATUS: Record<ProductChange["status"], string> = {
  bekliyor: "Onayın bekleniyor",
  uygulaniyor: "Uygulanıyor…",
  uygulandi: "✅ Uygulandı",
  iptal: "Vazgeçildi — hiçbir şey değişmedi",
  hata: "Uygulanamadı",
};

/** Asistanın hazırladığı değişiklik: ekrandan da onaylanabilir */
function ChangeCard({ c, onOk, onNo }: { c: ProductChange; onOk: () => void; onNo: () => void }) {
  const wait = c.status === "bekliyor";
  return (
    <div className={`rounded-2xl p-3 ring-2 ${wait ? "bg-amber-400/15 ring-amber-300" : c.status === "uygulandi" ? "bg-emerald-400/15 ring-emerald-300" : "bg-white/[0.07] ring-white/10"}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-white/60">Değişiklik önerisi</p>
      <p className="mt-0.5 font-black">{c.name}</p>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.label}>
              <td className="py-0.5 pr-2 text-white/70">{r.label}</td>
              <td className="py-0.5 tabular-nums text-white/60 line-through">{r.before}</td>
              <td className="px-1.5 text-white/50">→</td>
              <td className="py-0.5 font-bold tabular-nums">{r.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`mt-2 text-xs font-bold ${c.status === "hata" ? "text-red-200" : "text-white/80"}`}>
        {CH_STATUS[c.status]}
        {c.error ? `: ${c.error}` : ""}
      </p>
      {wait && (
        <div className="mt-2 flex gap-2">
          <button onClick={onOk} className="btn-primary flex-1 py-2 text-sm">
            <Check size={16} /> Onayla
          </button>
          <button onClick={onNo} className="flex-1 rounded-xl bg-white/15 py-2 text-sm font-bold">
            Vazgeç
          </button>
        </div>
      )}
    </div>
  );
}
