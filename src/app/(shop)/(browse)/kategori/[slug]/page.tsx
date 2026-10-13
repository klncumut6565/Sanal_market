import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/shop/ProductCard";
import { GridSkeleton } from "@/components/shop/Skeletons";
import { getCategories, getMemberCatalog, getProducts } from "@/lib/data/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sayfa?: string }> };
const PER = 60;

export async function generateStaticParams() {
  const cats = await getCategories();
  return cats.length ? cats.map((c) => ({ slug: c.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  return { title: cat?.name ?? "Kategori" };
}

export default function CategoryPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <CategoryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CategoryContent({ params, searchParams }: Props) {
  const { slug } = await params;
  const shownPages = Math.max(1, Math.min(100, Number((await searchParams).sayfa) || 1));
  let [categories, products] = await Promise.all([getCategories(), getProducts()]);
  let cat = categories.find((c) => c.slug === slug);
  if (!cat) {
    // Oturuma özel kategori olabilir
    ({ categories, products } = await getMemberCatalog());
    cat = categories.find((c) => c.slug === slug);
  }
  if (!cat) notFound();
  const catId = cat.id;
  const list = products
    .filter((p) => p.category_id === catId)
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  return (
    <div>
      <h1 className="mb-3 text-xl font-black">
        {cat.emoji} {cat.name}
        <span className="ml-2 text-sm font-semibold text-muted">{list.length} ürün</span>
      </h1>
      {list.length ? <ProductGrid products={list.slice(0, shownPages * PER)} /> : <p className="text-muted">Bu kategoride henüz ürün yok.</p>}
      {list.length > shownPages * PER && (
        <div className="mt-5 text-center">
          <Link href={`/kategori/${slug}?sayfa=${shownPages + 1}`} scroll={false} className="btn-ghost px-6">
            Daha fazla göster ({list.length - shownPages * PER} ürün daha)
          </Link>
        </div>
      )}
    </div>
  );
}
