// Yönetim sesli asistanının panelde gösterdiği grafik/tablolar.
export type AdminVisual =
  | { kind: "kpis"; title: string; items: { label: string; value: string; delta?: number | null; hint?: string }[] }
  | { kind: "bars"; title: string; unit: "tl" | "adet"; items: { label: string; value: number; sub?: string }[] }
  | { kind: "table"; title: string; columns: string[]; rows: string[][]; alert?: boolean[] };

export const tlv = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(n) || 0);
export const shortDay = (ymd: string) => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(ymd + "T00:00:00Z"));

/** Sesli asistanın hazırladığı, yönetici onayı bekleyen ürün değişikliği */
export type ProductChange = {
  id: string;
  productId: string;
  name: string;
  rows: { label: string; before: string; after: string }[];
  expect: { price: number; sale_price: number | null; stock: number; is_active: boolean };
  patch: Partial<{ price: number; sale_price: number | null; stock: number; is_active: boolean }>;
  status: "bekliyor" | "uygulaniyor" | "uygulandi" | "iptal" | "hata";
  error?: string;
  createdAt: number;
  /** Öneri anında kullanıcının son cümlesi — sesli onay bundan SONRAKİ bir cümle olmalı */
  proposedAfter: string;
};
