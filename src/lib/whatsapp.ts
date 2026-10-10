/** 05xx / 5xx / +90 → 905xxxxxxxxx */
export function toWaNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 11) return "9" + d;
  if (d.length === 10) return "90" + d;
  return d;
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${toWaNumber(phone)}?text=${encodeURIComponent(text)}`;
}
