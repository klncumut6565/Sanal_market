"use client";
// Görsel yükleme yardımcıları (ürün ve kategori görselleri): küçült → depoya yükle,
// bağlantıdan indir (sunucu üzerinden), panodan oku.
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageCompress";
import { fetchRemoteImage } from "@/app/admin/actions";

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadImageBlob(blob: Blob, folder = "", max = 1000): Promise<UploadResult> {
  if (!blob.type.startsWith("image/")) return { ok: false, error: "Bu bir görsel değil." };
  const img = await compressImage(blob, max);
  if (img.size > 3 * 1024 * 1024) return { ok: false, error: "Görsel en fazla 3 MB olmalı." };
  const ext = img.type === "image/webp" ? "webp" : img.type === "image/png" ? "png" : "jpg";
  const path = `${folder ? folder.replace(/\/$/, "") + "/" : ""}${crypto.randomUUID()}.${ext}`;
  const sb = createClient();
  const { error } = await sb.storage.from("product-images").upload(path, img, { cacheControl: "31536000", contentType: img.type });
  if (error) return { ok: false, error: "Yükleme başarısız: " + error.message };
  return { ok: true, url: sb.storage.from("product-images").getPublicUrl(path).data.publicUrl };
}

export async function uploadImageFromUrl(url: string, folder = "", max = 1000): Promise<UploadResult> {
  if (url.startsWith("data:image/")) return uploadImageBlob(await (await fetch(url)).blob(), folder, max);
  const r = await fetchRemoteImage(url);
  if (!r.ok) return r;
  const bin = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
  return uploadImageBlob(new Blob([bin], { type: r.type }), folder, max);
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
