import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/data/catalog";
import { abs, isPublicCategory } from "@/lib/seo";

// Google'a sitedeki tüm herkese açık sayfaların listesi: ana sayfa, kategoriler, ürünler
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const publicCats = categories.filter(isPublicCategory);
  const catIds = new Set(publicCats.map((c) => c.id));
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: abs("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    ...publicCats.map((c) => ({
      url: abs(`/kategori/${c.slug}`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: c.parent_id ? 0.7 : 0.8,
    })),
    ...products
      .filter((p) => p.category_id && catIds.has(p.category_id))
      .map((p) => ({
        url: abs(`/urun/${p.slug}`),
        lastModified: p.info_updated_at ? new Date(p.info_updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        ...(p.image_url ? { images: [p.image_url] } : {}),
      })),
    ...["/kvkk", "/mesafeli-satis-sozlesmesi", "/on-bilgilendirme"].map((path) => ({
      url: abs(path),
      changeFrequency: "yearly" as const,
      priority: 0.1,
    })),
  ];
  return pages;
}
