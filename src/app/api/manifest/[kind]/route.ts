// Ana ekrana eklenen uygulamalar için manifest: yönetim paneli ve kurye sayfası ayrı simgeler.
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const token = req.nextUrl.searchParams.get("k") ?? "";
  const courier = kind === "kurye";
  const start = courier ? `/kurye?k=${encodeURIComponent(token)}` : "/admin/siparisler";
  const body = {
    name: courier ? "Sanal Market Kurye" : "Sanal Market Yönetim",
    short_name: courier ? "SM Kurye" : "SM Yönetim",
    id: courier ? "/kurye" : "/admin",
    start_url: start,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e8a6c",
    lang: "tr",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/manifest+json", "cache-control": "no-store" } });
}
