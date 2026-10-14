/* eslint-disable @next/next/no-img-element */
import { ArrowRight } from "lucide-react";
import { art3d } from "@/lib/categoryArt";

type Cat = { image_url?: string | null; emoji?: string | null; name: string };

/**
 * Küçük kategori simgesi (kenar menüsü, mobil çipler, satış ekranı, kategori başlığı): her zaman emoji.
 * Kategori görseli (image_url) yalnızca ana sayfa kutusunun kapak fotoğrafıdır.
 */
export function CategoryIcon({ cat, className = "" }: { cat: Cat; className?: string; imgClass?: string }) {
  return <span className={className}>{cat.emoji ?? "🛒"}</span>;
}

/** Ana sayfa kategori kartı görseli: kapak fotoğrafı; yoksa 3D simge; o da yoksa büyük emoji. */
export function CategoryArt({ cat }: { cat: Cat }) {
  if (cat.image_url)
    return <img src={cat.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />;
  const src = art3d(cat.emoji ?? "🛒");
  return (
    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-[#fff4ea] via-[#ffe7d4] to-[#ffd9bd]">
      {src ? (
        <img src={src} alt="" loading="lazy" width={160} height={160} className="h-[62%] w-[62%] object-contain drop-shadow-md transition duration-300 group-hover:scale-110" />
      ) : (
        <span className="text-5xl">{cat.emoji ?? "🛒"}</span>
      )}
    </span>
  );
}

/** Ana sayfa kategori kartı (örnek: üstte fotoğraf, altta ad + ok düğmesi). */
export function CategoryCardBody({ cat }: { cat: Cat }) {
  return (
    <>
      <span className="block aspect-[6/5] w-full overflow-hidden rounded-t-2xl">
        <CategoryArt cat={cat} />
      </span>
      <span className="flex min-h-[3.6rem] items-start justify-between gap-2 px-3 py-2.5">
        <span className="line-clamp-2 text-left text-[13.5px] font-extrabold leading-snug text-ink">{cat.name}</span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bg text-ink transition group-hover:bg-brand group-hover:text-white">
          <ArrowRight size={15} />
        </span>
      </span>
    </>
  );
}
