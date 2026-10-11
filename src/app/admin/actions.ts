"use server";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/data/auth";
import { CATALOG_TAG, SETTINGS_TAG } from "@/lib/data/catalog";
import { AREAS_TAG } from "@/lib/data/areas";
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
    barcode: cleanBarcode(str(fd, "barcode")),
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
  if (error)
    return {
      error:
        error.code === "23505"
          ? error.message.includes("barcode")
            ? "Bu barkod başka bir üründe kayıtlı."
            : "Bu bağlantı adı (slug) zaten kullanılıyor."
          : error.message,
    };

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

// ---------------- BARKOD ----------------
const cleanBarcode = (v: string) => {
  const c = v.replace(/\s+/g, "").slice(0, 32);
  return c || null;
};

export type BarcodeProduct = {
  id: string;
  name: string;
  unit_label: string | null;
  price: number;
  sale_price: number | null;
  stock: number;
  image_url: string | null;
  emoji: string | null;
  is_active: boolean;
  barcode: string;
};

export async function findByBarcode(code: string): Promise<BarcodeProduct | null> {
  const { supabase } = await requireAdmin();
  const c = cleanBarcode(code);
  if (!c) return null;
  const { data } = await supabase
    .from("products")
    .select("id,name,unit_label,price,sale_price,stock,image_url,emoji,is_active,barcode")
    .eq("barcode", c)
    .maybeSingle();
  if (!data) return null;
  return { ...data, price: Number(data.price), sale_price: data.sale_price == null ? null : Number(data.sale_price) } as BarcodeProduct;
}

export async function quickPriceUpdate(input: {
  id: string;
  price: string;
  sale_price: string;
  stock: string;
}): Promise<{ ok: true; product: BarcodeProduct } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  const n = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const price = n(input.price);
  const sale = n(input.sale_price);
  const stock = n(input.stock);
  if (price == null || Number.isNaN(price) || price < 0) return { ok: false, error: "Geçerli bir fiyat gir." };
  if (sale != null && (Number.isNaN(sale) || sale < 0 || sale >= price))
    return { ok: false, error: "İndirimli fiyat normal fiyattan düşük olmalı (indirim yoksa boş bırak)." };
  if (stock == null || !Number.isInteger(stock) || stock < 0) return { ok: false, error: "Stok tam sayı olmalı." };

  const { data, error } = await supabase
    .from("products")
    .update({ price, sale_price: sale, stock })
    .eq("id", input.id)
    .select("id,name,unit_label,price,sale_price,stock,image_url,emoji,is_active,barcode")
    .single();
  if (error || !data) return { ok: false, error: "Kaydedilemedi: " + (error?.message ?? "ürün bulunamadı") };
  updateTag(CATALOG_TAG);
  return { ok: true, product: { ...data, price: Number(data.price), sale_price: data.sale_price == null ? null : Number(data.sale_price) } as BarcodeProduct };
}

// ---------------- SİPARİŞTE OLMAYAN ÜRÜN ----------------
const ITEM_ERR: Record<string, string> = {
  SIPARIS_KILITLI: "Yola çıkmış veya kapanmış siparişte ürün değiştirilemez.",
  SIPARIS_BOS: "Siparişte başka ürün kalmıyor. Bunun yerine siparişi iptal et.",
  STOK_YETERSIZ: "Seçilen yeni üründen yeterli stok yok.",
  GECERSIZ_ADET: "Geçerli bir adet gir.",
  KALEM_YOK: "Bu ürün zaten siparişten çıkarılmış.",
};

export async function orderItemOut(fd: FormData) {
  const { supabase } = await requireAdmin();
  const orderId = str(fd, "order_id");
  const replacement = str(fd, "replacement");
  const qty = Math.trunc(Number(str(fd, "qty") || "1"));
  const { error } = await supabase.rpc("admin_order_item_out", {
    p_item_id: str(fd, "item_id"),
    p_replacement: replacement || null,
    p_qty: replacement ? qty : null,
    p_mark_out: fd.get("mark_out") === "on",
  });
  updateTag(CATALOG_TAG);
  const code = error?.message?.split(":")[0] ?? "";
  const q = error ? `?hata=${encodeURIComponent(ITEM_ERR[code] ?? "İşlem yapılamadı: " + error.message)}` : "?guncellendi=1";
  redirect(`/admin/siparisler/${orderId}${q}`);
}

// ---------------- TESLİMAT BÖLGELERİ ----------------
const nbBack = (id: number | string) => `/admin/bolgeler/${id}`;

export async function toggleDistrict(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("delivery_districts").update({ is_active: str(fd, "on") === "1" }).eq("id", Number(str(fd, "id")));
  updateTag(AREAS_TAG);
  redirect("/admin/bolgeler");
}

export async function toggleNeighborhood(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("delivery_neighborhoods").update({ is_active: str(fd, "on") === "1" }).eq("id", Number(str(fd, "id")));
  updateTag(AREAS_TAG);
  redirect(str(fd, "back").startsWith("/admin") ? str(fd, "back") : "/admin/bolgeler");
}

/** Her satıra bir sokak; mevcut olanlar atlanır. */
export async function addStreets(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const nbId = Number(str(fd, "neighborhood_id"));
  const names = Array.from(
    new Set(
      str(fd, "names")
        .split(/\r?\n/)
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter((l) => l.length >= 2 && l.length <= 120),
    ),
  );
  if (!nbId || names.length === 0) return { error: "En az bir cadde/sokak adı yaz (her satıra bir tane)." };
  const { data, error } = await supabase
    .from("delivery_streets")
    .upsert(names.map((name) => ({ neighborhood_id: nbId, name, is_active: true })), { onConflict: "neighborhood_id,name", ignoreDuplicates: true })
    .select("id");
  if (error) return { error: "Kaydedilemedi: " + error.message };
  updateTag(AREAS_TAG);
  const added = data?.length ?? 0;
  return { ok: `${added} sokak eklendi${names.length - added > 0 ? `, ${names.length - added} tanesi zaten vardı` : ""}.` };
}

export async function deleteStreet(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("delivery_streets").delete().eq("id", Number(str(fd, "id")));
  updateTag(AREAS_TAG);
  redirect(nbBack(str(fd, "neighborhood_id")));
}

export async function addSuggestedStreet(fd: FormData) {
  const { supabase } = await requireAdmin();
  const nbId = Number(str(fd, "neighborhood_id"));
  const name = str(fd, "name").replace(/\s+/g, " ").slice(0, 120);
  if (nbId && name.length >= 2)
    await supabase.from("delivery_streets").upsert({ neighborhood_id: nbId, name }, { onConflict: "neighborhood_id,name", ignoreDuplicates: true });
  updateTag(AREAS_TAG);
  redirect(str(fd, "back").startsWith("/admin") ? str(fd, "back") : "/admin/bolgeler");
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
  const back = str(fd, "back");
  const target = back.startsWith("/admin") && !back.startsWith("//") ? back : `/admin/siparisler/${id}`;
  redirect(`${target}${error ? (target.includes("?") ? "&" : "?") + "hata=1" : ""}`);
}

// ---------------- AYARLAR ----------------
export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const fee = numOrNull(fd, "delivery_fee");
  const free = numOrNull(fd, "free_delivery_threshold");
  const min = numOrNull(fd, "min_order_amount");
  for (const v of [fee, free, min]) if (v == null || Number.isNaN(v) || v < 0) return { error: "Tutarları kontrol edin." };
  const sla = ["sla_accept_min", "sla_prepare_min", "sla_delivery_min"].map((k) => Math.trunc(Number(str(fd, k))));
  if (sla.some((v) => !Number.isFinite(v) || v < 1 || v > 240)) return { error: "Hedef süreler 1-240 dakika arasında olmalı." };
  const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const openT = str(fd, "open_time").slice(0, 5);
  const closeT = str(fd, "close_time").slice(0, 5);
  if (!HM.test(openT) || !HM.test(closeT)) return { error: "Açılış ve kapanış saatini SS:DD biçiminde gir." };
  const slots = str(fd, "delivery_slots")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (slots.length === 0) return { error: "En az bir teslimat saati girin." };

  const row = {
      store_name: str(fd, "store_name") || "Sanal Market",
      phone: str(fd, "phone") || null,
      address: str(fd, "address") || null,
      delivery_area_note: str(fd, "delivery_area_note") || null,
      open_time: openT,
      close_time: closeT,
      working_hours: `${openT} - ${closeT}`,
      whatsapp_phone: str(fd, "whatsapp_phone") || null,
      delivery_fee: fee,
      free_delivery_threshold: free,
      min_order_amount: min,
      delivery_slots: slots,
      is_open: fd.get("is_open") === "on",
      voice_enabled: fd.get("voice_enabled") === "on",
      voice_daily_limit: Math.max(0, Math.min(10000, Math.trunc(Number(str(fd, "voice_daily_limit")) || 0))),
      voice_hourly_per_user: Math.max(0, Math.min(100, Math.trunc(Number(str(fd, "voice_hourly_per_user")) || 0))),
      sla_accept_min: sla[0],
      sla_prepare_min: sla[1],
      sla_delivery_min: sla[2],
  };
  let { error } = await supabase.from("store_settings").update(row).eq("id", 1);
  // Sesli asistan sütunları veritabanına henüz eklenmediyse diğer ayarları yine de kaydet
  if (error && /voice_/.test(error.message)) {
    const { voice_enabled: _a, voice_daily_limit: _b, voice_hourly_per_user: _c, ...rest } = row;
    void _a; void _b; void _c;
    ({ error } = await supabase.from("store_settings").update(rest).eq("id", 1));
  }
  if (error) return { error: error.message };
  updateTag(SETTINGS_TAG);
  return { ok: "Ayarlar kaydedildi" };
}
