import { requireAdmin } from "@/lib/data/auth";
import { CategoryRowForm } from "@/components/admin/CategoryRowForm";
import type { Category } from "@/lib/types";

export const metadata = { title: "Kategoriler" };

export default async function CategoriesAdmin() {
  const { supabase } = await requireAdmin();
  const [{ data: cats }, { data: counts }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name"),
    supabase.from("products").select("category_id"),
  ]);
  const countMap = new Map<string, number>();
  for (const r of counts ?? []) if (r.category_id) countMap.set(r.category_id, (countMap.get(r.category_id) ?? 0) + 1);

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-black">Kategoriler</h1>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 font-extrabold">Yeni kategori</h2>
        <CategoryRowForm total={(cats ?? []).length} />
      </div>
      <div className="space-y-2">
        {((cats ?? []) as Category[]).map((c) => (
          <div key={c.id} className="rounded-2xl bg-white p-3 ring-1 ring-line">
            <CategoryRowForm category={c} productCount={countMap.get(c.id) ?? 0} />
          </div>
        ))}
      </div>
    </div>
  );
}
