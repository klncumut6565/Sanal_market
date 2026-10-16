// Harita araması için adres: YALNIZCA sokak/cadde + dış kapı no + mahalle + ilçe/il.
// İç kapı (daire) no, apartman/site adı, kat ve adres notları haritada konum bulmayı bozduğu için ARAMAYA KATILMAZ
// (kurye bunları sipariş kartında ayrıca görür).
export type AddrParts = {
  address: string;
  addr_street?: string | null;
  addr_door_no?: string | null;
  addr_neighborhood?: string | null;
  addr_district?: string | null;
  addr_city?: string | null;
};

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Serbest metin adresten iç kapı, apartman, kat ve not kısımlarını ayıklar (eski / yapılandırılmamış adresler için). */
export function stripAddress(a: string) {
  return clean(
    a
      .replace(/\([^)]*\)/g, " ") // (Alşahin Apartmanı), (marketin solunda)
      .replace(/(No\s*[:.]?\s*\d+\w?)\s*\/\s*\d+\w?/giu, "$1") // No:45/7 → No:45
      .replace(/(^|\s)(D|Daire|İç\s*kapı(\s*no)?|Ic\s*kapi)\s*[:.]?\s*\d+\w?/giu, " ")
      .replace(/(^|\s)(Kat|K)\s*[:.]?\s*-?\d+(?=\s|,|$)/giu, " ")
      .replace(/(^|\s)[\p{L}\d.-]+(\s+[\p{L}\d.-]+)?\s+(Apartmanı|Apartman|Apt\.?|Sitesi|Site|Blok|Rezidans|Residence)(?=\s|,|$)[^,]*/giu, " ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*,/g, ","),
  ).replace(/^,|,$/g, "");
}

/** Haritada aranacak metin */
export function mapQuery(p: AddrParts | string) {
  if (typeof p === "string") return withCity(stripAddress(p));
  const street = clean(p.addr_street);
  const door = clean(p.addr_door_no);
  const hood = clean(p.addr_neighborhood);
  if (street || hood) {
    const parts = [
      [street, door ? `No:${door}` : ""].filter(Boolean).join(" "),
      hood ? (/(mah|mahallesi)\.?$/i.test(hood) ? hood : `${hood} Mahallesi`) : "",
      clean(p.addr_district) || "Çorlu",
      clean(p.addr_city) || "Tekirdağ",
    ];
    return parts.filter(Boolean).join(", ");
  }
  return withCity(stripAddress(p.address));
}

function withCity(a: string) {
  return /çorlu|tekirdağ/i.test(a) ? a : `${a}, Çorlu, Tekirdağ`;
}

export const mapsSearchUrl = (p: AddrParts | string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(p))}`;
export const mapsDirectionsUrl = (p: AddrParts | string) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(mapQuery(p))}`;
