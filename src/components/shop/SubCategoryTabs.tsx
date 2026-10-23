"use client";
// Ana sayfa kategori bölümü: başlığın hemen altında alt kategori sekmeleri yan yana (en çok tercih edilen ilk ve seçili).
// Vercel ISR tasarrufu: sayfaya yalnızca İLK sekmenin ürünleri gömülür (sayfa küçük kalır); diğer sekmelerin
// ürünleri dokunulunca tarayıcıdan küçük bir sorguyla (10 ürün) gelir ve oturum boyunca saklanır.
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";
import { ProductRow } from "./ProductCard";

const ROW = 10;

type Tab = { id: string; label: string; count: number; href: string; categoryId: string | null };

export function SubCategoryTabs({ tabs, first }: { tabs: Tab[]; first: ReactNode }) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, Product[] | "err">>({});

  const load = async (t: Tab) => {
    if (loaded[t.id] || !t.categoryId) return;
    const sb = createClient();
    // Stokta → görseli olan → en çok satan önce (veritabanında sıralanır, yalnızca 10 ürün gelir)
    const { data, error } = await sb.rpc("category_top_products", { p_cat: t.categoryId, p_limit: ROW });
    setLoaded((m) => ({
      ...m,
      [t.id]: error ? "err" : ((data ?? []) as Product[]).map((p) => ({ ...p, price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price) })),
    }));
  };

  const cur = tabs[active];
  const items = loaded[cur.id];
  return (
    <div>
      <div role="tablist" aria-label="Alt kategoriler" className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => {
              setActive(i);
              if (i > 0) void load(t);
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold ring-1 transition ${
              i === active ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-line hover:ring-brand"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs font-semibold ${i === active ? "text-white/70" : "text-muted"}`}>{t.count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {active === 0 ? (
          first
        ) : items === "err" ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-muted ring-1 ring-line">Ürünler yüklenemedi. Tekrar deneyin.</p>
        ) : items ? (
          <ProductRow
            products={items}
            moreHref={cur.count > ROW ? cur.href : undefined}
            moreLabel={`Tümünü gör (${cur.count.toLocaleString("tr-TR")})`}
          />
        ) : (
          <div className="flex h-56 items-center justify-center rounded-2xl bg-white text-muted ring-1 ring-line">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
