"use client";
import { useEffect, useState } from "react";

/** Aşamada geçen süreyi hedefe göre yeşil → sarı → kırmızı gösteren çubuk (canlı). */
export function SlaBar({ since, targetMin, label, compact = false }: { since: string; targetMin: number; label?: string; compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const start = new Date(since).getTime();
  const elapsed = now === null ? 0 : Math.max(0, (now - start) / 1000);
  const target = targetMin * 60;
  const ratio = target > 0 ? elapsed / target : 0;
  const late = ratio >= 1;
  // 0 → yeşil (hue 140), 0.5 → sarı (hue 50), 1 → kırmızı (hue 0)
  const hue = Math.round(140 * Math.max(0, 1 - Math.min(ratio, 1)) ** 1.15);
  const color = late ? "hsl(0 85% 48%)" : `hsl(${hue} 80% ${hue > 70 ? 38 : 46}%)`;
  const width = Math.min(ratio, 1) * 100;

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const overMin = Math.floor((elapsed - target) / 60);

  return (
    <div className={late ? "animate-[pulse_1.2s_ease-in-out_infinite]" : ""}>
      <div className={`flex items-baseline justify-between gap-2 ${compact ? "text-xs" : "text-sm"}`}>
        <span className="font-semibold text-muted">{label}</span>
        <span className="font-mono font-black tabular-nums" style={{ color }}>
          {now === null ? "–" : fmt(elapsed)}
          <span className="font-semibold text-muted"> / {targetMin} dk</span>
        </span>
      </div>
      <div className={`mt-1 overflow-hidden rounded-full bg-zinc-100 ${compact ? "h-2" : "h-3"}`}>
        <div className="h-full rounded-full transition-[width,background-color] duration-1000 ease-linear" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      {late && now !== null && (
        <p className={`mt-1 font-black text-red-600 ${compact ? "text-xs" : "text-sm"}`}>
          ⚠ Hedef süre aşıldı{overMin >= 1 ? ` · +${overMin} dk` : ""}
        </p>
      )}
    </div>
  );
}
