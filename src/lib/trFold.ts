// Türkçe arama yardımcıları: büyük/küçük harf ve ç/ğ/ı/İ/ö/ş/ü farkını yok sayar.
const trMap: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

export const fold = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/[çğıiöşüâîû]/g, (c) => trMap[c] ?? c)
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();

/** Arama metnini kelimelere böler; ürün adı her kelimeyi (herhangi bir sırada) içermeli. */
export function matchWords(name: string, query: string) {
  const n = fold(name);
  return fold(query)
    .split(" ")
    .filter(Boolean)
    .every((w) => n.includes(w));
}

/** Mükerrer kontrolü için ad anahtarı: Türkçe karakter, büyük/küçük, boşluk ve noktalama farkı yok ("COCA COLA 1,5 LT" = "Coca-Cola 1.5LT"). */
export const nameKey = (s: string) => fold(s).replace(/[^a-z0-9]/g, "");

/** Barkod anahtarı: yalnızca harf/rakam, büyük harf, baştaki sıfırlar atılır (UPC-A 12 hane = başında 0 olan EAN-13). Veritabanındaki norm_barcode ile aynı. */
export const barcodeKey = (b: string | null | undefined) => (b ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase().replace(/^0+/, "");
