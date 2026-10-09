import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/shop/ProductCard";
import { GridSkeleton } from "@/components/shop/Skeletons";
import { getCategories, getProducts } from "@/lib/data/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const cats = await getCategories();
  return cats.length ? cats.map((c) => ({ slug: c.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  return { title: cat?.name ?? "Kategori" };
}

export default function CategoryPage({ params }: Props) {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}

async function CategoryContent({ params }: Props) {
  const { slug } = await params;
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();
  const list = products
    .filter((p) => p.category_id === cat.id)
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  return (
    <div>
      <h1 className="mb-3 text-xl font-black">
        {cat.emoji} {cat.name}
        <span className="ml-2 text-sm font-semibold text-muted">{list.length} ürün</span>
      </h1>
      {list.length ? <ProductGrid products={list} /> : <p className="text-muted">Bu kategoride henüz ürün yok.</p>}
    </div>
  );
}
