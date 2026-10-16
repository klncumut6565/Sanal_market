import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Kişiye özel ve yönetim sayfaları aramada çıkmaz
      disallow: [
        "/admin",
        "/kurye",
        "/api/",
        "/giris",
        "/sifre-yenile",
        "/sepet",
        "/odeme",
        "/siparis/",
        "/siparislerim",
        "/favorilerim",
        "/ara",
        "/auth/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
