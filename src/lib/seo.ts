// Google arama (SEO) ortak ayarları
import type { Category, Product } from "@/lib/types";

/** Sitenin herkese açık adresi. Kendi alan adına geçince Vercel'de NEXT_PUBLIC_SITE_URL ile değiştirilir. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sanalmarket.vercel.app").replace(/\/+$/, "");

export const CITY = "Çorlu";
export const REGION = "Tekirdağ";

export const SITE_TITLE = "Sanal Market – Çorlu Online Market | Eve Market Siparişi";
export const SITE_DESCRIPTION =
  "Çorlu'da online market alışverişi: gıda, içecek, atıştırmalık, temizlik, kağıt ve hijyen ürünleri motokuryeyle kapınızda. Kapıda nakit veya kartla ödeme, her gün 10:00 - 01:00.";

export const abs = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Ürün/kategori yalnızca "herkese açık" kategorideyse Google'a gösterilir (üyeye özel, onaylı, sigara vb. hariç). */
export const isPublicCategory = (c: Category | undefined | null) =>
  !!c && (!c.visibility || c.visibility === "herkes");

export const productPrice = (p: Product) => (p.sale_price != null && p.sale_price < p.price ? p.sale_price : p.price);

/** Açıklama satırı: 150-160 karakteri geçmeyecek şekilde kısaltır. */
export function clip(text: string, max = 158) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** JSON-LD'yi <script> içine güvenle yazmak için ("<" kaçırılır). */
export function jsonLdHtml(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}
