"use server";
// Ürün / kategori görseli yükleme ve mevcut sıkıştırılmamış görsellerin WebP'ye dönüştürülmesi (sunucuda, sharp).
import { invalidateCatalog } from "@/lib/data/invalidate";
import { requireAdmin } from "@/lib/data/auth";
import { PRODUCT_BUCKET, downloadRemoteImage, storagePathOf, toProductWebp } from "@/lib/server/productImage";

export type ImageUploadResult = { ok: true; url: string } | { ok: false; error: string };

const cleanFolder = (f: string) => f.replace(/[^a-z0-9_-]/gi, "").slice(0, 40);

async function storeWebp(buf: Buffer, folder: string): Promise<ImageUploadResult> {
  const { supabase } = await requireAdmin();
  let webp: Buffer;
  try {
    webp = await toProductWebp(buf);
  } catch {
    return { ok: false, error: "Görsel okunamadı (bozuk ya da desteklenmeyen biçim)." };
  }
  const dir = cleanFolder(folder);
  const path = `${dir ? dir + "/" : ""}${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(PRODUCT_BUCKET).upload(path, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) return { ok: false, error: "Yükleme başarısız: " + error.message };
  return { ok: true, url: supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl };
}

/** Tarayıcıdan gelen görsel dosyası → WebP → depo */
export async function uploadProductImage(fd: FormData): Promise<ImageUploadResult> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof Blob) || !file.type.startsWith("image/")) return { ok: false, error: "Bu bir görsel değil." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Görsel çok büyük (8 MB üstü)." };
  return storeWebp(Buffer.from(await file.arrayBuffer()), String(fd.get("folder") ?? ""));
}

/** Görsel bağlantısı (Google görseller vb.) → sunucuda indir → WebP → depo */
export async function uploadProductImageFromUrl(url: string, folder = ""): Promise<ImageUploadResult> {
  await requireAdmin();
  const r = await downloadRemoteImage(url);
  if (!r.ok) return r;
  return storeWebp(r.buf, folder);
}

export type CompressStatus = { count: number; mb: number; orphans: number };

/** Sıkıştırılmamış (WebP olmayan) görsel durumu */
export async function nonWebpStatus(): Promise<CompressStatus> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_nonwebp_images");
  const rows = (data ?? []) as { size: number; referenced: boolean }[];
  const used = rows.filter((r) => r.referenced);
  return {
    count: used.length,
    mb: Math.round(used.reduce((a, r) => a + Number(r.size ?? 0), 0) / 104857.6) / 10,
    orphans: rows.length - used.length,
  };
}

/**
 * Mevcut sıkıştırılmamış görselleri parça parça WebP'ye çevirir: yeni dosya yüklenir, ürün/kategori kayıtlarındaki
 * adres güncellenir, eski dosya silinir. Hiçbir yerde kullanılmayan (1 günden eski) eski dosyalar da silinir.
 */
export async function compressNextImages(batch = 6): Promise<{ ok: boolean; done: number; failed: number; remaining: number; savedKb: number; error?: string }> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_nonwebp_images");
  if (error) return { ok: false, done: 0, failed: 0, remaining: 0, savedKb: 0, error: error.message };
  const rows = (data ?? []) as { name: string; size: number; created_at: string; referenced: boolean }[];

  // Kullanılmayan eski dosyalar: doğrudan sil
  const dayAgo = Date.now() - 24 * 3600_000;
  const orphans = rows.filter((r) => !r.referenced && Date.parse(r.created_at) < dayAgo).map((r) => r.name);
  if (orphans.length) await supabase.storage.from(PRODUCT_BUCKET).remove(orphans);

  const todo = rows.filter((r) => r.referenced).slice(0, Math.min(Math.max(batch, 1), 10));
  let done = 0;
  let failed = 0;
  let saved = orphans.length ? rows.filter((r) => orphans.includes(r.name)).reduce((a, r) => a + Number(r.size), 0) : 0;
  const touched = new Set<string>();
  let catTouched = false;
  const pub = (p: string) => supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(p).data.publicUrl;

  for (const r of todo) {
    try {
      const { data: blob, error: dErr } = await supabase.storage.from(PRODUCT_BUCKET).download(r.name);
      if (dErr || !blob) throw new Error("indirilemedi");
      const webp = await toProductWebp(Buffer.from(await blob.arrayBuffer()));
      const dir = r.name.includes("/") ? r.name.slice(0, r.name.lastIndexOf("/") + 1) : "";
      const newPath = `${dir}${crypto.randomUUID()}.webp`;
      const { error: uErr } = await supabase.storage.from(PRODUCT_BUCKET).upload(newPath, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (uErr) throw new Error(uErr.message);
      const newUrl = pub(newPath);
      const like = `%/product-images/${r.name}`;

      let updErr = false;
      // Ana görsel
      const main = await supabase.from("products").update({ image_url: newUrl }).like("image_url", like).select("id");
      updErr ||= !!main.error;
      for (const x of main.data ?? []) touched.add(x.id);
      // Ek görseller
      const { data: withExtra } = await supabase.from("products").select("id,extra_images").not("extra_images", "is", null);
      for (const p of (withExtra ?? []) as { id: string; extra_images: string[] | null }[]) {
        const ex = p.extra_images ?? [];
        if (ex.some((u) => storagePathOf(u) === r.name)) {
          updErr ||= !!(await supabase.from("products").update({ extra_images: ex.map((u) => (storagePathOf(u) === r.name ? newUrl : u)) }).eq("id", p.id)).error;
          touched.add(p.id);
        }
      }
      // Kategori görseli
      const catUpd = await supabase.from("categories").update({ image_url: newUrl }).like("image_url", like).select("id");
      updErr ||= !!catUpd.error;
      if (catUpd.data?.length) catTouched = true;

      if (updErr) throw new Error("kayıt güncellenemedi");
      // Eski dosya HEMEN silinmez: vitrin önbelleği (en geç 30 dk'da yenilenir) bir süre eski adresi gösterebilir.
      // Hiçbir yerde kullanılmayan eski dosyalar 1 gün sonra bir sonraki çalıştırmada silinir.
      saved += Math.max(0, Number(r.size) - webp.length);
      done++;
    } catch {
      failed++;
    }
  }
  if (done) await invalidateCatalog([...touched], { categories: catTouched });
  const remaining = rows.filter((r) => r.referenced).length - done;
  return { ok: true, done, failed, remaining: Math.max(0, remaining), savedKb: Math.round(saved / 1024) };
}
