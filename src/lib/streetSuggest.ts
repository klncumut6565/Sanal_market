// Müşterilerin elle yazdığı sokak adları için yardımcılar (admin öneri ekranı).

/** Karşılaştırma anahtarı: küçük harf, Türkçe harfler sadeleştirilmiş, tek boşluk. */
export function streetKey(s: string) {
  return s
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[.,]/g, " ")
    .replace(/\b(sokak|sokagi|sk|sok)\b/g, "sokak")
    .replace(/\b(caddesi|cadde|cad|cd)\b/g, "caddesi")
    .replace(/\b(bulvari|bulvar|blv|bul)\b/g, "bulvari")
    .replace(/\s+/g, " ")
    .trim();
}

const KISALTMA: [RegExp, string][] = [
  [/\b(sk|sok|sokağı|sokagi)\.?$/i, "Sokak"],
  [/\b(cd|cad|cadde)\.?$/i, "Caddesi"],
  [/\b(blv|bul|bulvar)\.?$/i, "Bulvarı"],
];

/** "gül sk" → "Gül Sokak", "ATATÜRK CD." → "Atatürk Caddesi" */
export function prettyStreet(s: string) {
  let t = s.replace(/\s+/g, " ").trim();
  for (const [re, rep] of KISALTMA) t = t.replace(re, rep);
  return t
    .split(" ")
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toLocaleUpperCase("tr") + w.slice(1).toLocaleLowerCase("tr")))
    .join(" ");
}

function lev(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Mahalledeki mevcut sokaklardan yazılana en çok benzeyeni (yazım hatası olabilir). */
export function closestStreet<T extends { name: string }>(typed: string, list: T[]): T | null {
  const k = streetKey(typed);
  const core = (x: string) => x.replace(/ (sokak|caddesi|bulvari)$/, "");
  let best: T | null = null;
  let bestD = Infinity;
  for (const s of list) {
    const sk = streetKey(s.name);
    const d = Math.min(lev(k, sk), lev(core(k), core(sk)));
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  // Uzunluğa göre tolerans: kısa adlarda 1, uzunlarda 2-3 harf farkı
  const tol = k.length <= 8 ? 1 : k.length <= 16 ? 2 : 3;
  return best && bestD <= tol ? best : null;
}
