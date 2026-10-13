"use client";
/** Görseli en fazla `max` piksele küçültüp WebP'ye çevirir (yükleme boyutu küçülür). Başarısızsa aynen döner. */
export async function compressImage(blob: Blob, max = 1000, quality = 0.85): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.fillStyle = "#fff"; // saydam PNG'lerde beyaz zemin
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (out && out.type === "image/webp") return out;
    const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return jpg ?? blob;
  } catch {
    return blob;
  }
}
