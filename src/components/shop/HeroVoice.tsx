"use client";
// Karşılama alanındaki "konuşarak sipariş ver" komut kutusu: örnek komutlar döner, dokununca sesli asistan açılır.
import { useEffect, useState } from "react";
import { ArrowRight, Mic } from "lucide-react";
import { OPEN_EVENT } from "./VoiceAssistant";

const ORNEKLER = [
  "Akşam yemeği için malzemeler öner.",
  "Domatesten 2 kilo ekle.",
  "Kahvaltı için ne önerirsin?",
  "Beyaz peynir hangi markalar var?",
  "Sepetimde ne var?",
];

export function HeroVoice() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % ORNEKLER.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="group flex w-full max-w-md items-center gap-3 rounded-full bg-white p-1.5 pr-2 text-left shadow-lg shadow-navy/10 ring-1 ring-line transition hover:ring-accent active:scale-[0.99]"
      aria-label="Sesli asistanı aç ve konuşarak sipariş ver"
    >
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/30 motion-reduce:hidden" />
        <Mic size={20} className="relative" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink/80">
        “<span key={i} className="inline-block animate-[fadein_.4s_ease]">{ORNEKLER[i]}</span>”
      </span>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-white transition group-hover:bg-brand">
        <ArrowRight size={18} />
      </span>
    </button>
  );
}

/** Banner düğmesi: sesli asistanı açar. */
export function OpenVoiceButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={className}>
      {children}
    </button>
  );
}
