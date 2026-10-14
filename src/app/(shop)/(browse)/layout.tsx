import { CategoryChips, CategorySidebar } from "@/components/shop/CategoryNav";
import { MobileCartBar } from "@/components/shop/CartContents";
import { Suspense } from "react";
import { getCategories, getMemberCatalog, getStoreSettings, mergeCategories } from "@/lib/data/catalog";
import type { Category } from "@/lib/types";

// Üye oturumu varsa üyeye özel kategoriler de menüye eklenir (istek anında, Suspense içinde)
async function MemberNav({ categories, kind }: { categories: Category[]; kind: "sidebar" | "chips" }) {
  const all = mergeCategories(categories, (await getMemberCatalog()).categories);
  return kind === "sidebar" ? <CategorySidebar categories={all} /> : <CategoryChips categories={all} />;
}

export default async function BrowseLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([getCategories(), getStoreSettings()]);
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-3 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-4 lg:pt-5">
      <div className="hidden lg:block">
        <Suspense fallback={<CategorySidebar categories={categories} />}>
          <MemberNav categories={categories} kind="sidebar" />
        </Suspense>
      </div>
      <div className="min-w-0">
        <div className="mb-3 lg:hidden">
          <Suspense fallback={<CategoryChips categories={categories} />}>
            <MemberNav categories={categories} kind="chips" />
          </Suspense>
        </div>
        {children}
      </div>
      <MobileCartBar settings={settings} />
    </div>
  );
}
