"use client";
// Ana sayfa kategori bölümü: başlığın hemen altında alt kategori sekmeleri yan yana (en çok tercih edilen ilk ve seçili).
// Sekmeye dokununca altındaki ürün satırı o alt kategoriye geçer (sayfa yenilenmez).
import { useState, type ReactNode } from "react";

export function SubCategoryTabs({ tabs, panels }: { tabs: { id: string; label: string; count: number }[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div role="tablist" aria-label="Alt kategoriler" className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold ring-1 transition ${
              i === active ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-line hover:ring-brand"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs font-semibold ${i === active ? "text-white/70" : "text-muted"}`}>{t.count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel">{panels[active]}</div>
    </div>
  );
}
