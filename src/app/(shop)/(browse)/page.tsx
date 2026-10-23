import Link from "next/link";
import Image from "next/image";
import { CategoryCardBody } from "@/components/shop/CategoryIcon";
import { ChevronRight, Bike, Bot, Clock, CreditCard, Sparkles, Truck } from "lucide-react";
import { ProductRow } from "@/components/shop/ProductCard";
import { ScrollRow } from "@/components/shop/ScrollRow";
import { SubCategoryTabs } from "@/components/shop/SubCategoryTabs";
import type { Category } from "@/lib/types";
import { Suspense } from "react";
import { byPopularity, getCategories, getCategoryPopularity, getMemberCatalog, getProducts, getStoreSettings, mergeCategories } from "@/lib/data/catalog";
import { formatTL } from "@/lib/format";
import { HeroVoice } from "@/components/shop/HeroVoice";
import { Robot } from "@/components/shop/Robot";
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
      {/* KARŞILAMA: başlık + konuşarak sipariş + asistan robotu (görseller statik dosya / SVG — ISR yükü yok) */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#eaf6f1] via-white to-[#e7f4f6] p-5 ring-1 ring-line sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-brand/10 blur-2xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand ring-1 ring-brand/15">
              <Sparkles size={13} /> Geleceğin marketi, şimdi seninle!
            </p>
            <h1 className="mt-3 text-[30px] font-black leading-[1.08] tracking-tight text-navy sm:text-[44px]">Bugün neye ihtiyacın var?</h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              {s.voice_enabled !== false
                ? "Yapay zekâ destekli asistanımızla konuş, siparişini kolayca ver. Çorlu Sanal Market her zaman yanında!"
                : "Çorlu'da market alışverişin kapında. Ürünlerini seç, motokuryemiz getirsin."}
            </p>
            {s.voice_enabled !== false && (
              <div className="mt-5">
                <HeroVoice />
                <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-brand">
                  <Bot size={14} /> Yapay zekâ ile konuşarak sipariş ver
                </p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-navy">
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-line"><Bike size={14} className="text-brand" /> Motokurye servisi</span>
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-line"><CreditCard size={14} className="text-brand" /> Kapıda nakit / kart</span>
              {s.working_hours && (
                <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-line"><Clock size={14} className="text-brand" /> {s.working_hours}</span>
              )}
              <span className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-white"><Truck size={14} /> {formatTL(s.free_delivery_threshold)} üzeri ücretsiz</span>
            </div>
          </div>

          {/* Robot + konuşma balonu + market sepeti (3B ürün görselleri) */}
          <div aria-hidden className="relative mx-auto h-[250px] w-full max-w-[420px] sm:h-[300px]">
            <div className="absolute bottom-3 right-0 h-[150px] w-[210px] rounded-[26px] bg-gradient-to-b from-[#f3ead9] to-[#e6d7bd] shadow-xl shadow-navy/10 sm:h-[170px] sm:w-[240px]">
              <div className="absolute inset-x-0 top-3 flex justify-center">
                <Image src="/logo-mark.svg" alt="" width={60} height={50} unoptimized className="opacity-70" />
              </div>
              <p className="absolute inset-x-0 top-[62px] text-center text-[13px] font-black tracking-[0.12em] text-navy/70">SANAL MARKET</p>
            </div>
            {[
              ["1f966", "right-[150px] bottom-[120px] w-[74px] sm:bottom-[140px]"],
              ["1f35e", "right-[96px] bottom-[132px] w-[70px] rotate-[18deg] sm:bottom-[152px]"],
              ["1f95b", "right-[40px] bottom-[128px] w-[60px] sm:bottom-[148px]"],
              ["1f34c", "right-[-6px] bottom-[96px] w-[78px] sm:bottom-[112px]"],
              ["1f345", "right-[176px] bottom-[18px] w-[50px]"],
              ["1f34e", "right-[-8px] bottom-[10px] w-[48px]"],
            ].map(([f, c]) => (
              <Image key={f} src={`/kategori3d/${f}.webp`} alt="" width={96} height={96} className={`absolute drop-shadow-md ${c}`} />
            ))}
            <div className="absolute bottom-0 left-0 sm:left-2">
              <Robot size={150} className="sm:hidden" />
              <Robot size={178} className="hidden sm:block" />
            </div>
            <div className="absolute left-[118px] top-0 max-w-[170px] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[13px] font-semibold leading-snug text-navy shadow-lg shadow-navy/10 ring-1 ring-line sm:left-[150px] sm:top-2">
              Merhaba! Size nasıl yardımcı olabilirim? 😊
            </div>
          </div>
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

      {deals.length > 0 && <Section title="Fırsat ürünleri 🔥" products={deals.slice(0, 20)} total={deals.length} />}
      {featured.length > 0 && <Section title="Çok satanlar" products={featured.slice(0, 20)} total={featured.length} />}

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
    .map((sc) => ({ id: sc.id, label: sc.name, href: `/kategori/${sc.slug}`, categoryId: sc.id as string | null, items: all.filter((p) => p.category_id === sc.id) }))
    .filter((x) => x.items.length > 0);
  if (tabs.length === 0) return <Section title={cat.name} href={`/kategori/${cat.slug}`} products={all.slice(0, 20)} total={all.length} />;
  const direct = all.filter((p) => p.category_id === cat.id);
  if (direct.length) tabs.push({ id: `${cat.id}-diger`, label: "Diğer", href: `/kategori/${cat.slug}`, categoryId: cat.id, items: direct });
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
        tabs={tabs.map((t) => ({ id: t.id, label: t.label, count: t.items.length, href: t.href, categoryId: t.categoryId }))}
        first={
          <ProductRow
            products={tabs[0].items.slice(0, SUB_ROW)}
            moreHref={tabs[0].items.length > SUB_ROW ? tabs[0].href : undefined}
            moreLabel={`Tümünü gör (${tabs[0].items.length.toLocaleString("tr-TR")})`}
          />
        }
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
