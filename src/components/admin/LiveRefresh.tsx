"use client";
// Sunucu sayfasını canlı tutar: Supabase Realtime olaylarında (ve yedek olarak belirli aralıklarla) router.refresh().
// Kullanıcı bir alana yazarken (input/select/textarea odaktayken) yenileme ertelenir, yazdığı kaybolmaz.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LiveRefresh({ tables, intervalMs = 20_000, label = "Canlı" }: { tables: string[]; intervalMs?: number; label?: string }) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [at, setAt] = useState<string>("");
  const key = tables.join(",");

  useEffect(() => {
    const sb = createClient();
    let pending = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const busy = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
    };
    const doRefresh = () => {
      if (busy()) {
        pending = true;
        return;
      }
      pending = false;
      router.refresh();
      setAt(new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date()));
    };
    const soon = () => {
      clearTimeout(debounce);
      debounce = setTimeout(doRefresh, 600);
    };
    let ch = sb.channel(`canli-${key}-${Math.random().toString(36).slice(2)}`);
    for (const t of key.split(",")) ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, soon);
    ch.subscribe((st) => setOn(st === "SUBSCRIBED"));
    const timer = setInterval(() => document.visibilityState === "visible" && doRefresh(), intervalMs);
    const onBlur = () => pending && setTimeout(doRefresh, 300);
    const onVis = () => document.visibilityState === "visible" && doRefresh();
    document.addEventListener("focusout", onBlur);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(debounce);
      clearInterval(timer);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      void sb.removeChannel(ch);
    };
  }, [key, intervalMs, router]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold ring-1 ring-line" title="Değişiklikler otomatik görünür">
      <span className={`h-2 w-2 rounded-full ${on ? "animate-pulse bg-emerald-500" : "bg-muted/40"}`} />
      {on ? label : "Bağlanıyor…"}
      {at && <span className="font-normal text-muted">· {at}</span>}
    </span>
  );
}
