import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Görsel yükleme sunucu eylemiyle (WebP dönüşümü sunucuda): telefondan gelen küçültülmüş fotoğraf için pay
  experimental: { serverActions: { bodySizeLimit: "7mb" } },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
    // Ürün görselleri değişmez adlarla (uuid) yüklenir: Vercel optimize edilmiş kopyayı 31 gün önbellekte tutar,
    // Supabase deposuna her görsel/boyut için ayda en fazla bir kez gidilir (veri çıkışı tasarrufu).
    minimumCacheTTL: 2678400,
  },
  // Güvenlik başlıkları: başka sitenin sayfayı çerçeve içinde göstermesi (tıklama tuzağı), MIME tahmini ve gereksiz
  // tarayıcı izinleri kapalı. Mikrofon (sesli asistan), kamera (barkod / fotoğraf) ve konum (kurye) yalnızca kendi sitemize.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(self), payment=(), usb=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
