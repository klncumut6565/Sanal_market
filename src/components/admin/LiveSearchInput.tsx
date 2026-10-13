"use client";
// Yazdıkça arar: adresi (?q=) kısa gecikmeyle günceller, Enter'a basmaya gerek yok.
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

export function LiveSearchInput({ placeholder, param = "q", className = "" }: { placeholder: string; param?: string; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get(param) ?? "");
  const [pending, start] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (value.trim()) next.set(param, value.trim());
      else next.delete(param);
      next.delete("s"); // yeni aramada ilk sayfaya dön
      const qs = next.toString();
      start(() => router.replace(qs ? `${path}?${qs}` : path, { scroll: false }));
    }, 250);
    return () => clearTimeout(t);
    // sp bilinçli olarak dışarıda: yalnızca yazılan değer değişince ara
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className={`flex min-w-0 items-center gap-2 rounded-xl border border-line bg-white px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 ${className}`}>
      {pending ? <Loader2 size={16} className="shrink-0 animate-spin text-brand" /> : <Search size={16} className="shrink-0 text-muted" />}
      <input
        name={param}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full min-w-0 bg-transparent py-2.5 text-[15px] outline-none"
      />
      {value && (
        <button type="button" onClick={() => setValue("")} aria-label="Aramayı temizle" className="shrink-0 text-muted hover:text-ink">
          <X size={16} />
        </button>
      )}
    </label>
  );
}
