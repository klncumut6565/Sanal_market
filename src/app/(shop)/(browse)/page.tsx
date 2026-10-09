import Link from "next/link";
import { ChevronRight, Banknote, CreditCard, Truck } from "lucide-react";
import { ProductRow } from "@/components/shop/ProductCard";
import { getCategories, getProducts, getStoreSettings } from "@/lib/data/catalog";
import { formatTL } from "@/lib/format";

export default async function HomePage() {
  const [categories, products, s] = await Promise.all([getCategories(), getProducts(), getStoreSettings()]);
  const deals = products.filter((p) => p.sale_price != null && p.stock > 0);
  const featured = products.filter((p) => p.is_featured);

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-brand p-5 text-white sm:p-7">
        <div className="relative z-10 max-w-md">
          <p className="text-sm font-semibold opacity-90">{s.store_name}</p>
          <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">Market alışverişin kapında</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"><Truck size={14} /> {formatTL(s.free_delivery_threshold)} üzeri ücretsiz teslimat</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"><Banknote size={14} /> Kapıda nakit</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"><CreditCard size={14} /> Kapıda kart</span>
          </div>
        </div>
        <div aria-hidden className="absolute -right-6 -top-6 select-none text-[150px] leading-none opacity-25 sm:text-[190px]">🛒</div>
      </section>

      {categories.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold">Kategoriler</h2>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 xl:grid-cols-6">
            {categories.map((c) => (
              <Link key={c.id} href={`/kategori/${c.slug}`} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-2.5 text-center ring-1 ring-line transition hover:ring-brand">
                <span className="grid aspect-square w-full place-items-center rounded-xl bg-brand-soft text-3xl">{c.emoji ?? "🛒"}</span>
                <span className="line-clamp-2 text-[12px] font-bold leading-tight">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {deals.length > 0 && <Section title="Fırsat ürünleri 🔥" products={deals} />}
      {featured.length > 0 && <Section title="Çok satanlar" products={featured} />}

      {categories.map((c) => {
        const list = products.filter((p) => p.category_id === c.id).slice(0, 10);
        if (list.length === 0) return null;
        return <Section key={c.id} title={c.name} href={`/kategori/${c.slug}`} products={list} />;
      })}

      {products.length === 0 && (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-line">
          <p className="font-bold">Henüz ürün yok</p>
          <p className="mt-1 text-sm text-muted">Yönetim panelinden ürün ekleyin veya örnek veriyi (supabase/seed.sql) yükleyin.</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, href, products }: { title: string; href?: string; products: Awaited<ReturnType<typeof getProducts>> }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {href && (
          <Link href={href} className="flex items-center text-sm font-bold text-brand">
            Tümü <ChevronRight size={16} />
          </Link>
        )}
      </div>
      <ProductRow products={products} />
    </section>
  );
}
