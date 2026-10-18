"use client";
// Sunucu sayfasını canlı tutar: Supabase Realtime olaylarında (ve yedek olarak belirli aralıklarla) router.refresh().
// Kullanıcı bir alana yazarken (input/select/textarea odaktayken) yenileme ertelenir, yazdığı kaybolmaz.
// ignore: tablo → yok sayılacak sütunlar. Bir olayda yalnızca bu sütunlar değiştiyse sayfa yenilenmez
// (ör. kurye konumu 15 sn'de bir değişir; her seferinde tüm sayfayı yeniden yüklemek gereksiz veri çıkışıdır).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LiveRefresh({
  tables,
  intervalMs = 20_000,
  label = "Canlı",
  ignore,
}: {
  tables: string[];
  intervalMs?: number;
  label?: string;
  ignore?: Record<string, string[]>;
}) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [at, setAt] = useState<string>("");
  const key = tables.join(",");
  const ignoreKey = JSON.stringify(ignore ?? {});

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
    const ign = JSON.parse(ignoreKey) as Record<string, string[]>;
    const seen = new Map<string, string>(); // satır → yok sayılan sütunlar hariç son hali
    const onChange = (table: string) => (p: { eventType: string; new: Record<string, unknown> }) => {
      const cols = ign[table];
      if (cols && p.eventType === "UPDATE" && p.new) {
        const rest = Object.fromEntries(Object.entries(p.new).filter(([k]) => !cols.includes(k)));
        const id = String(p.new.id ?? p.new.user_id ?? "");
        const sig = JSON.stringify(rest);
        const prev = seen.get(id);
        seen.set(id, sig);
        if (prev === sig) return; // yalnızca yok sayılan sütunlar (ör. konum) değişti
      }
      soon();
    };
    let ch = sb.channel(`canli-${key}-${Math.random().toString(36).slice(2)}`);
    for (const t of key.split(",")) ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, onChange(t));
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
  }, [key, ignoreKey, intervalMs, router]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold ring-1 ring-line" title="Değişiklikler otomatik görünür">
      <span className={`h-2 w-2 rounded-full ${on ? "animate-pulse bg-emerald-500" : "bg-muted/40"}`} />
      {on ? label : "Bağlanıyor…"}
      {at && <span className="font-normal text-muted">· {at}</span>}
    </span>
  );
}
