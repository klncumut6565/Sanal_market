"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Category } from "@/lib/types";
import { childrenOf, topLevel } from "@/lib/categoryTree";

function useActiveSlug() {
  const path = usePathname();
  return path.startsWith("/kategori/") ? decodeURIComponent(path.slice("/kategori/".length).split("/")[0]) : path === "/" ? "" : null;
}

export function CategorySidebar({ categories }: { categories: Category[] }) {
  const active = useActiveSlug();
  const item = "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition";
  const activeCat = categories.find((c) => c.slug === active);
  const openParent = activeCat?.parent_id ?? activeCat?.id;
  return (
    <nav aria-label="Kategoriler" className="sticky top-[84px] space-y-0.5">
      <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-muted">Kategoriler</p>
      <Link href="/" className={`${item} ${active === "" ? "bg-brand-soft text-brand" : "hover:bg-white"}`}>
        <span className="text-lg">🏠</span> Tümü
      </Link>
      {topLevel(categories).map((c) => {
        const subs = childrenOf(categories, c.id);
        return (
          <div key={c.id}>
            <Link href={`/kategori/${c.slug}`} className={`${item} ${active === c.slug ? "bg-brand-soft text-brand" : "hover:bg-white"}`}>
              <span className="text-lg">{c.emoji ?? "🛒"}</span> {c.name}
            </Link>
            {openParent === c.id && subs.length > 0 && (
              <div className="mb-1 ml-6 space-y-0.5 border-l border-line pl-2">
                {subs.map((s) => (
                  <Link
                    key={s.id}
                    href={`/kategori/${s.slug}`}
                    className={`block rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold ${active === s.slug ? "bg-brand-soft text-brand" : "text-muted hover:bg-white hover:text-ink"}`}
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function CategoryChips({ categories }: { categories: Category[] }) {
  const active = useActiveSlug();
  const activeCat = categories.find((c) => c.slug === active);
  const activeTop = activeCat?.parent_id ?? activeCat?.id;
  const chip = "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition";
  return (
    <nav aria-label="Kategoriler" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      <Link href="/" className={`${chip} ${active === "" ? "bg-brand text-white ring-brand" : "bg-white ring-line"}`}>
        Tümü
      </Link>
      {topLevel(categories).map((c) => (
        <Link key={c.id} href={`/kategori/${c.slug}`} className={`${chip} ${activeTop === c.id ? "bg-brand text-white ring-brand" : "bg-white ring-line"}`}>
          {c.emoji} {c.name}
        </Link>
      ))}
    </nav>
  );
}
