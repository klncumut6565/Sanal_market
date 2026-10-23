import Link from "next/link";
import Image from "next/image";
import { CategoryCardBody } from "@/components/shop/CategoryIcon";
import { ArrowRight, ChevronRight, Bike, Bot, Clock, CreditCard, Flame, Mic, ShieldCheck, Sparkles, Truck, Zap } from "lucide-react";
import { CategoryStrip } from "@/components/shop/CategoryNav";
import { ProductRow } from "@/components/shop/ProductCard";
import { ScrollRow } from "@/components/shop/ScrollRow";
import { SubCategoryTabs } from "@/components/shop/SubCategoryTabs";
import type { Category } from "@/lib/types";
import { Suspense } from "react";
import { byPopularity, getCategories, getCategoryPopularity, getMemberCatalog, getProducts, getStoreSettings, mergeCategories } from "@/lib/data/catalog";
import { formatTL } from "@/lib/format";
import { HeroVoice, OpenVoiceButton } from "@/components/shop/HeroVoice";
import { Robot } from "@/components/shop/Robot";
import { childrenOf, topCounts, topLevel, withDescendants } from "@/lib/categoryTree";
import type { Metadata } from "next";
import { CITY, REGION, SITE_DESCRIPTION, SITE_URL, abs, isPublicCategory, jsonLdHtml } from "@/lib/seo";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [categories, products, s, pop] = await Promise.all([getCategories(), getProducts(), getStoreSettings(), getCategoryPopularity()]);
  const deals = products.filter((p) => p.sale_price != null && p.stock > 0);
  const featured = products.filter((p) => p.is_featured);
  const counts = topCounts(categories, products);
  // Popüler ürünler: öne çıkanlar; yoksa indirimdekiler; o da yoksa stoktaki ilk ürünler
  const popular = (featured.length ? featured : deals.length ? deals : products.filter((p) => p.stock > 0)).slice(0, 20);
  const firstCat = topLevel(categories)[0];
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

          {/* Hızlı teslimat kartı (geniş ekran) */}
          <div className="absolute right-0 top-0 z-10 hidden w-[150px] rounded-2xl bg-gradient-to-br from-brand to-[#0b7a60] p-3.5 text-center text-white shadow-xl shadow-brand/25 xl:block">
            <Zap size={22} className="mx-auto" />
            <p className="mt-1.5 text-[15px] font-extrabold leading-tight">{CITY}&apos;da hızlı teslimat</p>
            <p className="mt-1 text-[11px] text-white/85">Motokurye ile kapına</p>
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

      {/* Kategori kartları (yatay şerit) — düzendeki kopya ana sayfada gizli */}
      {categories.length > 0 && (
        <Suspense fallback={<CategoryStrip categories={categories} counts={counts} />}>
          <HomeStrip categories={categories} counts={counts} />
        </Suspense>
      )}

      {/* İki tanıtım kartı (statik) */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="relative flex min-h-[170px] items-center overflow-hidden rounded-[24px] bg-gradient-to-r from-[#fdf8ef] via-[#f7f5f0] to-[#eef1f4] p-5 ring-1 ring-line sm:p-6">
          <div aria-hidden className="relative mr-3 hidden h-[130px] w-[150px] shrink-0 sm:block">
            <Image src="/kategori3d/1f957.webp" alt="" width={120} height={120} className="absolute left-1 top-1 h-[112px] w-[112px] drop-shadow-lg" />
            <Image src="/kategori3d/1f345.webp" alt="" width={56} height={56} className="absolute bottom-0 right-2 h-12 w-12 drop-shadow" />
            <Image src="/kategori3d/1f955.webp" alt="" width={56} height={56} className="absolute right-0 top-0 h-11 w-11 rotate-12 drop-shadow" />
            <Image src="/kategori3d/1f96c.webp" alt="" width={56} height={56} className="absolute bottom-1 left-0 h-11 w-11 drop-shadow" />
          </div>
          <div className="relative min-w-0">
            <h2 className="text-[21px] font-extrabold leading-tight text-navy sm:text-[23px]">Sağlıklı ve pratik tarifler için ihtiyacın olan her şey burada!</h2>
            <Link href={firstCat ? `/kategori/${firstCat.slug}` : "/ara"} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-navy shadow-sm ring-1 ring-line hover:ring-brand">
              Alışverişe Başla <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="relative flex min-h-[170px] items-center overflow-hidden rounded-[24px] bg-gradient-to-br from-brand to-[#0d9e86] p-5 text-white sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent/25 blur-2xl" />
          <div className="relative min-w-0 flex-1">
            <h2 className="text-[23px] font-extrabold leading-tight sm:text-[26px]">Konuş, sipariş ver!</h2>
            <p className="mt-1.5 max-w-[240px] text-sm text-white/85">Sadece birkaç kelime ile alışverişini tamamla.</p>
            {s.voice_enabled !== false ? (
              <OpenVoiceButton className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-navy shadow-sm hover:bg-brand-soft">
                Şimdi Dene <ArrowRight size={16} />
              </OpenVoiceButton>
            ) : (
              <Link href="/ara" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-navy">
                Ürün ara <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {/* telefon çizimi */}
          <div aria-hidden className="relative -mb-12 ml-2 hidden h-[190px] w-[112px] shrink-0 rotate-[8deg] rounded-[22px] border-[5px] border-navy bg-white shadow-2xl sm:block">
            <div className="mx-auto mt-1.5 h-1.5 w-8 rounded-full bg-navy/80" />
            <div className="mt-3 flex items-center justify-center gap-1">
              <Image src="/logo-mark.svg" alt="" width={22} height={18} unoptimized />
              <span className="text-[8px] font-black tracking-wide text-navy">SANAL MARKET</span>
            </div>
            <div className="mx-auto mt-6 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-accent to-brand text-white shadow-lg shadow-accent/40">
              <Mic size={24} />
            </div>
            <div className="mt-4 flex items-end justify-center gap-[3px]">
              {[6, 12, 18, 10, 16, 8, 14, 6].map((h, i) => (
                <span key={i} className="w-[3px] rounded-full bg-accent" style={{ height: h }} />
              ))}
            </div>
          </div>
        </section>
      </div>

      <Suspense fallback={null}>
        <MemberSections />
      </Suspense>

      {popular.length > 0 && <Section title="Popüler Ürünler" icon={<Flame size={20} className="text-[#ff6a3d]" />} products={popular} />}

      {categories.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-extrabold text-navy">Kategoriler</h2>
            <p className="text-sm text-muted">Aradığın her şey bir tık uzağında.</p>
          </div>
          {/* Üyeye özel kategoriler aynı sıraya katılır (sıralama korunur) */}
          <Suspense fallback={<CategoryTiles categories={topLevel(categories)} counts={counts} />}>
            <AllCategoryTiles categories={categories} counts={counts} />
          </Suspense>
        </section>
      )}

      {/* Güven şeridi */}
      <section className="grid grid-cols-2 gap-3 rounded-[22px] bg-[#eef6f4] p-4 ring-1 ring-line sm:p-5 lg:grid-cols-4">
        {[
          [Truck, "Hızlı Teslimat", `${CITY} içi motokurye`],
          [CreditCard, "Kapıda Ödeme", "Nakit / Kart"],
          [Clock, "Çalışma Saatleri", s.working_hours || "Her gün"],
          [ShieldCheck, "Güvenli Alışveriş", "%100 güvenli"],
        ].map(([I, t, d]) => {
          const Icon = I as typeof Truck;
          return (
            <div key={t as string} className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand ring-1 ring-brand/15">
                <Icon size={20} />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[13.5px] font-extrabold text-navy">{t as string}</span>
                <span className="block text-xs text-muted">{d as string}</span>
              </span>
            </div>
          );
        })}
      </section>

      {featured.length > 0 && deals.length > 0 && <Section title="Fırsat ürünleri 🔥" products={deals.slice(0, 20)} total={deals.length} />}

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

async function AllCategoryTiles({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  const m = await getMemberCatalog();
  return <CategoryTiles categories={topLevel(mergeCategories(categories, m.categories))} counts={{ ...counts, ...topCounts(m.categories, m.products) }} />;
}

async function HomeStrip({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  const m = await getMemberCatalog();
  return <CategoryStrip categories={mergeCategories(categories, m.categories)} counts={{ ...counts, ...topCounts(m.categories, m.products) }} />;
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

function Section({ title, href, products, total, icon }: { title: string; href?: string; products: Prods; total?: number; icon?: React.ReactNode }) {
  const n = total ?? products.length;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-lg font-extrabold text-navy">{icon}{title}</h2>
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
function CategoryTiles({ categories, counts }: { categories: Category[]; counts?: Record<string, number> }) {
  return (
    <ScrollRow arrowTop="top-[40%]">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/kategori/${c.slug}`}
          className="group block w-[42%] shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-line transition hover:shadow-lg hover:ring-brand/40 sm:w-[30%] lg:w-[18.6%] xl:w-[15.6%] 2xl:w-[13.4%]"
        >
          <CategoryCardBody cat={c} count={counts?.[c.id]} />
        </Link>
      ))}
    </ScrollRow>
  );
}
