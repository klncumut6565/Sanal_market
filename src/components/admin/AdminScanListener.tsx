"use client";
import { useRouter } from "next/navigation";
import { useHidScanner } from "@/lib/hidScanner";

/** Yönetim panelinin her yerinde: bir kutuya odaklanmadan el okuyucuyla barkod okutulursa ürünü bulur. */
export function AdminScanListener() {
  const router = useRouter();
  useHidScanner((code, target) => {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return false;
    router.push(`/admin/urunler?q=${encodeURIComponent(code)}`);
    return true;
  });
  return null;
}
