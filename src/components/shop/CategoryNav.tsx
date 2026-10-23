"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { art3d } from "@/lib/categoryArt";
import { CategoryIcon } from "@/components/shop/CategoryIcon";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Category } from "@/lib/types";
import { childrenOf, topLevel } from "@/lib/categoryTree";

function useActiveSlug() {
  const path = usePathname();
  return path.startsWith("/kategori/") ? decodeURIComponent(path.slice("/kategori/".length).split("/")[0]) : path === "/" ? "" : null;
}

export function CategorySidebar({ categories }: { categories: Category[] }) {
  const active = useActiveSlug();
  const item = "flex items-center gap-2 rounded-xl px-2 py-1.5 text-[13.5px] font-semibold leading-tight transition";
  const activeCat = categories.find((c) => c.slug === active);
  const openParent = activeCat?.parent_id ?? activeCat?.id;
  const navRef = useRef<HTMLElement>(null);
  // Seçili kategori menünün görünen alanında değilse menüyü oraya kaydır (sayfa kaymaz)
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !el) return;
    const top = el.offsetTop - nav.offsetTop;
    if (top < nav.scrollTop || top + el.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTop = Math.max(0, top - nav.clientHeight / 3);
  }, [active]);
  return (
    // Menü ekrandan uzunsa kendi içinde kayar (küçük ekranda tüm kategorilere ulaşılır)
    <nav
      ref={navRef}
      aria-label="Kategoriler"
      className="thin-scrollbar sticky top-[84px] max-h-[calc(100dvh-100px)] space-y-0.5 overflow-y-auto overscroll-contain pb-4 pr-1"
    >
      <p className="sticky top-0 z-10 bg-bg px-2 pb-2 text-xs font-bold uppercase tracking-wider text-muted">Kategoriler</p>
      <Link href="/" aria-current={active === "" ? "page" : undefined} className={`${item} ${active === "" ? "bg-brand-soft text-brand" : "hover:bg-white"}`}>
        <span className="text-lg">🏠</span> Tümü
      </Link>
      {topLevel(categories).map((c) => {
        const subs = childrenOf(categories, c.id);
        return (
          <div key={c.id}>
            <Link href={`/kategori/${c.slug}`} aria-current={active === c.slug ? "page" : undefined} className={`${item} ${active === c.slug ? "bg-brand-soft text-brand" : "hover:bg-white"}`}>
              <CategoryIcon cat={c} className="text-lg" imgClass="h-5 w-5 shrink-0" /> <span className="min-w-0">{c.name}</span>
            </Link>
            {openParent === c.id && subs.length > 0 && (
              <div className="mb-1 ml-4 space-y-0.5 border-l border-line pl-1.5">
                {subs.map((s) => (
                  <Link
                    key={s.id}
                    href={`/kategori/${s.slug}`}
                    aria-current={active === s.slug ? "page" : undefined}
                    className={`block rounded-lg px-2 py-1 text-[12.5px] leading-tight font-semibold ${active === s.slug ? "bg-brand-soft text-brand" : "text-muted hover:bg-white hover:text-ink"}`}
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
          <CategoryIcon cat={c} imgClass="h-5 w-5 -my-1" /> {c.name}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Üstte yatay kategori kartları (kenar menüsü yerine): 3D simge + ad + ürün sayısı.
 * hideOnHome: ana sayfada şerit hero'nun altında ayrıca gösterildiği için düzen içindeki kopya gizlenir.
 */
export function CategoryStrip({ categories, counts = {}, hideOnHome = false }: { categories: Category[]; counts?: Record<string, number>; hideOnHome?: boolean }) {
  const active = useActiveSlug();
  const activeCat = categories.find((c) => c.slug === active);
  const activeTop = activeCat?.parent_id ?? activeCat?.id;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeTop]);
  if (hideOnHome && active === "") return null;
  const card =
    "group flex w-[86px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2.5 text-center transition sm:w-[100px]";
  return (
    <nav ref={ref} aria-label="Kategoriler" className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 py-1.5">
      <Link
        href="/"
        aria-current={active === "" ? "page" : undefined}
        className={`${card} ${active === "" ? "bg-brand text-white shadow-lg shadow-brand/25" : "bg-white ring-1 ring-line hover:ring-brand/40"}`}
      >
        <span className="grid h-11 w-11 place-items-center"><LayoutGrid size={26} strokeWidth={1.8} /></span>
        <span className="text-[12px] font-bold leading-tight">Tümü</span>
      </Link>
      {topLevel(categories).map((c) => {
        const on = activeTop === c.id;
        const src = c.image_url || art3d(c.emoji);
        const n = counts[c.id];
        return (
          <Link
            key={c.id}
            href={`/kategori/${c.slug}`}
            aria-current={on ? "page" : undefined}
            className={`${card} ${on ? "bg-brand-soft ring-2 ring-brand" : "bg-white shadow-[0_2px_10px_rgba(18,48,74,0.05)] ring-1 ring-line hover:ring-brand/40"}`}
          >
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl">
              {src ? (
                <img src={src} alt="" loading="lazy" width={44} height={44} className={`h-11 w-11 ${c.image_url ? "object-cover" : "object-contain drop-shadow"} transition group-hover:scale-110`} />
              ) : (
                <span className="text-3xl">{c.emoji ?? "🛒"}</span>
              )}
            </span>
            <span className="line-clamp-2 text-[12px] font-bold leading-tight text-navy">{c.name}</span>
            {n != null && <span className="text-[10.5px] font-semibold text-muted">{n.toLocaleString("tr-TR")} ürün</span>}
          </Link>
        );
      })}
    </nav>
  );
}
