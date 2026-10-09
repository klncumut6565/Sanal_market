"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Category } from "@/lib/types";

function useActive() {
  const path = usePathname();
  return (slug: string | null) => (slug === null ? path === "/" : path === `/kategori/${slug}`);
}

export function CategorySidebar({ categories }: { categories: Category[] }) {
  const isActive = useActive();
  const item = "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition";
  return (
    <nav aria-label="Kategoriler" className="sticky top-[84px] space-y-0.5">
      <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-muted">Kategoriler</p>
      <Link href="/" className={`${item} ${isActive(null) ? "bg-brand-soft text-brand" : "hover:bg-white"}`}>
        <span className="text-lg">🏠</span> Tümü
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/kategori/${c.slug}`}
          className={`${item} ${isActive(c.slug) ? "bg-brand-soft text-brand" : "hover:bg-white"}`}
        >
          <span className="text-lg">{c.emoji ?? "🛒"}</span> {c.name}
        </Link>
      ))}
    </nav>
  );
}

export function CategoryChips({ categories }: { categories: Category[] }) {
  const isActive = useActive();
  const chip = "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition";
  return (
    <nav aria-label="Kategoriler" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      <Link href="/" className={`${chip} ${isActive(null) ? "bg-brand text-white ring-brand" : "bg-white ring-line"}`}>
        Tümü
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/kategori/${c.slug}`}
          className={`${chip} ${isActive(c.slug) ? "bg-brand text-white ring-brand" : "bg-white ring-line"}`}
        >
          {c.emoji} {c.name}
        </Link>
      ))}
    </nav>
  );
}
