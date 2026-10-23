import { CategoryStrip } from "@/components/shop/CategoryNav";
import { MobileCartBar } from "@/components/shop/CartContents";
import { Suspense } from "react";
import { getCategories, getCategoryCounts, getMemberCatalog, getStoreSettings, mergeCategories } from "@/lib/data/catalog";
import { rollupCounts, topCounts } from "@/lib/categoryTree";
import type { Category } from "@/lib/types";

type Counts = Record<string, number>;

// Üye oturumu varsa üyeye özel kategoriler de şeride eklenir (istek anında, Suspense içinde)
async function MemberNav({ categories, counts }: { categories: Category[]; counts: Counts }) {
  const m = await getMemberCatalog();
  const all = mergeCategories(categories, m.categories);
  return <CategoryStrip categories={all} counts={{ ...counts, ...topCounts(m.categories, m.products) }} hideOnHome />;
}

// Kenar menüsü yok: kategoriler üstte yatay kartlar (ana sayfada hero'nun altında, diğer sayfalarda en üstte)
export default async function BrowseLayout({ children }: { children: React.ReactNode }) {
  // Tüm ürün listesi DEĞİL, yalnızca kategori başına sayılar (istek anında çizilen sayfalarda soğuk sunucuyu bekletmesin)
  const [categories, settings, perCat] = await Promise.all([getCategories(), getStoreSettings(), getCategoryCounts()]);
  const counts = rollupCounts(categories, perCat);
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-3 lg:pt-5">
      <div className="mb-4">
        <Suspense fallback={<CategoryStrip categories={categories} counts={counts} hideOnHome />}>
          <MemberNav categories={categories} counts={counts} />
        </Suspense>
      </div>
      <div className="min-w-0">{children}</div>
      <MobileCartBar settings={settings} />
    </div>
  );
}
