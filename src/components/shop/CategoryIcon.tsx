/* eslint-disable @next/next/no-img-element */
/** Kategori simgesi: görsel varsa görsel, yoksa emoji. */
export function CategoryIcon({ cat, className = "", imgClass = "" }: { cat: { image_url?: string | null; emoji?: string | null; name: string }; className?: string; imgClass?: string }) {
  if (cat.image_url)
    return <img src={cat.image_url} alt="" loading="lazy" className={`inline-block object-contain ${imgClass || "h-[1.25em] w-[1.25em]"} ${className}`} />;
  return <span className={className}>{cat.emoji ?? "🛒"}</span>;
}
