import "server-only";
// Ürün / kategori görselleri SUNUCUDA WebP'ye çevrilir (sharp): en fazla 1000 px, kalite 78.
// Tarayıcı ne gönderirse göndersin (iPhone'da tarayıcı WebP üretemez → büyük JPEG gelir) depoya hep küçük WebP girer.
// Depo kovası (product-images) yalnızca image/webp ve en fazla 1 MB kabul eder → başka yoldan büyük dosya giremez.
import sharp from "sharp";

export const PRODUCT_BUCKET = "product-images";
const MAX_PX = 1000;
const TARGET_BYTES = 250 * 1024;

/** Görseli WebP'ye çevirir; hâlâ büyükse kaliteyi / boyutu kademeli düşürür. */
export async function toProductWebp(input: Buffer | ArrayBuffer | Uint8Array): Promise<Buffer> {
  const src = Buffer.isBuffer(input) ? input : Buffer.from(input as ArrayBuffer);
  const steps: { px: number; q: number }[] = [
    { px: MAX_PX, q: 78 },
    { px: MAX_PX, q: 65 },
    { px: 800, q: 60 },
  ];
  let out: Buffer | null = null;
  for (const s of steps) {
    out = await sharp(src, { failOn: "none", limitInputPixels: 80_000_000 })
      .rotate() // telefon fotoğraflarının yönü
      .resize(s.px, s.px, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // saydam PNG → beyaz zemin
      .webp({ quality: s.q, effort: 4 })
      .toBuffer();
    if (out.length <= TARGET_BYTES) break;
  }
  return out!;
}

/** Herkese açık ürün görseli adresinden depo içi yolu çıkarır (değilse null). */
export function storagePathOf(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/product-images\/(.+?)(\?.*)?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Uzak görsel adresini güvenli biçimde indirir (yerel ağ adresleri engelli). */
export async function downloadRemoteImage(url: string): Promise<{ ok: true; buf: Buffer; type: string } | { ok: false; error: string }> {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return { ok: false, error: "Geçerli bir görsel bağlantısı değil." };
  }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, error: "Yalnızca http/https bağlantıları." };
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1)/i.test(u.hostname)) return { ok: false, error: "Bu adres kullanılamaz." };
  try {
    const res = await fetch(u, {
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "Mozilla/5.0 (SanalMarket görsel aktarımı)", Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, error: `Görsel indirilemedi (${res.status}).` };
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!type.startsWith("image/")) return { ok: false, error: "Bağlantı bir görsel değil (sayfa bağlantısı olabilir). Görsele sağ tıklayıp 'Resmi kopyala' deneyin." };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return { ok: false, error: "Görsel çok büyük (8 MB üstü)." };
    return { ok: true, buf, type };
  } catch {
    return { ok: false, error: "Görsel indirilemedi. Görsele sağ tıklayıp 'Resmi kopyala' ile deneyin." };
  }
}
