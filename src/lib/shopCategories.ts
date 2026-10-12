// Mağaza tarafı (müşteri gözüyle) görünür kategoriler — yönetici istisnası yok.
// Tik durumuna göre veritabanı (shop_categories RPC) karar verir.
import type { createClient } from "@/lib/supabase/client";

type Sb = ReturnType<typeof createClient>;

export async function shopCategories(sb: Sb): Promise<{ id: string; name: string; sort_order: number }[]> {
  const { data } = await sb.rpc("shop_categories");
  return ((data ?? []) as { id: string; name: string; sort_order: number }[]).map((c) => ({ id: c.id, name: c.name, sort_order: c.sort_order }));
}

/** Ürün mağazada bu kişiye görünür mü (kategorisiz ürünler görünür). */
export const visibleIn = (ids: Set<string>) => (p: { category_id: string | null }) => !p.category_id || ids.has(p.category_id);
