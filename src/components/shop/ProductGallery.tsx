"use client";
// Ürün sayfası görsel galerisi: büyük görsel + küçük resimler; oklar ve kaydırma ile geçiş.
import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductImage } from "./ProductImage";

export function ProductGallery({ images, emoji, alt }: { images: string[]; emoji: string | null; alt: string }) {
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  if (images.length <= 1) return <ProductImage src={images[0] ?? null} emoji={emoji} alt={alt} size="lg" />;
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <Image key={images[i]} src={images[i]} alt={`${alt} — ${i + 1}/${images.length}`} fill sizes="(max-width:768px) 100vw, 480px" className="object-contain p-1" priority={i === 0} />
        <button type="button" onClick={() => go(-1)} aria-label="Önceki görsel" className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-line">
          <ChevronLeft size={20} />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Sonraki görsel" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-line">
          <ChevronRight size={20} />
        </button>
        <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold text-white">
          {i + 1}/{images.length}
        </span>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {images.map((u, k) => (
          <button
            key={u}
            type="button"
            onClick={() => setI(k)}
            aria-label={`Görsel ${k + 1}`}
            className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-2 ${k === i ? "ring-brand" : "ring-line"}`}
          >
            <Image src={u} alt="" fill sizes="64px" className="object-contain p-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
