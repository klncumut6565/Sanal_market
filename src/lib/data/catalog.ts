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
  cacheTag(CATALOG_TAG);
  cacheLife("minutes");
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
  cacheLife("minutes");
  if (!hasSupabase) return [];
  const sb = createPublicClient();
  const { data, error } = await fetchAll((f, t) =>
    sb.from("products").select(PRODUCT_COLS).eq("is_active", true).order("sort_order").order("name").order("id").range(f, t),
  );
  if (error) console.error("[katalog] ürünler alınamadı:", error.message);
  return (data ?? []).map(num);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const all = await getProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function searchProducts(q: string): Promise<Product[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("minutes");
  if (!hasSupabase || q.trim().length < 2) return [];
  const { data } = await createPublicClient().rpc("search_products", { q: q.trim() });
  return ((data ?? []) as Product[]).map(num);
}

export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("minutes");
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
