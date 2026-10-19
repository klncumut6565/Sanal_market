"use client";
// Yönetim paneli açıkken: bekleyen vitrin (ana sayfa / kategori) yenilemesi varsa, 30 dk'lık süre dolunca uygular.
// Ürün düzenlemeleri vitrine en geç ~30 dk içinde yansır; ürün sayfasının kendisi anında güncellenir.
import { useEffect } from "react";
import { flushCatalogAction } from "@/app/admin/cacheActions";

export function CatalogAutoFlush() {
  useEffect(() => {
    const run = () => document.visibilityState === "visible" && void flushCatalogAction().catch(() => {});
    const first = setTimeout(run, 5_000);
    const t = setInterval(run, 5 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return null;
}
