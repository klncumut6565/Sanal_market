/** "1.225,50" / "1225,5" / "1225.5" / "₺ 12" → sayı; boş → null; geçersiz → NaN */
export function parseNumTR(v: string | null | undefined): number | null {
  let s = String(v ?? "").replace(/[₺\s]/g, "").trim();
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
