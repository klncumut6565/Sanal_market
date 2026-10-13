import { requireAdmin } from "@/lib/data/auth";
import { fetchAll } from "@/lib/data/fetchAll";
import { CategoryRowForm } from "@/components/admin/CategoryRowForm";
import type { Category } from "@/lib/types";
import { childrenOf, topLevel } from "@/lib/categoryTree";

export const metadata = { title: "Kategoriler" };

export default async function CategoriesAdmin() {
  const { supabase } = await requireAdmin();
  const [{ data: cats }, { data: counts }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name"),
    fetchAll((f, t) => supabase.from("products").select("category_id").order("id").range(f, t)),
  ]);
  const countMap = new Map<string, number>();
  for (const r of counts ?? []) if (r.category_id) countMap.set(r.category_id, (countMap.get(r.category_id) ?? 0) + 1);

  const all = (cats ?? []) as Category[];
  const parents = topLevel(all);
  const parentOpts = parents.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-black">Kategoriler</h1>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 font-extrabold">Yeni ana kategori</h2>
        <CategoryRowForm total={parents.length} parents={parentOpts} />
      </div>
      <div className="space-y-3">
        {parents.map((c) => {
          const subs = childrenOf(all, c.id);
          const subCount = subs.reduce((a, s) => a + (countMap.get(s.id) ?? 0), 0);
          return (
            <div key={c.id} className="rounded-2xl bg-white p-3 ring-1 ring-line">
              <CategoryRowForm category={c} productCount={countMap.get(c.id) ?? 0} parents={parentOpts} subCount={subs.length ? subCount : undefined} />
              <div className="ml-4 mt-2 space-y-2 border-l-2 border-brand/20 pl-3 sm:ml-8">
                {subs.map((s) => (
                  <div key={s.id} className="rounded-xl bg-bg p-2.5">
                    <CategoryRowForm category={s} productCount={countMap.get(s.id) ?? 0} parents={parentOpts} />
                  </div>
                ))}
                <details className="group rounded-xl">
                  <summary className="cursor-pointer list-none py-1 text-sm font-bold text-brand">+ &quot;{c.name}&quot; altına alt kategori ekle</summary>
                  <div className="mt-2 rounded-xl bg-brand-soft/50 p-2.5">
                    <CategoryRowForm parentId={c.id} parentName={c.name} total={subs.length} parents={parentOpts} />
                  </div>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
