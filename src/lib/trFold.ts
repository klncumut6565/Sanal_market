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
