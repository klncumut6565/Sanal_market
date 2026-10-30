import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "FacebookBot",
  "PerplexityBot",
  "cohere-ai",
  "Diffbot",
  "omgili",
  "ImagesiftBot",
  "PetalBot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "DataForSeoBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Yapay zekâ eğitim/tarama botları: binlerce ürün sayfasını gezip Vercel ISR yazım kotasını dolduruyor.
      // Google / Bing / Yandex arama botları bu listede DEĞİL (SEO etkilenmez).
      { userAgent: AI_CRAWLERS, disallow: "/" },
      {
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
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
