import "server-only";
// Vitrin önbelleğini geçersiz kılma (yalnızca sunucu eylemlerinden çağrılır).
// Vercel ISR yazımı tasarrufu:
//  • Değişen ürünün kendi sayfası ANINDA yenilenir (urun-<id> etiketi).
//  • Ana sayfa + kategori sayfaları (büyük sayfalar, CATALOG_TAG) en fazla 30 dakikada bir yenilenir:
//    süre dolmadıysa yenileme "bekliyor" olarak işaretlenir; yönetim paneli açıkken CatalogAutoFlush
//    süre dolunca bekleyeni uygular. Böylece 100 ürün düzenlemesi 100 değil, birkaç ana sayfa yazımı demektir.
//  • Kategori değişiklikleri (menü / yapı) anında.
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATALOG_TAG, CATEGORIES_TAG, productTag } from "./catalog";

export const CATALOG_FLUSH_MIN = 30;

type Mode = "throttle" | "now" | "none";

export async function invalidateCatalog(
  productIds?: (string | null | undefined)[] | null,
  opts?: { categories?: boolean; catalog?: Mode },
) {
  for (const id of new Set((productIds ?? []).filter((x): x is string => !!x))) updateTag(productTag(id));
  let mode: Mode = opts?.catalog ?? "throttle";
  if (opts?.categories) {
    updateTag(CATEGORIES_TAG);
    mode = "now";
  }
  if (mode === "none") return;
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("catalog_flush", { p_mode: mode === "now" ? "force" : "request", p_minutes: CATALOG_FLUSH_MIN });
    if (error ? mode === "now" : data === true) updateTag(CATALOG_TAG);
  } catch {
    if (mode === "now") updateTag(CATALOG_TAG);
  }
}

/** Bekleyen vitrin yenilemesi varsa ve süre dolduysa uygular. */
export async function flushCatalogIfDue(): Promise<boolean> {
  try {
    const sb = await createClient();
    const { data } = await sb.rpc("catalog_flush", { p_mode: "due", p_minutes: CATALOG_FLUSH_MIN });
    if (data === true) {
      updateTag(CATALOG_TAG);
      return true;
    }
  } catch {
    /* yoksay */
  }
  return false;
}
