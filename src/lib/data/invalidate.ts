import "server-only";
// Vitrin önbelleğini geçersiz kılma (yalnızca sunucu eylemlerinden çağrılır).
// Vercel ISR yazımı tasarrufu: ürün değişikliği ana sayfa + kategori sayfalarını ve YALNIZCA değişen ürünlerin
// sayfalarını yeniler; diğer ürün sayfaları ve kategori listesi (menü) dokunulmaz.
import { updateTag } from "next/cache";
import { CATALOG_TAG, CATEGORIES_TAG, productTag } from "./catalog";

export function invalidateCatalog(productIds?: (string | null | undefined)[] | null, opts?: { categories?: boolean }) {
  updateTag(CATALOG_TAG);
  for (const id of new Set((productIds ?? []).filter((x): x is string => !!x))) updateTag(productTag(id));
  if (opts?.categories) updateTag(CATEGORIES_TAG);
}
