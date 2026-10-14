/* eslint-disable @next/next/no-img-element */
import { art3d } from "@/lib/categoryArt";
/** Kategori simgesi: görsel varsa görsel, yoksa emoji. */
export function CategoryIcon({ cat, className = "", imgClass = "" }: { cat: { image_url?: string | null; emoji?: string | null; name: string }; className?: string; imgClass?: string }) {
  if (cat.image_url)
    return <img src={cat.image_url} alt="" loading="lazy" className={`inline-block object-contain ${imgClass || "h-[1.25em] w-[1.25em]"} ${className}`} />;
  return <span className={className}>{cat.emoji ?? "🛒"}</span>;
}

/**
 * Ana sayfa kategori kutusu görseli: yönetimden yüklenen fotoğraf varsa kutuyu doldurur,
 * yoksa emojinin 3D görseli, o da yoksa büyük emoji.
 */
export function CategoryArt({ cat }: { cat: { image_url?: string | null; emoji?: string | null; name: string } }) {
  if (cat.image_url) return <img src={cat.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />;
  const src = art3d(cat.emoji ?? "🛒");
  if (src) return <img src={src} alt="" loading="lazy" width={160} height={160} className="h-[72%] w-[72%] object-contain drop-shadow-sm transition duration-200 group-hover:scale-110" />;
  return <span className="text-4xl">{cat.emoji ?? "🛒"}</span>;
}
