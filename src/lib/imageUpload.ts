"use client";
// Görsel yükleme yardımcıları (ürün ve kategori görselleri): tarayıcıda küçült → sunucuda WebP'ye çevir → depoya yükle;
// bağlantıdan indir (sunucu üzerinden), panodan oku.
import { compressImage } from "@/lib/imageCompress";
import { uploadProductImage, uploadProductImageFromUrl } from "@/app/admin/imageActions";

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadImageBlob(blob: Blob, folder = "", max = 1600): Promise<UploadResult> {
  if (!blob.type.startsWith("image/")) return { ok: false, error: "Bu bir görsel değil." };
  // Tarayıcıda yalnızca küçült (gönderim hızlı olsun); asıl WebP sıkıştırma sunucuda yapılır (iPhone dahil her cihazda aynı sonuç)
  const img = await compressImage(blob, max, 0.9);
  if (img.size > 6 * 1024 * 1024) return { ok: false, error: "Görsel çok büyük (6 MB üstü)." };
  const fd = new FormData();
  fd.set("file", img, "gorsel");
  fd.set("folder", folder);
  try {
    return await uploadProductImage(fd);
  } catch {
    return { ok: false, error: "Yükleme başarısız. Bağlantınızı kontrol edip tekrar deneyin." };
  }
}

export async function uploadImageFromUrl(url: string, folder = "", max = 1600): Promise<UploadResult> {
  if (url.startsWith("data:image/")) return uploadImageBlob(await (await fetch(url)).blob(), folder, max);
  try {
    return await uploadProductImageFromUrl(url, folder);
  } catch {
    return { ok: false, error: "Görsel aktarılamadı. Görsele sağ tıklayıp 'Resmi kopyala' ile deneyin." };
  }
}

/** Yapıştırma olayından görsel dosyası ya da görsel bağlantısı çıkarır */
export function imageFromPaste(dt: DataTransfer | null): { file?: File; url?: string } | null {
  if (!dt) return null;
  const file = Array.from(dt.items).find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
  if (file) return { file };
  const src = dt.getData("text/html").match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (src && /^(https?:|data:image\/)/.test(src)) return { url: src };
  const text = dt.getData("text/plain").trim();
  if (/^(https?:\/\/\S+|data:image\/\S+)$/i.test(text)) return { url: text };
  return null;
}

/** "Panodan yapıştır" butonu: navigator.clipboard.read ile görsel ya da bağlantı */
export async function imageFromClipboard(): Promise<{ blob?: Blob; url?: string } | { error: string }> {
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find((t) => t.startsWith("image/"));
      if (type) return { blob: await it.getType(type) };
    }
    for (const it of items) {
      if (it.types.includes("text/plain")) {
        const txt = (await (await it.getType("text/plain")).text()).trim();
        if (/^(https?:|data:image\/)/i.test(txt)) return { url: txt };
      }
    }
    return { error: "Panoda görsel yok. Görsele sağ tıklayıp 'Resmi kopyala' deyin." };
  } catch {
    return { error: "Pano okunamadı. Kutuya tıklayıp Ctrl+V (Mac: ⌘+V) ile yapıştırın." };
  }
}
