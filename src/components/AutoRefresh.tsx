"use client";
// Sayfayı güncel tutar. realtime verilirse (ör. ["orders"]) değişiklik olunca ANINDA yenilenir ve
// yedek olarak seyrek aralıkla yoklar; verilmezse yalnız aralıkla. Sekme arka plandaysa yenilemez
// (Supabase veri çıkışı / kota tasarrufu).
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function AutoRefresh({ seconds, realtime }: { seconds: number; realtime?: string[] }) {
  const router = useRouter();
  const key = (realtime ?? []).join(",");
  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const t = setInterval(() => visible() && router.refresh(), seconds * 1000);
    const onVis = () => visible() && router.refresh();
    document.addEventListener("visibilitychange", onVis);
    let cleanup = () => {};
    if (key) {
      const sb = createClient();
      let debounce: ReturnType<typeof setTimeout> | undefined;
      let ch = sb.channel(`yenile-${key}-${Math.random().toString(36).slice(2)}`);
      for (const table of key.split(",")) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => visible() && router.refresh(), 800);
        });
      }
      ch.subscribe();
      cleanup = () => {
        clearTimeout(debounce);
        void sb.removeChannel(ch);
      };
    }
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      cleanup();
    };
  }, [router, seconds, key]);
  return null;
}
