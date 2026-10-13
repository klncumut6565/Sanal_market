"use server";
import { streetKey } from "@/lib/streetSuggest";
import { normalizeTrMobile } from "@/lib/phone";
import { after } from "next/server";
import { cloudTestParams, sendEmail, sendWhatsAppChain } from "@/lib/notify";
import { courierKey, loadCourierCfg, notifyCourier, sendToCourier } from "@/lib/courier";
import { guessCategoryEmoji } from "@/lib/categoryEmoji";
import { revalidatePath, updateTag } from "next/cache";
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

  const cost = numOrNull(fd, "cost_price");
  if (cost != null && (Number.isNaN(cost) || cost < 0)) return { error: "Alış fiyatını kontrol et." };

  const { data: saved, error } = id
    ? await supabase.from("products").update(row).eq("id", id).select("id").single()
    : await supabase.from("products").insert(row).select("id").single();
  if (!error && saved) {
    // Alış fiyatı ayrı (yalnızca admin) tabloda
    if (cost == null) await supabase.from("product_costs").delete().eq("product_id", saved.id);
    else await supabase.from("product_costs").upsert({ product_id: saved.id, cost_price: cost, updated_at: new Date().toISOString() });
  }
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
  LIMIT_ASILDI: "Yeni ürün için sipariş başına adet sınırı aşıldı.",
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

const likeEsc = (t: string) => t.replace(/[\\%_]/g, (c) => "\\" + c);

/** Elle yazılmış sokağı taşıyan Çorlu siparişlerini listedeki sokağa bağla (raporlar/kurye için). */
async function linkTypedOrders(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  nbId: number,
  typed: string,
  street: { id: number; name: string },
) {
  const { data: nb } = await supabase.from("delivery_neighborhoods").select("name").eq("id", nbId).maybeSingle();
  if (!nb || !typed) return;
  await supabase
    .from("orders")
    .update({ addr_street_id: street.id, addr_street: street.name })
    .is("addr_street_id", null)
    .eq("addr_district", "Çorlu")
    .eq("addr_neighborhood", nb.name)
    .ilike("addr_street", likeEsc(typed));
}

const regionsBack = (fd: FormData) => (str(fd, "back").startsWith("/admin") ? str(fd, "back") : "/admin/bolgeler");

/** Önerilen (müşterinin yazdığı) sokağı — gerekirse düzeltilmiş adıyla — listeye ekle. */
export async function addSuggestedStreet(fd: FormData) {
  const { supabase } = await requireAdmin();
  const nbId = Number(str(fd, "neighborhood_id"));
  const name = str(fd, "name").replace(/\s+/g, " ").slice(0, 120);
  const typed = str(fd, "typed") || name;
  if (nbId && name.length >= 2) {
    await supabase.from("delivery_streets").upsert({ neighborhood_id: nbId, name }, { onConflict: "neighborhood_id,name", ignoreDuplicates: true });
    const { data: st } = await supabase.from("delivery_streets").select("id,name").eq("neighborhood_id", nbId).eq("name", name).maybeSingle();
    if (st) await linkTypedOrders(supabase, nbId, typed, st);
  }
  updateTag(AREAS_TAG);
  redirect(regionsBack(fd));
}

/** Yazılan ad aslında listedeki bir sokak (yazım hatası): siparişleri ona bağla, öneriyi gizle. */
export async function mapSuggestedStreet(fd: FormData) {
  const { supabase } = await requireAdmin();
  const nbId = Number(str(fd, "neighborhood_id"));
  const typed = str(fd, "typed");
  const { data: st } = await supabase.from("delivery_streets").select("id,name").eq("id", Number(str(fd, "street_id"))).maybeSingle();
  if (nbId && st) {
    await linkTypedOrders(supabase, nbId, typed, st);
    await supabase.from("delivery_street_ignored").upsert({ neighborhood_id: nbId, name_key: streetKey(typed) }, { ignoreDuplicates: true });
  }
  redirect(regionsBack(fd));
}

/** Öneriyi yoksay (yanlış/anlamsız yazım). */
export async function ignoreSuggestedStreet(fd: FormData) {
  const { supabase } = await requireAdmin();
  const nbId = Number(str(fd, "neighborhood_id"));
  const typed = str(fd, "typed");
  if (nbId && typed) await supabase.from("delivery_street_ignored").upsert({ neighborhood_id: nbId, name_key: streetKey(typed) }, { ignoreDuplicates: true });
  redirect(regionsBack(fd));
}

// ---------------- KATEGORİLER ----------------
export async function saveCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Kategori adı girin." };
  const pos = Math.trunc(numOrNull(fd, "sort_order") ?? 0);
  const row = {
    name,
    slug: slugify(str(fd, "slug") || name),
    emoji: str(fd, "emoji") || guessCategoryEmoji(name),
    is_active: fd.get("is_active") === "on",
    night_ban: fd.get("night_ban") === "on",
    visibility: ["herkes", "uye", "onayli", "ozel", "kapali"].includes(str(fd, "visibility")) ? str(fd, "visibility") : "herkes",
  };
  const res = id
    ? await supabase.from("categories").update(row).eq("id", id).select("id").single()
    : await supabase.from("categories").insert({ ...row, sort_order: 9999 }).select("id").single();
  if (res.error) return { error: res.error.code === "23505" ? "Bu kategori zaten var." : res.error.message };
  // İstenen sıraya yerleştir; o sıradaki ve sonrakiler bir kayar (boşsa en sona)
  const { error: posErr } = await supabase.rpc("admin_place_category", { p_id: res.data.id, p_pos: pos > 0 ? pos : null });
  updateTag(CATALOG_TAG);
  if (posErr) return { error: "Kaydedildi ama sıra ayarlanamadı: " + posErr.message };
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
  // "Hazır · Kuryeye ver": sipariş mesajı kuryeye WhatsApp'tan (arka planda, sayfayı bekletmeden)
  if (status === "yolda" && !error) {
    after(async () => {
      try {
        await notifyCourier(supabase, id);
      } catch (e) {
        console.error("[kurye]", e);
      }
    });
  }
  const back = str(fd, "back");
  const target = back.startsWith("/admin") && !back.startsWith("//") ? back : `/admin/siparisler/${id}`;
  const msg = error?.message?.startsWith("GECERSIZ_GECIS")
    ? "Sipariş aşamaları sırayla ilerler (Alındı → Hazırlanıyor → Yolda → Teslim). Sayfayı yenile."
    : error?.message?.startsWith("SIPARIS_KAPALI")
      ? "Bu sipariş zaten kapanmış (teslim edildi veya iptal)."
      : "1";
  redirect(`${target}${error ? (target.includes("?") ? "&" : "?") + "hata=" + encodeURIComponent(msg) : ""}`);
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

// ---------------- ONAYLI (TİKLİ) MÜŞTERİ ----------------
// Tikli üyeler "Yalnızca tikli üyeler" görünürlüğündeki kategorileri (ör. Elektronik) görür.
export async function toggleVerified(fd: FormData) {
  const { supabase } = await requireAdmin();
  const userId = str(fd, "user_id");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return;
  // kind=mavi → verified_customers (alkol/tütün vb.), kind=sigara → special_customers (elektronik)
  const table = fd.get("kind") === "sigara" ? "special_customers" : "verified_customers";
  if (fd.get("on") === "1") await supabase.from(table).upsert({ user_id: userId });
  else await supabase.from(table).delete().eq("user_id", userId);
  revalidatePath("/admin/musteriler", "layout");
}

// ---------------- YÖNETİCİ YETKİSİ (yalnızca kurucu hesap) ----------------
const ROLE_ERR: Record<string, string> = {
  YALNIZCA_KURUCU: "Yönetici yetkisini yalnızca market sahibi (kurucu hesap) verebilir.",
  KURUCU_KORUNUR: "Kurucu hesabın yetkisi kaldırılamaz.",
  KULLANICI_YOK: "Kullanıcı bulunamadı.",
};
const roleMsg = (m?: string) => (m ? (ROLE_ERR[m.split(":")[0]] ?? m) : "");

export async function ownerSetAdmin(fd: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("owner_set_admin", { p_user_id: str(fd, "user_id"), p_admin: fd.get("admin") === "1" });
  redirect(`/admin/yoneticiler?${error ? "hata=" + encodeURIComponent(roleMsg(error.message)) : "ok=" + (fd.get("admin") === "1" ? "verildi" : "kaldirildi")}`);
}

export async function ownerGrantByEmail(fd: FormData) {
  const { supabase } = await requireAdmin();
  const email = str(fd, "email").toLowerCase();
  const { data: uid, error: findErr } = await supabase.rpc("owner_find_user", { p_email: email });
  let msg = "";
  if (findErr) msg = roleMsg(findErr.message);
  else if (!uid) msg = "Bu e-postayla kayıtlı üye yok. Kişi önce siteye üye olmalı.";
  else {
    const { error } = await supabase.rpc("owner_set_admin", { p_user_id: uid, p_admin: true });
    if (error) msg = roleMsg(error.message);
  }
  redirect(`/admin/yoneticiler?${msg ? "hata=" + encodeURIComponent(msg) : "ok=verildi"}`);
}

// ---------------- KURYE ----------------
export async function saveCourierSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const raw = str(fd, "courier_phone");
  const phone = raw ? normalizeTrMobile(raw) : null;
  if (raw && !phone) return { error: "Geçerli bir cep telefonu gir (ör. +90 5xx xxx xx xx)." };
  const { error } = await supabase
    .from("notify_settings")
    .update({ courier_phone: phone, courier_apikey: str(fd, "courier_apikey") || null })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/admin/siparisler", "layout");
  return { ok: phone ? "Kurye numarası kaydedildi" : "Kurye numarası kaldırıldı" };
}

export async function testCourier(): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const n = await loadCourierCfg(supabase);
  if (!n?.courier_phone) return { error: "Önce kurye numarasını kaydet." };
  const r = await sendToCourier(n, "✅ Sanal Market kurye test mesajı — siparişler hazırlanınca buraya gelecek.");
  await supabase
    .from("notify_settings")
    .update({ courier_last_result: `${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} · TEST → ${r}` })
    .eq("id", 1);
  revalidatePath("/admin/siparisler");
  if (/gönderildi/.test(r)) return { ok: r };
  return {
    error: courierKey(n)
      ? r
      : `${r}. Kurye için CallMeBot anahtarı yok: kurye kendi telefonundan CallMeBot'a "I allow callmebot to send me messages" yazıp gelen anahtarı ikinci kutuya girmeli (ya da numarayı Meta alıcı listesine ekle).`,
  };
}

// ---------------- KARA LİSTE ----------------
export async function addToBlacklist(fd: FormData) {
  const { supabase } = await requireAdmin();
  const raw = str(fd, "phone");
  const phone = normalizeTrMobile(raw) ?? raw;
  const reason = str(fd, "reason").slice(0, 300) || null;
  if (phone) {
    const { data: prof } = await supabase.from("profiles").select("id").eq("phone", phone).maybeSingle();
    await supabase.from("customer_blacklist").upsert({ phone, reason, user_id: prof?.id ?? null });
  }
  redirect(`/admin/musteriler/${encodeURIComponent(raw)}?kara=eklendi`);
}

export async function removeFromBlacklist(fd: FormData) {
  const { supabase } = await requireAdmin();
  const raw = str(fd, "phone");
  const phone = normalizeTrMobile(raw) ?? raw;
  await supabase.from("customer_blacklist").delete().in("phone", Array.from(new Set([raw, phone])));
  redirect(`/admin/musteriler/${encodeURIComponent(raw)}?kara=cikarildi`);
}

// ---------------- SİPARİŞ BİLDİRİMLERİ ----------------
export async function saveNotifySettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const email = str(fd, "email").toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Geçerli bir e-posta adresi gir." };
  const rawPhone = str(fd, "whatsapp_phone");
  const phone = rawPhone ? normalizeTrMobile(rawPhone) : null;
  if (rawPhone && !phone) return { error: "Geçerli bir cep telefonu gir (ör. +90 541 673 58 63)." };
  const rawBackup = str(fd, "backup_phone");
  const backup = rawBackup ? normalizeTrMobile(rawBackup) : null;
  if (rawBackup && !backup) return { error: "Yedek numara geçersiz (ör. +90 541 673 58 63)." };
  const { error } = await supabase
    .from("notify_settings")
    .update({
      email: email || null,
      whatsapp_phone: phone,
      callmebot_apikey: str(fd, "callmebot_apikey") || null,
      backup_phone: backup,
      email_enabled: fd.get("email_enabled") === "on",
      whatsapp_enabled: fd.get("whatsapp_enabled") === "on",
      only_when_away: fd.get("only_when_away") === "on",
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  return { ok: "Kaydedildi" };
}

export async function testNotify(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const { data: n } = await supabase.from("notify_settings").select("*").eq("id", 1).single();
  if (!n) return { error: "Ayar bulunamadı." };
  const which = str(fd, "kanal");
  const text = "✅ Sanal Market test bildirimi — yeni siparişler buraya böyle gelecek.";
  if (which === "email") {
    if (!n.email) return { error: "Önce e-posta adresini kaydet." };
    const r = await sendEmail(n.email, "Sanal Market test bildirimi", text, `<p>${text}</p>`);
    return r.ok ? { ok: `Test e-postası ${n.email} adresine gönderildi.` } : { error: r.error };
  }
  if (!n.whatsapp_phone && !n.backup_phone) return { error: "Önce WhatsApp numarasını kaydet." };
  const r = await sendWhatsAppChain({
    phone: n.whatsapp_phone,
    backupPhone: n.backup_phone,
    apikey: n.callmebot_apikey,
    text,
    templateParams: cloudTestParams(),
  });
  return /gönderildi/.test(r) ? { ok: r } : { error: r };
}
