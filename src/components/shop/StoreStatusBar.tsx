"use client";
import { Clock, MoonStar } from "lucide-react";
import { fmtCountdown } from "@/lib/hours";
import { useStoreHours, type HoursSettings } from "./useStoreHours";

/** Header altında: kapalıysa açılış bilgisi, kapanışa 10 dk kala geri sayım. */
export function StoreStatusBar({ settings }: { settings: HoursSettings }) {
  const h = useStoreHours(settings);
  if (!h) return null;
  if (!settings.is_open)
    return (
      <div className="bg-ink px-4 py-2 text-center text-sm font-semibold text-white">
        Market şu an sipariş almıyor. Lütfen daha sonra tekrar dene.
      </div>
    );
  if (!h.open)
    return (
      <div className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-sm font-semibold text-white">
        <MoonStar size={16} className="shrink-0 text-brand" />
        <span>
          Şu an kapalıyız · Siparişler <b className="text-brand">{settings.open_time}</b>&apos;da açılıyor
          {h.secondsToOpen != null && <span className="opacity-80"> ({fmtCountdown(h.secondsToOpen)} sonra)</span>}
        </span>
      </div>
    );
  if (h.lastCall && h.secondsToClose != null)
    return (
      <div className="flex items-center justify-center gap-2 bg-brand px-4 py-2 text-center text-sm font-bold text-white">
        <Clock size={16} className="shrink-0 animate-pulse" />
        <span>
          Son sipariş için <span className="rounded-md bg-white px-1.5 py-0.5 font-mono font-black text-brand tabular-nums">{fmtCountdown(h.secondsToClose)}</span> · {settings.close_time}&apos;da sipariş alımı kapanıyor
        </span>
      </div>
    );
  return null;
}
