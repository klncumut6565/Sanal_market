// İndirimdeki ürünler — her iki sesli asistan için ortak sorgu.
import type { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/data/fetchAll";

type Sb = ReturnType<typeof createClient>;

export async function fetchDiscounts(sb: Sb, opts: { includeInactive?: boolean; query?: string; limit?: number; categoryIds?: Set<string> } = {}) {
  const { data, error } = await fetchAll((f, t) => {
    let q = sb
      .from("products")
      .select("id,name,unit_label,price,sale_price,stock,is_active,category_id,categories(name)")
      .not("sale_price", "is", null);
    if (!opts.includeInactive) q = q.eq("is_active", true);
    return q.order("id").range(f, t);
  });
  if (error) return { error: error.message };
  const term = (opts.query ?? "").trim().toLocaleLowerCase("tr");
  const rows = (data ?? [])
    .filter((p) => !opts.categoryIds || !p.category_id || opts.categoryIds.has(p.category_id))
    .map((p) => {
      const price = Number(p.price);
      const sale = Number(p.sale_price);
      const cat = (p.categories as unknown as { name: string } | null)?.name ?? null;
      return {
        product_id: p.id,
        name: p.name,
        unit: p.unit_label,
        category: cat,
        price,
        sale_price: sale,
        discount_pct: price > 0 ? Math.round(((price - sale) / price) * 100) : 0,
        saving_tl: Math.round((price - sale) * 100) / 100,
        in_stock: p.stock > 0,
        stock: p.stock,
        on_sale_in_store: p.is_active,
      };
    })
    .filter((p) => p.sale_price < p.price) // indirim fiyatı normalden düşük olmalı
    .filter((p) => !term || p.name.toLocaleLowerCase("tr").includes(term) || (p.category ?? "").toLocaleLowerCase("tr").includes(term))
    .sort((a, b) => b.discount_pct - a.discount_pct);
  const limit = Math.max(1, Math.min(50, opts.limit ?? 20));
  return {
    count: rows.length,
    biggest: rows[0] ? { name: rows[0].name, discount_pct: rows[0].discount_pct } : undefined,
    products: rows.slice(0, limit),
  };
}
