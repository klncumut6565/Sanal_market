import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Bike, Clock, CreditCard, Truck } from "lucide-react";
import { ProductRow } from "@/components/shop/ProductCard";
import { Suspense } from "react";
import { getCategories, getMemberCatalog, getProducts, getStoreSettings } from "@/lib/data/catalog";
import { formatTL } from "@/lib/format";
import { VoicePromo } from "@/components/shop/VoicePromo";

export default async function HomePage() {
  const [categories, products, s] = await Promise.all([getCategories(), getProducts(), getStoreSettings()]);
  const deals = products.filter((p) => p.sale_price != null && p.stock > 0);
  const featured = products.filter((p) => p.is_featured);

  return (
    <div className="space-y-7">
      {s.voice_enabled !== false && <VoicePromo />}
      <section className="relative overflow-hidden rounded-3xl bg-ink p-5 text-white sm:p-7">
        <div aria-hidden className="absolute -right-24 -top-28 h-72 w-72 rounded-full border-[14px] border-brand/35 sm:-right-16 sm:-top-20 sm:border-brand/70" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-brand">{s.store_name}</p>
            <h1 className="mt-1 text-[26px] font-black leading-tight sm:text-4xl">
              İhtiyacın <span className="text-brand">Kapında!</span>
            </h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Bike size={14} className="text-brand" /> Motokurye servisi</span>
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><CreditCard size={14} className="text-brand" /> Kapıda nakit / kart</span>
              {s.working_hours && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Clock size={14} className="text-brand" /> {s.working_hours}</span>
              )}
              <span className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5"><Truck size={14} /> {formatTL(s.free_delivery_threshold)} üzeri ücretsiz</span>
            </div>
          </div>
          <Image src="/logo-mark.png" alt="" width={240} height={171} priority className="relative hidden w-44 shrink-0 sm:block md:w-56" />
        </div>
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

      <Suspense fallback={null}>
        <MemberSections />
      </Suspense>

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

/** Üyeye / onaylı üyeye özel kategoriler (yalnızca yetkisi olan oturumda görünür). */
async function MemberSections() {
  const { categories, products } = await getMemberCatalog();
  if (!categories.length) return null;
  return (
    <>
      <section>
        <h2 className="mb-3 text-lg font-extrabold">Üyelerimize özel</h2>
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 xl:grid-cols-6">
          {categories.map((c) => (
            <Link key={c.id} href={`/kategori/${c.slug}`} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-2.5 text-center ring-1 ring-brand/40 transition hover:ring-brand">
              <span className="grid aspect-square w-full place-items-center rounded-xl bg-brand-soft text-3xl">{c.emoji ?? "🛒"}</span>
              <span className="line-clamp-2 text-[12px] font-bold leading-tight">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>
      {categories.map((c) => {
        const list = products.filter((p) => p.category_id === c.id).slice(0, 10);
        return list.length ? <Section key={c.id} title={c.name} href={`/kategori/${c.slug}`} products={list} /> : null;
      })}
    </>
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
