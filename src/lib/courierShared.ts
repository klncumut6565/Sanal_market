// Kurye paneli ve yönetim tarafında ortak sabitler (istemci + sunucu güvenli)
export const VEHICLES: [string, string][] = [
  ["motosiklet", "🏍️ Motosiklet"],
  ["bisiklet", "🚲 Bisiklet"],
  ["otomobil", "🚗 Otomobil"],
  ["yaya", "🚶 Yaya"],
  ["diger", "Diğer"],
];
export const vehicleLabel = (v: string | null | undefined) => VEHICLES.find(([k]) => k === v)?.[1] ?? "—";

/** Teslim edilemedi nedenleri (kurye seçer, yöneticiye gider) */
export const ISSUE_REASONS = [
  "Adreste kimse yok",
  "Müşteriye ulaşılamıyor (telefon)",
  "Adres bulunamadı / hatalı",
  "Müşteri siparişi reddetti",
  "Ödeme yapılamadı",
  "Ürün hasarlı / eksik",
];

export const payLabel = (m: string | null | undefined) => (m === "kapida_pos" ? "Kapıda kart (POS)" : "Kapıda nakit");
export const collectedLabel = (m: string | null | undefined) => (m === "pos" ? "POS" : m === "nakit" ? "Nakit" : "—");

/** Sipariş adresinden harita bağlantıları */
export const mapsSearch = (a: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a}, Çorlu, Tekirdağ`)}`;
export const mapsDirections = (a: string) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(`${a}, Çorlu, Tekirdağ`)}`;
