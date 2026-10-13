import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { AddToCart } from "@/components/shop/AddToCart";
import { Price } from "@/components/shop/Price";
import { ProductImage } from "@/components/shop/ProductImage";
import { ProductRow } from "@/components/shop/ProductCard";
import { getCategories, getMemberCatalog, getProductBySlug, getProducts } from "@/lib/data/catalog";
import { discountRate } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  // Yalnızca öne çıkan / indirimli ilk 100 ürün derlemede hazırlanır; kalanlar ilk ziyarette oluşturulup önbelleğe alınır
  // (3000+ ürün sayfasını her yayında derlemek yayın süresini çok uzatır).
  const products = (await getProducts()).filter((p) => p.is_featured || p.sale_price != null).slice(0, 100);
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  return { title: p?.name ?? "Ürün" };
}

export default function ProductPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: Props) {
  const slug = (await params).slug;
  let p = await getProductBySlug(slug);
  let [cats, all] = await Promise.all([getCategories(), getProducts()]);
  if (!p) {
    // Oturuma özel ürün olabilir
    ({ categories: cats, products: all } = await getMemberCatalog());
    p = all.find((x) => x.slug === slug) ?? null;
  }
  if (!p) notFound();
  const cat = cats.find((c) => c.id === p.category_id);
  const similar = all.filter((x) => x.category_id === p.category_id && x.id !== p.id).slice(0, 10);
  const off = discountRate(p);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-white p-4 ring-1 ring-line sm:p-6">
        {cat && (
          <Link href={`/kategori/${cat.slug}`} className="mb-3 inline-flex items-center text-sm font-semibold text-muted hover:text-brand">
            <ChevronLeft size={16} /> {cat.name}
          </Link>
        )}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="relative">
            <ProductImage src={p.image_url} emoji={p.emoji} alt={p.name} size="lg" />
            {off > 0 && <span className="absolute left-3 top-3 rounded-lg bg-brand px-2 py-1 text-sm font-bold text-white">%{off} indirim</span>}
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black leading-tight">{p.name}</h1>
            {p.unit_label && <p className="mt-1 text-muted">{p.unit_label}</p>}
            <div className="mt-4">
              <Price price={p.price} sale={p.sale_price} large />
            </div>
            {p.stock > 0 && p.stock <= p.critical_stock && (
              <p className="mt-2 text-sm font-bold text-warn">Son {p.stock} ürün!</p>
            )}
            <div className="mt-5 max-w-xs">
              <AddToCart product={p} variant="wide" />
            </div>
            {p.description && (
              <div className="mt-6 border-t border-line pt-4">
                <h2 className="mb-1 font-bold">Ürün açıklaması</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{p.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {similar.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold">Benzer ürünler</h2>
          <ProductRow products={similar} />
        </section>
      )}
    </div>
  );
}
