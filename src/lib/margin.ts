// Kâr marjı hesapları (alış fiyatı KDV dahil, satış fiyatıyla aynı bazda girilir).

export type Margin = {
  price: number; // müşterinin ödediği (indirim varsa indirimli)
  cost: number;
  profit: number; // birim brüt kâr (₺)
  marginPct: number; // kâr / satış fiyatı
  markupPct: number | null; // kâr / alış fiyatı
};

export function calcMargin(price: number | null | undefined, cost: number | null | undefined): Margin | null {
  if (price == null || cost == null || !Number.isFinite(price) || !Number.isFinite(cost) || price <= 0) return null;
  const profit = Math.round((price - cost) * 100) / 100;
  return {
    price,
    cost,
    profit,
    marginPct: Math.round((profit / price) * 1000) / 10,
    markupPct: cost > 0 ? Math.round((profit / cost) * 1000) / 10 : null,
  };
}

/** Marja göre renk: zarar kırmızı, %10 altı turuncu, üstü yeşil */
export function marginTone(m: Margin | null) {
  if (!m) return "text-muted";
  if (m.profit < 0) return "text-red-600";
  if (m.marginPct < 10) return "text-amber-600";
  return "text-emerald-700";
}

export const pctTR = (n: number) => `%${n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
