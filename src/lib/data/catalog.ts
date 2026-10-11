import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { hasSupabase } from "@/lib/supabase/env";
import type { Category, Product, StoreSettings } from "@/lib/types";

export const CATALOG_TAG = "catalog";
export const SETTINGS_TAG = "settings";

const PRODUCT_COLS =
  "id,category_id,name,slug,description,unit_label,price,sale_price,stock,critical_stock,max_per_order,image_url,emoji,is_active,is_featured,sort_order";

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
  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_COLS)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
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
