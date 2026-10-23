"use client";
// Yönetim paneli sesli asistanı: ciro, karşılaştırma, stok, açık siparişler, müşteriler + onaylı stok/fiyat değişikliği.
// Görünüm müşteri asistanıyla aynı dilde (robot + panel + "pencereyi gizle" küresi) ama PEMBE-MOR renk skalasıyla,
// böylece yönetim asistanı müşteri asistanından ilk bakışta ayırt edilir.
import { AdminVisuals } from "./AdminVisuals";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Mic, MicOff, X } from "lucide-react";
import type { ProductChange } from "@/lib/voice/adminVisual";
import { useAdminVoice } from "@/lib/voice/useAdminVoice";
import { Robot, robotStateOf } from "@/components/shop/Robot";
import { VoiceOrb } from "@/components/shop/VoiceOrb";

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
  "Pencereyi gizle",
];

/** Paneldeki diğer düğmeler (ör. yan menü kartı, genel bakış) bu olayla asistanı açar */
export const ADMIN_VOICE_OPEN_EVENT = "yonetim-asistani:ac";

/** Yan menü genişliği (layout.tsx ile aynı) — küre ve panel ana içerik alanına göre konumlanır */
const ORB_KONUM = "bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 lg:left-[calc(50%+120px)]";

export function AdminVoiceAssistant() {
  const [open, setOpen] = useState(false);
  // Pencere gizli ama sohbet sürüyor → orta altta yarı saydam pembe-mor küre
  const [hidden, setHidden] = useState(false);
  const v = useAdminVoice(
    // "Sohbeti kapat" denince asistan kendini kapatır ve panel gizlenir
    () => {
      setOpen(false);
      setHidden(false);
    },
    // Sesle "pencereyi gizle" → pencere gizlenir, sohbet sürer
    () => {
      setOpen(true);
      setHidden(true);
    },
  );
  const active = v.state !== "idle" && v.state !== "error";

  const openIt = () => {
    setOpen(true);
    setHidden(false);
    if (active) return; // sohbet zaten sürüyor → yalnızca pencereyi göster
    void v.start(); // dokunuş içinde başlat (mikrofon izni)
  };
  const openRef = useRef(openIt);
  useEffect(() => {
    openRef.current = openIt;
  });
  useEffect(() => {
    const h = () => openRef.current();
    window.addEventListener(ADMIN_VOICE_OPEN_EVENT, h);
    return () => window.removeEventListener(ADMIN_VOICE_OPEN_EVENT, h);
  }, []);
  const close = () => {
    void v.stop();
    setOpen(false);
    setHidden(false);
  };
  // Sohbet bittiyse gizli küre de kalkar
  const orb = open && hidden && active;
  const busy = v.state === "connecting" || v.state === "tool_calling" || v.state === "processing";

  return (
    <>
      {!open && (
        // Kullanılmazken: sol altta yarı saydam robot düğmesi (sağ altta yeni sipariş zili var); üzerine gelince etiketle genişler.
        <button
          data-asistan-ui
          onClick={openIt}
          title="Yönetim asistanı"
          aria-label="Yönetim sesli asistanı"
          className="group fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7c1d8f] to-[#5b21b6] p-1.5 text-white opacity-60 shadow-lg shadow-fuchsia-900/30 ring-4 ring-white/80 transition-all duration-300 hover:pr-4 lg:left-[256px] hover:opacity-100 focus:pr-4 focus:opacity-100"
        >
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white">
            <Robot size={30} tone="pink" className="-mb-2" title="" />
          </span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-bold opacity-0 transition-all duration-300 group-hover:max-w-[160px] group-hover:opacity-100 group-focus:max-w-[160px] group-focus:opacity-100">
            Yönetim asistanı
          </span>
        </button>
      )}

      {orb && (
        <VoiceOrb
          tema="yonetim"
          konumClass={ORB_KONUM}
          durum={v.state}
          asistanAnalyser={v.getAssistantAnalyser}
          kullaniciSeviyesi={v.getUserLevel}
          onAc={() => setHidden(false)}
          onBitir={close}
        />
      )}

      {open && !orb && (
        <div
          data-asistan-ui
          className={`fixed inset-x-0 bottom-0 z-[60] p-3 sm:inset-x-auto sm:left-4 lg:left-[256px] ${v.visuals.length ? "sm:w-[27rem]" : "sm:w-96"}`}
        >
          <div className="relative space-y-3 overflow-hidden rounded-3xl bg-gradient-to-b from-[#3a1050] via-[#2a0d45] to-[#160828] p-4 text-white shadow-2xl shadow-fuchsia-950/40 ring-1 ring-fuchsia-400/25">
            {/* yumuşak pembe-mor ışık */}
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-fuchsia-500/25 blur-3xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />

            <div className="relative flex items-center justify-between">
              <p className="font-black">
                Yönetim asistanı
                <span className="ml-2 rounded-full bg-fuchsia-400/15 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">
                  Sesli rapor
                </span>
              </p>
              <div className="flex items-center gap-1.5">
                {active && (
                  <button
                    onClick={() => setHidden(true)}
                    aria-label="Pencereyi gizle, sesli sohbet devam eder"
                    title="Pencereyi gizle (sohbet devam eder)"
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                  >
                    <ChevronDown size={18} />
                  </button>
                )}
                <button onClick={close} aria-label="Kapat" title="Sohbeti bitir ve kapat" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="relative flex items-center gap-3">
              {/* Robot: asistanın gerçek durumunu gösterir (dinliyor / düşünüyor / konuşuyor / hata) */}
              <div className="relative shrink-0">
                <Robot state={robotStateOf(v.state)} size={72} tone="pink" title="Yönetim asistanı" />
                {!active && v.state !== "error" && (
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-white/15">
                    <MicOff size={13} />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-bold text-fuchsia-300">
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {STATUS[v.state]}
                </p>
                {(v.state === "listening" || v.state === "user_speaking") && (
                  <span aria-hidden className="mt-1 flex h-4 items-end gap-0.5">
                    {[6, 12, 8, 14, 7, 11, 5].map((h, k) => (
                      <span
                        key={k}
                        className={`w-1 rounded-full bg-gradient-to-t from-violet-400 to-fuchsia-300 ${v.state === "user_speaking" ? "animate-pulse" : "opacity-50"}`}
                        style={{ height: h, animationDelay: `${k * 90}ms` }}
                      />
                    ))}
                  </span>
                )}
                {v.userText && <p className="truncate text-sm opacity-80">Sen: “{v.userText}”</p>}
                {v.state === "listening" && !v.userText && <p className="text-sm opacity-70">İşletmenle ilgili sor.</p>}
              </div>
            </div>

            {v.assistantText && <p className="relative max-h-32 overflow-y-auto rounded-2xl bg-white/10 p-3 text-sm leading-relaxed">{v.assistantText}</p>}

            {v.change && <ChangeCard c={v.change} onOk={() => void v.confirmChange(v.change!.id)} onNo={() => v.cancelChange(v.change!.id)} />}

            <div className="relative">
              <AdminVisuals visuals={v.visuals} />
            </div>

            {v.actions.length > 0 && (
              <ul className="relative space-y-1">
                {v.actions.map((a) => (
                  <li key={a.id} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold">
                    {a.text}
                  </li>
                ))}
              </ul>
            )}

            {v.error && <p className="relative rounded-2xl bg-red-500/20 p-3 text-sm font-semibold text-red-100">{v.error}</p>}

            {(v.state === "listening" || v.state === "connecting") && !v.userText && !v.assistantText && (
              <div className="relative flex flex-wrap gap-1.5">
                {EXAMPLES.map((e) => (
                  <span key={e} className="rounded-full bg-white/10 px-2.5 py-1 text-xs ring-1 ring-fuchsia-300/10">
                    “{e}”
                  </span>
                ))}
              </div>
            )}

            <div className="relative flex gap-2">
              {active ? (
                <button onClick={() => void v.stop()} className="flex-1 rounded-xl bg-white/15 py-2.5 text-sm font-bold hover:bg-white/20">
                  Konuşmayı bitir
                </button>
              ) : (
                <button
                  onClick={() => void v.start()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-900/40 transition hover:brightness-110"
                >
                  <Mic size={16} /> {v.state === "error" ? "Tekrar başlat" : "Başlat"}
                </button>
              )}
            </div>
            <p className="relative text-center text-[11px] opacity-60">Stok/fiyat değişikliği yalnızca senin onayınla uygulanır. Sipariş almaz.</p>
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
    <div className={`relative rounded-2xl p-3 ring-2 ${wait ? "bg-amber-400/15 ring-amber-300" : c.status === "uygulandi" ? "bg-emerald-400/15 ring-emerald-300" : "bg-white/[0.07] ring-white/10"}`}>
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
          <button onClick={onOk} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-2 text-sm font-bold text-white">
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

/** Asistanı açan düğme (yan menü kartı, genel bakış bandı vb.) */
export function OpenAdminVoiceButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(ADMIN_VOICE_OPEN_EVENT))} className={className}>
      {children}
    </button>
  );
}

/** Yan menünün altındaki pembe-mor asistan kartı */
export function AdminVoiceCard() {
  return (
    <OpenAdminVoiceButton className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a1366] via-[#3b1580] to-[#1e0b3a] p-3 text-left text-white shadow-lg shadow-fuchsia-950/20 transition hover:brightness-110">
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-fuchsia-500/30 blur-2xl" />
      <span className="relative flex items-center gap-2.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white/95">
          <Robot size={32} tone="pink" className="-mb-2" title="" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-black leading-tight">Asistana sor</span>
          <span className="block text-[11px] leading-snug text-fuchsia-100/80">“Bugünkü ciro ne?”</span>
        </span>
        <Mic size={16} className="ml-auto shrink-0 text-fuchsia-200 transition group-hover:scale-110" />
      </span>
    </OpenAdminVoiceButton>
  );
}
