import { Suspense } from "react";
import { ProductGrid } from "@/components/shop/ProductCard";
import { GridSkeleton } from "@/components/shop/Skeletons";
import { searchProducts } from "@/lib/data/catalog";

export const metadata = { title: "Arama" };

type Props = { searchParams: Promise<{ q?: string }> };

export default function SearchPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").slice(0, 60);
  const results = await searchProducts(q);
  return (
    <div>
      <h1 className="mb-3 text-xl font-black">
        “{q}” <span className="text-sm font-semibold text-muted">{results.length} sonuç</span>
      </h1>
      {results.length ? (
        <ProductGrid products={results} />
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-line">
          <p className="font-bold">Sonuç bulunamadı</p>
          <p className="mt-1 text-sm text-muted">Farklı bir kelimeyle aramayı dene.</p>
        </div>
      )}
    </div>
  );
}
