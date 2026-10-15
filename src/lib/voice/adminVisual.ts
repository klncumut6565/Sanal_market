// Yönetim sesli asistanının panelde gösterdiği grafik/tablolar.
export type AdminVisual =
  | { kind: "kpis"; title: string; items: { label: string; value: string; delta?: number | null; hint?: string }[] }
  | { kind: "bars"; title: string; unit: "tl" | "adet"; items: { label: string; value: number; sub?: string }[] }
  | { kind: "table"; title: string; columns: string[]; rows: string[][]; alert?: boolean[] };

export const tlv = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(n) || 0);
export const shortDay = (ymd: string) => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(ymd + "T00:00:00Z"));
