"use client";
import { useEffect, useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { OPEN_EVENT } from "./VoiceAssistant";

const ORNEKLER = [
  "Domatesten 2 kilo ekle",
  "Beyaz peynir hangi markalar var?",
  "Kahvaltı için ne önerirsin?",
  "Sepetimde ne var?",
  "5 litrelik su ekle",
];

/** Ana sayfanın en üstünde sesli siparişi tanıtan bant — dokununca asistanı açar. */
export function VoicePromo() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % ORNEKLER.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-r from-brand to-[#ff8a3d] p-4 text-left text-white shadow-lg shadow-brand/20 transition active:scale-[0.99] sm:gap-4 sm:p-5"
    >
      {/* arka plan ses dalgası */}
      <div aria-hidden className="pointer-events-none absolute -right-2 bottom-0 top-0 flex items-center gap-1 opacity-25 sm:right-6">
        {[18, 34, 52, 30, 60, 40, 22, 46, 28].map((h, k) => (
          <span key={k} className="w-1.5 animate-pulse rounded-full bg-white" style={{ height: h, animationDelay: `${k * 120}ms` }} />
        ))}
      </div>

      <span className="relative grid h-14 w-14 shrink-0 place-items-center sm:h-16 sm:w-16">
        <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white text-brand shadow-md sm:h-16 sm:w-16">
          <Mic size={28} strokeWidth={2.5} />
        </span>
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider">
          <Sparkles size={12} /> Yeni
        </span>
        <span className="block text-lg font-black leading-tight sm:text-xl">Yapay zekâ ile konuşarak sipariş ver!</span>
        <span className="mt-0.5 block min-h-[2.5rem] text-sm font-semibold leading-snug opacity-95 sm:min-h-0">
          “<span key={i} className="inline-block animate-[fadein_.4s_ease]">{ORNEKLER[i]}</span>” de, sepetine eklensin.
        </span>
      </span>

      <span className="relative hidden shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-black sm:block">Hemen dene</span>
    </button>
  );
}
