import Link from "next/link";
import type { Product } from "@/lib/types";
import { discountRate } from "@/lib/format";
import { AddToCart } from "./AddToCart";
import { Price } from "./Price";
import { ProductImage } from "./ProductImage";
import { FavoriteButton } from "./FavoriteButton";
import { ScrollRow } from "./ScrollRow";

export function ProductCard({ product }: { product: Product }) {
  const off = discountRate(product);
  const soldOut = product.stock <= 0;
  return (
    <div className="group relative flex flex-col rounded-2xl bg-card p-2.5 ring-1 ring-line transition hover:shadow-md">
      <Link href={`/urun/${product.slug}`} className={soldOut ? "opacity-50" : ""}>
        <ProductImage src={product.image_url} emoji={product.emoji} alt={product.name} />
      </Link>
      {off > 0 && (
        <span className="absolute left-2.5 top-2.5 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
          %{off}
        </span>
      )}
      <FavoriteButton id={product.id} name={product.name} className="absolute right-3.5 top-3.5" />
      {soldOut && (
        <span className="absolute left-1/2 top-[38%] -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1 text-xs font-bold text-white">
          Tükendi
        </span>
      )}
      <div className="mt-2 flex flex-1 flex-col">
        <div className="flex items-end justify-between gap-2">
          <Price price={product.price} sale={product.sale_price} />
          <AddToCart product={product} />
        </div>
        <Link href={`/urun/${product.slug}`} className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-snug">
          {product.name}
        </Link>
        {product.unit_label && <span className="mt-0.5 text-xs text-muted">{product.unit_label}</span>}
      </div>
    </div>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function ProductRow({ products, moreHref, moreLabel = "Tümünü gör" }: { products: Product[]; moreHref?: string; moreLabel?: string }) {
  const cell = "w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[23%] xl:w-[18.5%] 2xl:w-[15.6%]";
  return (
    <ScrollRow>
      {products.map((p) => (
        <div key={p.id} className={cell}>
          <ProductCard product={p} />
        </div>
      ))}
      {moreHref && (
        <Link href={moreHref} className={`${cell} flex flex-col items-center justify-center gap-2 rounded-2xl bg-white font-bold text-brand ring-1 ring-line hover:ring-brand`}>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-2xl">›</span>
          {moreLabel}
        </Link>
      )}
    </ScrollRow>
  );
}
