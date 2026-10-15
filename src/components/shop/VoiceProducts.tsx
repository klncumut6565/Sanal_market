"use client";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { ProductImage } from "./ProductImage";
import { useCart } from "@/store/cart";
import { formatTL } from "@/lib/format";
import type { ShownProduct } from "@/lib/voice/marketToolRunner";

/** Sesli asistanın bahsettiği ürünler: görsel, ad, fiyat; dokunarak da sepete eklenebilir. */
export function VoiceProducts({ title, items }: { title: string; items: ShownProduct[] }) {
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const proposal = items.some((i) => i.proposedQty);
  return (
    <div className="space-y-1.5">
      <p className={`text-xs font-bold ${proposal ? "text-amber-300" : "opacity-70"}`}>{title}</p>
      <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
        {items.map((p) => {
          const inCart = lines.find((l) => l.id === p.id)?.qty ?? 0;
          const out = p.stock < 1;
          const price = p.sale_price ?? p.price;
          return (
            <div
              key={p.id}
              className={`w-[104px] shrink-0 snap-start rounded-2xl bg-white p-1.5 text-ink ${p.proposedQty ? "ring-2 ring-amber-400" : ""} ${out ? "opacity-50" : ""}`}
            >
              <Link href={`/urun/${p.slug}`} className="block">
                <ProductImage src={p.image_url} emoji={p.emoji} alt={p.name} />
                <span className="mt-1 line-clamp-2 min-h-[2lh] text-[11px] font-semibold leading-tight">{p.name}</span>
              </Link>
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className="text-[12px] font-black leading-none">
                  {formatTL(price)}
                  {p.sale_price != null && <span className="block text-[10px] font-semibold text-muted line-through">{formatTL(p.price)}</span>}
                </span>
                {p.proposedQty ? (
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800">{p.proposedQty} adet</span>
                ) : out ? (
                  <span className="text-[10px] font-bold text-muted">Tükendi</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => add(p)}
                    aria-label={`${p.name} sepete ekle`}
                    className={`grid h-7 min-w-7 place-items-center rounded-lg px-1 text-[11px] font-black text-white ${inCart ? "bg-emerald-600" : "bg-brand"}`}
                  >
                    {inCart ? (
                      <span className="flex items-center gap-0.5">
                        <Check size={12} />
                        {inCart}
                      </span>
                    ) : (
                      <Plus size={15} />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
