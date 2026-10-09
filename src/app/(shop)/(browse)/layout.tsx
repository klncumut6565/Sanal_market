import { CategoryChips, CategorySidebar } from "@/components/shop/CategoryNav";
import { CartPanel, MobileCartBar } from "@/components/shop/CartContents";
import { getCategories, getStoreSettings } from "@/lib/data/catalog";

export default async function BrowseLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([getCategories(), getStoreSettings()]);
  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-3 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_330px] lg:gap-6 lg:pt-5">
      <div className="hidden lg:block">
        <CategorySidebar categories={categories} />
      </div>
      <div className="min-w-0">
        <div className="mb-3 lg:hidden">
          <CategoryChips categories={categories} />
        </div>
        {children}
      </div>
      <div className="hidden lg:block">
        <CartPanel settings={settings} />
      </div>
      <MobileCartBar settings={settings} />
    </div>
  );
}
