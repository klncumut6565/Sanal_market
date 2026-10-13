import { Suspense } from "react";
import Link from "next/link";
import { CategoryIcon } from "@/components/shop/CategoryIcon";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/shop/ProductCard";
import { GridSkeleton } from "@/components/shop/Skeletons";
import { getCategories, getMemberCatalog, getProducts } from "@/lib/data/catalog";
import { childrenOf, withDescendants } from "@/lib/categoryTree";

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
  // Ana kategoride alt kategorilerin ürünleri de listelenir
  const ids = withDescendants(categories, cat.id);
  const list = products
    .filter((p) => !!p.category_id && ids.has(p.category_id))
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  const parent = cat.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
  const top = parent ?? cat;
  const subs = childrenOf(categories, top.id);
  const chip = "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold ring-1 transition";
  return (
    <div>
      {parent && (
        <Link href={`/kategori/${parent.slug}`} className="mb-1 inline-block text-sm font-semibold text-muted hover:text-brand">
          <CategoryIcon cat={parent} imgClass="h-4 w-4" /> {parent.name} ›
        </Link>
      )}
      <h1 className="mb-3 text-xl font-black">
        {!parent && <CategoryIcon cat={cat} className="mr-1.5" imgClass="mr-1.5 h-7 w-7 align-middle" />}
        {cat.name}
        <span className="ml-2 text-sm font-semibold text-muted">{list.length} ürün</span>
      </h1>
      {subs.length > 0 && (
        <nav aria-label="Alt kategoriler" className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link href={`/kategori/${top.slug}`} className={`${chip} ${cat.id === top.id ? "bg-ink text-white ring-ink" : "bg-white ring-line hover:ring-brand"}`}>
            Tümü
          </Link>
          {subs.map((s) => (
            <Link key={s.id} href={`/kategori/${s.slug}`} className={`${chip} ${cat.id === s.id ? "bg-ink text-white ring-ink" : "bg-white ring-line hover:ring-brand"}`}>
              {s.name}
            </Link>
          ))}
        </nav>
      )}
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
