import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
    // Ürün görselleri değişmez adlarla (uuid) yüklenir: Vercel optimize edilmiş kopyayı 31 gün önbellekte tutar,
    // Supabase deposuna her görsel/boyut için ayda en fazla bir kez gidilir (veri çıkışı tasarrufu).
    minimumCacheTTL: 2678400,
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
