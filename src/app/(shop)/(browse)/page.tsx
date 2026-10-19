import Link from "next/link";
import Image from "next/image";
import { CategoryCardBody } from "@/components/shop/CategoryIcon";
import { ChevronRight, Bike, Clock, CreditCard, Truck } from "lucide-react";
import { ProductRow } from "@/components/shop/ProductCard";
import { ScrollRow } from "@/components/shop/ScrollRow";
import { SubCategoryTabs } from "@/components/shop/SubCategoryTabs";
import type { Category } from "@/lib/types";
import { Suspense } from "react";
import { byPopularity, getCategories, getCategoryPopularity, getMemberCatalog, getProducts, getStoreSettings, mergeCategories } from "@/lib/data/catalog";
import { formatTL } from "@/lib/format";
import { VoicePromo } from "@/components/shop/VoicePromo";
import { childrenOf, topLevel, withDescendants } from "@/lib/categoryTree";
import type { Metadata } from "next";
import { CITY, REGION, SITE_DESCRIPTION, SITE_URL, abs, isPublicCategory, jsonLdHtml } from "@/lib/seo";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [categories, products, s, pop] = await Promise.all([getCategories(), getProducts(), getStoreSettings(), getCategoryPopularity()]);
  const deals = products.filter((p) => p.sale_price != null && p.stock > 0);
  const featured = products.filter((p) => p.is_featured);
  const seoCats = topLevel(categories.filter(isPublicCategory));
  const storeLd = [
    {
      "@context": "https://schema.org",
      "@type": "GroceryStore",
      "@id": `${SITE_URL}/#magaza`,
      name: s.store_name || "Sanal Market",
      url: SITE_URL,
      logo: abs("/logo.png"),
      image: abs("/logo.png"),
      description: SITE_DESCRIPTION,
      ...(s.phone ? { telephone: s.phone } : {}),
      ...(s.address ? { address: { "@type": "PostalAddress", streetAddress: s.address, addressLocality: CITY, addressRegion: REGION, addressCountry: "TR" } } : {}),
      areaServed: { "@type": "City", name: `${CITY}, ${REGION}` },
      currenciesAccepted: "TRY",
      paymentAccepted: "Nakit, Kredi Kartı",
      ...(s.open_time && s.close_time
        ? {
            openingHoursSpecification: {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
              opens: s.open_time,
              closes: s.close_time,
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Sanal Market",
      url: SITE_URL,
      inLanguage: "tr-TR",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/ara?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <div className="space-y-7">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(storeLd)} />
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
          {/* Üyeye özel kategoriler aynı sıraya katılır (sıralama korunur) */}
          <Suspense fallback={<CategoryTiles categories={topLevel(categories)} />}>
            <AllCategoryTiles categories={categories} />
          </Suspense>
        </section>
      )}

      <Suspense fallback={null}>
        <MemberSections />
      </Suspense>

      {deals.length > 0 && <Section title="Fırsat ürünleri 🔥" products={deals} />}
      {featured.length > 0 && <Section title="Çok satanlar" products={featured} />}

      {topLevel(categories).map((c) => (
        <CategorySection key={c.id} cat={c} categories={categories} products={products} pop={pop} />
      ))}

      <section className="rounded-3xl bg-white p-5 text-sm leading-relaxed text-muted ring-1 ring-line sm:p-6">
        <h2 className="mb-2 text-base font-extrabold text-ink">{CITY} online market: market alışverişiniz kapınızda</h2>
        <p>
          Sanal Market, {CITY}&apos;da market alışverişini evden yapmanızı sağlayan online markettir. Gıda ve temel tüketim,
          içecek, atıştırmalık, temizlik, kağıt ve hijyen ürünlerini sipariş edin; motokuryemiz siparişinizi kapınıza getirsin.
          Ödemeyi kapıda nakit veya kartla yapabilirsiniz.
          {s.working_hours ? ` Her gün ${s.working_hours} saatleri arasında sipariş alıyoruz.` : ""}
          {` ${formatTL(s.free_delivery_threshold)} ve üzeri siparişlerde teslimat ücretsiz.`}
        </p>
        {seoCats.length > 0 && (
          <p className="mt-3">
            Kategoriler:{" "}
            {seoCats.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/kategori/${c.slug}`} className="font-semibold text-ink underline-offset-2 hover:text-brand hover:underline">
                  {c.name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </section>

      {products.length === 0 && (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-line">
          <p className="font-bold">Henüz ürün yok</p>
          <p className="mt-1 text-sm text-muted">Yönetim panelinden ürün ekleyin veya örnek veriyi (supabase/seed.sql) yükleyin.</p>
        </div>
      )}
    </div>
  );
}

async function AllCategoryTiles({ categories }: { categories: Category[] }) {
  const member = (await getMemberCatalog()).categories;
  return <CategoryTiles categories={topLevel(mergeCategories(categories, member))} />;
}

/** Oturuma göre ek kategoriler — normal kategoriler gibi, ayrı etiket olmadan gösterilir. */
async function MemberSections() {
  const [{ categories, products }, pop] = await Promise.all([getMemberCatalog(), getCategoryPopularity()]);
  if (!categories.length) return null;
  return (
    <>
      {topLevel(categories).map((c) => (
        <CategorySection key={c.id} cat={c} categories={categories} products={products} pop={pop} />
      ))}
    </>
  );
}

type Prods = Awaited<ReturnType<typeof getProducts>>;
const SUB_ROW = 10;

/**
 * Ana kategori bölümü: başlığın hemen altında alt kategori sekmeleri yan yana (en çok tercih edilen ilk, seçili);
 * altında seçili alt kategorinin ürün satırı. Doğrudan ana kategorideki ürünler "Diğer" sekmesinde.
 * Alt kategori yoksa eskisi gibi tek satır.
 */
function CategorySection({ cat, categories, products, pop }: { cat: Category; categories: Category[]; products: Prods; pop: Record<string, number> }) {
  const ids = withDescendants(categories, cat.id);
  const all = products.filter((p) => !!p.category_id && ids.has(p.category_id));
  if (all.length === 0) return null;
  const tabs = byPopularity(childrenOf(categories, cat.id), pop)
    .map((sc) => ({ id: sc.id, label: sc.name, href: `/kategori/${sc.slug}`, items: all.filter((p) => p.category_id === sc.id) }))
    .filter((x) => x.items.length > 0);
  if (tabs.length === 0) return <Section title={cat.name} href={`/kategori/${cat.slug}`} products={all.slice(0, 20)} total={all.length} />;
  const direct = all.filter((p) => p.category_id === cat.id);
  if (direct.length) tabs.push({ id: `${cat.id}-diger`, label: "Diğer", href: `/kategori/${cat.slug}`, items: direct });
  const n = all.length.toLocaleString("tr-TR");
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{cat.name}</h2>
        <Link href={`/kategori/${cat.slug}`} className="flex items-center text-sm font-bold text-brand">
          Tümü ({n} ürün) <ChevronRight size={16} />
        </Link>
      </div>
      <SubCategoryTabs
        tabs={tabs.map((t) => ({ id: t.id, label: t.label, count: t.items.length }))}
        panels={tabs.map((t) => (
          <ProductRow
            key={t.id}
            products={t.items.slice(0, SUB_ROW)}
            moreHref={t.items.length > SUB_ROW ? t.href : undefined}
            moreLabel={`Tümünü gör (${t.items.length.toLocaleString("tr-TR")})`}
          />
        ))}
      />
    </section>
  );
}

function Section({ title, href, products, total }: { title: string; href?: string; products: Prods; total?: number }) {
  const n = total ?? products.length;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {href && (
          <Link href={href} className="flex items-center text-sm font-bold text-brand">
            Tümü ({n.toLocaleString("tr-TR")} ürün) <ChevronRight size={16} />
          </Link>
        )}
      </div>
      <ProductRow products={products} moreHref={href} moreLabel={`Tümünü gör (${n.toLocaleString("tr-TR")})`} />
    </section>
  );
}

/** Kategori kutuları tek sırada; bilgisayarda ‹ › oklarıyla, telefonda parmakla kayar. */
function CategoryTiles({ categories }: { categories: Category[] }) {
  return (
    <ScrollRow arrowTop="top-[40%]">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/kategori/${c.slug}`}
          className="group block w-[42%] shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-line transition hover:shadow-lg hover:ring-brand/40 sm:w-[30%] lg:w-[23%] xl:w-[18.6%] 2xl:w-[15.6%]"
        >
          <CategoryCardBody cat={c} />
        </Link>
      ))}
    </ScrollRow>
  );
}
