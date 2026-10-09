"use client";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (v.length >= 2) router.push(`/ara?q=${encodeURIComponent(v)}`);
      }}
      className="relative w-full"
    >
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Markette ara"
        enterKeyHint="search"
        className="h-11 w-full rounded-full border border-line bg-bg pl-10 pr-10 text-[15px] outline-none transition focus:border-brand focus:bg-white"
      />
      {q && (
        <button type="button" onClick={() => setQ("")} aria-label="Temizle" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <X size={16} />
        </button>
      )}
    </form>
  );
}
