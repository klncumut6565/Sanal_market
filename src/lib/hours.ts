/**
 * Çalışma saatleri hesapları — her zaman İstanbul saatine göre (Türkiye sabit UTC+3, yaz saati yok).
 * Kapanış açılıştan küçükse iş günü gece yarısını aşar: 10:00 → ertesi gün 01:00.
 */
export const TR_OFFSET_MS = 3 * 3600_000;
export const LAST_CALL_MIN = 10; // kapanışa kaç dk kala geri sayım başlasın

export const toMin = (hm: string) => {
  const [h, m] = (hm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** İstanbul'da günün kaçıncı dakikası (ondalıklı) */
export function istMinuteOfDay(nowMs: number) {
  const d = new Date(nowMs + TR_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
}

export type HoursState = {
  open: boolean;
  /** açıkken kapanışa kalan saniye */
  secondsToClose: number | null;
  /** kapalıyken açılışa kalan saniye */
  secondsToOpen: number | null;
  lastCall: boolean;
  /** İstanbul saatiyle günün dakikası */
  minuteOfDay: number;
};

export function hoursState(nowMs: number, openHM: string, closeHM: string, manualOpen = true): HoursState {
  const o = toMin(openHM);
  const c = toMin(closeHM);
  const m = istMinuteOfDay(nowMs);
  if (!manualOpen) return { open: false, secondsToClose: null, secondsToOpen: null, lastCall: false, minuteOfDay: m };
  if (o === c) return { open: true, secondsToClose: null, secondsToOpen: null, lastCall: false, minuteOfDay: m };
  const inside = o < c ? m >= o && m < c : m >= o || m < c;
  if (inside) {
    const left = ((c - m + 1440) % 1440) * 60;
    return { open: true, secondsToClose: left, secondsToOpen: null, lastCall: left <= LAST_CALL_MIN * 60, minuteOfDay: m };
  }
  return { open: false, secondsToClose: null, secondsToOpen: ((o - m + 1440) % 1440) * 60, lastCall: false, minuteOfDay: m };
}

/** İçinde bulunulan (veya son) iş gününün başlangıç/bitişi (UTC ISO). 01:00–10:00 arası bir önceki iş günü gösterilir. */
export function businessDayWindow(nowMs: number, openHM: string, closeHM: string) {
  const o = toMin(openHM);
  const c = toMin(closeHM);
  const m = istMinuteOfDay(nowMs);
  const ist = new Date(nowMs + TR_OFFSET_MS);
  const istMidnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - TR_OFFSET_MS;
  const startDayOffset = m >= o ? 0 : -1;
  const start = istMidnight + startDayOffset * 86400_000 + o * 60_000;
  const duration = ((c - o + 1440) % 1440 || 1440) * 60_000;
  return { start: new Date(start).toISOString(), end: new Date(start + duration).toISOString() };
}

export const fmtCountdown = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h} sa ${m} dk` : `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

/** Sunucu tarafı: şu anki iş günü ve durum (istek anında çağrılır). */
export function currentBusinessDay(openHM: string, closeHM: string, manualOpen = true) {
  const now = Date.now();
  return { window: businessDayWindow(now, openHM, closeHM), state: hoursState(now, openHM, closeHM, manualOpen) };
}
