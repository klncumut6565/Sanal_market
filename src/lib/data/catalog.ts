import "server-only";
import { fetchAll } from "./fetchAll";
import { cache } from "react";
import { cookies } from "next/headers";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import type { Category, Product, StoreSettings } from "@/lib/types";

export const CATALOG_TAG = "catalog";
export const SETTINGS_TAG = "settings";
/** Kategori listesi ayrı etiketli: ürün düzenlemeleri kategori listesini (ve onu kullanan tüm sayfaları) geçersiz kılmasın. */
export const CATEGORIES_TAG = "categories";
/** Tek ürün sayfasının etiketi: o ürün değişince yalnızca o sayfa yenilenir (2000+ ürün sayfası değil). */
export const productTag = (id: string) => `urun-${id}`;

const PRODUCT_COLS =
  "id,category_id,name,slug,description,unit_label,price,sale_price,stock,critical_stock,max_per_order,image_url,extra_images,emoji,is_active,is_featured,sort_order";

const DEFAULT_SETTINGS: StoreSettings = {
  store_name: "Sanal Market",
  phone: null,
  address: null,
  delivery_area_note: null,
  delivery_fee: 29.9,
  free_delivery_threshold: 500,
  min_order_amount: 150,
  delivery_slots: ["En kısa sürede"],
  working_hours: "10:00 - 01:00",
  open_time: "10:00",
  close_time: "01:00",
  whatsapp_phone: null,
  sla_accept_min: 2,
  sla_prepare_min: 7,
  sla_delivery_min: 20,
  is_open: true,
};

const num = (p: Product): Product => ({
  ...p,
  price: Number(p.price),
  sale_price: p.sale_price == null ? null : Number(p.sale_price),
});

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag(CATEGORIES_TAG);
  cacheLife("weeks"); // Vercel ISR yazımı tasarrufu: süreli yenileme haftalık; ürün/ayar değişince updateTag ile anında yenilenir
  if (!hasSupabase) return [];
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) console.error("[katalog] kategoriler alınamadı:", error.message);
  return data ?? [];
}

export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("weeks"); // Vercel ISR yazımı tasarrufu: süreli yenileme haftalık; ürün/ayar değişince updateTag ile anında yenilenir
  if (!hasSupabase) return [];
  const sb = createPublicClient();
  const { data, error } = await fetchAll((f, t) =>
    sb.from("products").select(PRODUCT_COLS).eq("is_active", true).order("sort_order").order("name").order("id").range(f, t),
  );
  if (error) console.error("[katalog] ürünler alınamadı:", error.message);
  return (data ?? []).map(num);
}

/**
 * Ürün sayfası verisi: ürün + aynı kategoriden 10 benzer ürün. Tüm ürün listesine (CATALOG_TAG) bağlı DEĞİL —
 * Vercel ISR yazımı: bir ürün düzenlenince yalnızca o ürünün sayfası yeniden yazılır, diğer ürün sayfaları değil.
 */
export async function getProductPage(slug: string): Promise<{ product: Product; similar: Product[] } | null> {
  "use cache";
  cacheLife("weeks"); // düzenleme/satışta urun-<id> etiketiyle anında yenilenir; günlük yeniden yazım gereksiz ISR yazımıydı
  if (!hasSupabase) return null;
  const sb = createPublicClient();
  const { data } = await sb.from("products").select(PRODUCT_COLS).eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!data) {
    cacheTag(`urun-slug-${slug}`);
    return null;
  }
  const product = num(data as Product);
  cacheTag(productTag(product.id), `urun-slug-${slug}`);
  let similar: Product[] = [];
  if (product.category_id) {
    const { data: sim } = await sb
      .from("products")
      .select(PRODUCT_COLS)
      .eq("is_active", true)
      .eq("category_id", product.category_id)
      .neq("id", product.id)
      .gt("stock", 0)
      .order("sort_order")
      .order("name")
      .limit(10);
    similar = ((sim ?? []) as Product[]).map(num);
  }
  return { product, similar };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const all = await getProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

/** Önbelleksiz: her farklı arama kelimesi ayrı bir ISR yazımı demekti (tekrar oranı düşük). Arama doğrudan RPC'ye gider. */
export async function searchProducts(q: string): Promise<Product[]> {
  if (!hasSupabase || q.trim().length < 2) return [];
  const { data } = await createPublicClient().rpc("search_products", { q: q.trim() });
  return ((data ?? []) as Product[]).map(num);
}

/** Kategori başına son 90 gün satış adedi (online + mağaza). Alt kategorileri tercih sırasına dizmek için; günlük önbellek. */
export async function getCategoryPopularity(): Promise<Record<string, number>> {
  "use cache";
  cacheTag("kategori-populerlik");
  cacheLife("weeks"); // sıralama için yeterli; her gün tüm kategori sayfalarını yeniden yazdırmasın
  if (!hasSupabase) return {};
  const { data, error } = await createPublicClient().rpc("category_popularity");
  if (error) {
    console.error("[katalog] kategori popülerliği alınamadı:", error.message);
    return {};
  }
  return Object.fromEntries(((data ?? []) as { category_id: string; qty: number | string }[]).map((r) => [r.category_id, Number(r.qty)]));
}

/** Ürün başına son 90 gün satış adedi (vitrin sıralaması). Haftalık önbellek — sayfaları sık yeniden yazdırmaz. */
export async function getProductPopularity(): Promise<Record<string, number>> {
  "use cache";
  cacheTag("urun-populerlik");
  cacheLife("weeks");
  if (!hasSupabase) return {};
  const { data, error } = await createPublicClient().rpc("product_popularity");
  if (error) {
    console.error("[katalog] ürün popülerliği alınamadı:", error.message);
    return {};
  }
  return Object.fromEntries(((data ?? []) as { product_id: string; qty: number | string }[]).map((r) => [r.product_id, Number(r.qty)]));
}

/** Vitrin sırası: stokta olan → görseli olan → en çok satan → yönetimdeki sıra (sıralama kararlı). */
export function rankProducts<T extends { id: string; stock: number; image_url: string | null }>(list: T[], pop: Record<string, number>): T[] {
  return list
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        Number(b.p.stock > 0) - Number(a.p.stock > 0) ||
        Number(!!b.p.image_url) - Number(!!a.p.image_url) ||
        (pop[b.p.id] ?? 0) - (pop[a.p.id] ?? 0) ||
        a.i - b.i,
    )
    .map((x) => x.p);
}

/** Alt kategoriler: en çok satan önce, eşitse yönetimdeki sıra. */
export function byPopularity<T extends { id: string; sort_order: number; name: string }>(cats: T[], pop: Record<string, number>): T[] {
  return [...cats].sort((a, b) => (pop[b.id] ?? 0) - (pop[a.id] ?? 0) || a.sort_order - b.sort_order || a.name.localeCompare(b.name, "tr"));
}

export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("weeks"); // Vercel ISR yazımı tasarrufu: süreli yenileme haftalık; ürün/ayar değişince updateTag ile anında yenilenir
  if (!hasSupabase) return DEFAULT_SETTINGS;
  const { data } = await createPublicClient().from("store_settings").select("*").eq("id", 1).single();
  if (!data) return DEFAULT_SETTINGS;
  return {
    ...data,
    delivery_fee: Number(data.delivery_fee),
    free_delivery_threshold: Number(data.free_delivery_threshold),
    min_order_amount: Number(data.min_order_amount),
  };
}

// ---------------------------------------------------------------------
// Oturuma özel katalog (visibility = uye / onayli / ozel). Vitrin önbelleği anonim
// olduğu için bu kategoriler orada yer almaz; oturumlu istemciyle istek anında
// (Suspense içinde) getirilir. Hangi kategorinin görüneceğine RLS karar verir.
// ---------------------------------------------------------------------
async function hasAuthCookie() {
  const store = await cookies();
  return store.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

export const getMemberCatalog = cache(async (): Promise<{ categories: Category[]; products: Product[] }> => {
  const empty = { categories: [], products: [] };
  if (!hasSupabase || !(await hasAuthCookie())) return empty;
  const sb = await createClient();
  // Müşteri gözüyle (yönetici dahil tik durumuna göre) görünen, herkese açık olmayan kategoriler
  const { data: all } = await sb.rpc("shop_categories");
  const cats = ((all ?? []) as Category[]).filter((c) => c.visibility && c.visibility !== "herkes");
  if (!cats.length) return empty;
  const { data: prods } = await fetchAll((f, t) =>
    sb
      .from("products")
      .select(PRODUCT_COLS)
      .eq("is_active", true)
      .in("category_id", cats.map((c) => c.id))
      .order("sort_order")
      .order("name")
      .order("id")
      .range(f, t),
  );
  return { categories: cats, products: (prods ?? []).map(num) };
});

/** Herkese açık + üyeye özel kategoriler, diziliş sırasına göre. */
export function mergeCategories(pub: Category[], extra: Category[]): Category[] {
  if (!extra.length) return pub;
  const seen = new Set(pub.map((c) => c.id));
  return [...pub, ...extra.filter((c) => !seen.has(c.id))].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "tr"));
}

/** Arama: üye oturumu varsa kendi yetkisiyle (üyeye özel ürünler dahil), yoksa önbellekli anonim arama. */
export async function searchProductsForViewer(q: string): Promise<Product[]> {
  if (!hasSupabase || q.trim().length < 2) return [];
  if (!(await hasAuthCookie())) return searchProducts(q);
  const sb = await createClient();
  const { data } = await sb.rpc("search_products", { q: q.trim() });
  return ((data ?? []) as Product[]).map(num);
}
