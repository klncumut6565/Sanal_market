"use server";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/data/auth";
import { CATALOG_TAG, SETTINGS_TAG } from "@/lib/data/catalog";
import { slugify } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export type ActionState = { error?: string; ok?: string };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// ---------------- ÜRÜNLER ----------------
export async function saveProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const price = numOrNull(fd, "price");
  const sale = numOrNull(fd, "sale_price");
  const stock = numOrNull(fd, "stock");

  if (name.length < 2) return { error: "Ürün adı girin." };
  if (price == null || Number.isNaN(price) || price < 0) return { error: "Geçerli bir fiyat girin." };
  if (sale != null && (Number.isNaN(sale) || sale < 0 || sale >= price))
    return { error: "İndirimli fiyat normal fiyattan düşük olmalı." };
  if (stock == null || Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) return { error: "Stok tam sayı olmalı." };

  const row = {
    name,
    slug: slugify(str(fd, "slug") || name),
    category_id: str(fd, "category_id") || null,
    description: str(fd, "description") || null,
    unit_label: str(fd, "unit_label") || null,
    price,
    sale_price: sale,
    stock,
    critical_stock: Math.max(0, Math.trunc(numOrNull(fd, "critical_stock") ?? 5)),
    max_per_order: Math.max(1, Math.trunc(numOrNull(fd, "max_per_order") ?? 20)),
    image_url: str(fd, "image_url") || null,
    emoji: str(fd, "emoji") || null,
    is_active: fd.get("is_active") === "on",
    is_featured: fd.get("is_featured") === "on",
    sort_order: Math.trunc(numOrNull(fd, "sort_order") ?? 0),
  };

  const { error } = id
    ? await supabase.from("products").update(row).eq("id", id)
    : await supabase.from("products").insert(row);
  if (error) return { error: error.code === "23505" ? "Bu bağlantı adı (slug) zaten kullanılıyor." : error.message };

  updateTag(CATALOG_TAG);
  redirect("/admin/urunler");
}

export async function deleteProduct(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("products").delete().eq("id", str(fd, "id"));
  updateTag(CATALOG_TAG);
  redirect("/admin/urunler");
}

export async function quickUpdateProduct(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, "id");
  const patch: Record<string, unknown> = {};
  const stock = numOrNull(fd, "stock");
  if (stock != null && Number.isInteger(stock) && stock >= 0) patch.stock = stock;
  if (fd.has("toggle_active")) patch.is_active = str(fd, "toggle_active") === "1";
  if (Object.keys(patch).length) {
    await supabase.from("products").update(patch).eq("id", id);
    updateTag(CATALOG_TAG);
  }
}

// ---------------- KATEGORİLER ----------------
export async function saveCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Kategori adı girin." };
  const row = {
    name,
    slug: slugify(str(fd, "slug") || name),
    emoji: str(fd, "emoji") || null,
    sort_order: Math.trunc(numOrNull(fd, "sort_order") ?? 0),
    is_active: fd.get("is_active") === "on",
  };
  const { error } = id
    ? await supabase.from("categories").update(row).eq("id", id)
    : await supabase.from("categories").insert(row);
  if (error) return { error: error.code === "23505" ? "Bu kategori zaten var." : error.message };
  updateTag(CATALOG_TAG);
  return { ok: id ? "Güncellendi" : "Eklendi" };
}

export async function deleteCategory(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("categories").delete().eq("id", str(fd, "id"));
  updateTag(CATALOG_TAG);
}

// ---------------- SİPARİŞLER ----------------
export async function setOrderStatus(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, "id");
  const status = str(fd, "status") as OrderStatus;
  const { error } = await supabase.rpc("admin_set_order_status", { p_order_id: id, p_status: status });
  if (status === "iptal" && !error) updateTag(CATALOG_TAG); // stok iade edildi
  redirect(`/admin/siparisler/${id}${error ? "?hata=1" : ""}`);
}

// ---------------- AYARLAR ----------------
export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const fee = numOrNull(fd, "delivery_fee");
  const free = numOrNull(fd, "free_delivery_threshold");
  const min = numOrNull(fd, "min_order_amount");
  for (const v of [fee, free, min]) if (v == null || Number.isNaN(v) || v < 0) return { error: "Tutarları kontrol edin." };
  const slots = str(fd, "delivery_slots")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (slots.length === 0) return { error: "En az bir teslimat saati girin." };

  const { error } = await supabase
    .from("store_settings")
    .update({
      store_name: str(fd, "store_name") || "Sanal Market",
      phone: str(fd, "phone") || null,
      address: str(fd, "address") || null,
      delivery_area_note: str(fd, "delivery_area_note") || null,
      delivery_fee: fee,
      free_delivery_threshold: free,
      min_order_amount: min,
      delivery_slots: slots,
      is_open: fd.get("is_open") === "on",
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  updateTag(SETTINGS_TAG);
  return { ok: "Ayarlar kaydedildi" };
}
