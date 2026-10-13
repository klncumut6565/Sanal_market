"use client";
import { useEffect, useState } from "react";
import { hoursState, type HoursState } from "@/lib/hours";
import type { StoreSettings } from "@/lib/types";

export type HoursSettings = Pick<StoreSettings, "open_time" | "close_time" | "is_open" | "force_open">;

/** Saniyede bir güncellenen çalışma saati durumu (ilk çizimde null). */
export function useStoreHours(s: HoursSettings): HoursState | null {
  const [st, setSt] = useState<HoursState | null>(null);
  useEffect(() => {
    const tick = () => setSt(hoursState(Date.now(), s.open_time, s.close_time, s.is_open, s.force_open));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [s.open_time, s.close_time, s.is_open, s.force_open]);
  return st;
}
