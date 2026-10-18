// Kategori açılır listeleri için ortak seçenekler: her ana kategori bir grup başlığı (optgroup);
// altında önce ana kategorinin kendisi ("… · ana kategori"), sonra alt kategoriler girintili "↳".
// Böylece hangisinin ana, hangisinin alt kategori olduğu listede ve seçili hâlde açıkça görünür.
import { childrenOf, topLevel } from "@/lib/categoryTree";

type C = { id: string; name: string; sort_order: number; parent_id?: string | null };

export function CategoryOptionList({ categories }: { categories: C[] }) {
  return (
    <>
      {topLevel(categories).map((p) => {
        const kids = childrenOf(categories, p.id);
        return (
          <optgroup key={p.id} label={`▸ ${p.name.toLocaleUpperCase("tr")}${kids.length ? ` (${kids.length} alt)` : ""}`}>
            <option value={p.id}>{p.name} · ana kategori</option>
            {kids.map((ch) => (
              <option key={ch.id} value={ch.id} title={`${p.name} › ${ch.name}`}>
                {"   ↳ "}
                {ch.name} ({p.name})
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}
