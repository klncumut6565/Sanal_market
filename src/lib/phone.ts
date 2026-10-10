/** Türkiye cep telefonu yardımcıları. Saklanan biçim: +905416735863 */

/** Her biçimden (0541…, 541…, +90 541…, 90541…) yalnızca 10 haneli yerel numarayı çıkarır. */
export function localDigits(input: string): string {
  const raw = (input ?? "").trim();
  let d = raw.replace(/\D/g, "");
  // "+90…" açıkça ülke kodu; "90…" ise yalnızca 10 haneden uzunsa ülke kodu sayılır
  if (raw.startsWith("+90") || (d.startsWith("90") && d.length > 10)) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

/** "5416735863" → "541 673 58 63" (yazarken kısmi biçimleme) */
export function formatLocal(digits: string): string {
  const d = digits.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(" ");
}

export const isValidTrMobile = (digits: string) => /^5\d{9}$/.test(digits);

/** Saklama biçimi: +905416735863 */
export const toE164 = (digits: string) => `+90${digits}`;

/** Gösterim biçimi: +90 541 673 58 63 */
export function displayPhone(stored: string): string {
  const d = localDigits(stored);
  return d.length === 10 ? `+90 ${formatLocal(d)}` : stored;
}

/** Sunucu tarafı: geçerliyse +90… döner, değilse null. */
export function normalizeTrMobile(input: string): string | null {
  const d = localDigits(input);
  return isValidTrMobile(d) ? toE164(d) : null;
}
