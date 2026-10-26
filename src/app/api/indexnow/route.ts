// IndexNow: Yandex, Bing (ve IndexNow kullanan diğer arama motorları) sitedeki sayfaları hemen tarasın diye
// site haritasındaki adresleri bildirir. Yalnızca yönetici açabilir (giriş yapmışken /api/indexnow).
// Anahtar dosyası: public/<INDEXNOW_KEY>.txt
import sitemap from "@/app/sitemap";
import { getSessionUser } from "@/lib/data/auth";
import { SITE_URL } from "@/lib/seo";

const INDEXNOW_KEY = "0532fab707f99eff0a2fa25b17335be7";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return Response.json({ ok: false, error: "Yalnızca yönetici." }, { status: 403 });
  const urls = (await sitemap()).map((p) => p.url).slice(0, 10000);
  const host = new URL(SITE_URL).host;
  const body = JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: urls });
  const results: Record<string, number | string> = {};
  for (const ep of ["https://yandex.com/indexnow", "https://api.indexnow.org/indexnow"]) {
    try {
      const r = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body });
      results[ep] = r.status; // 200/202 = kabul edildi
    } catch (e) {
      results[ep] = e instanceof Error ? e.message : String(e);
    }
  }
  return Response.json({ ok: true, submitted: urls.length, results });
}
