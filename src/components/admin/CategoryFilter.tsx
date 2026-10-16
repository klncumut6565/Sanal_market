"use client";
// Ürünler & stok: Kategori + Alt kategori filtresi. Alt kategori, ana kategori seçilince o kategorinin
// alt kategorileriyle etkinleşir. Ana kategori değişince alt seçim sıfırlanır; seçim formu hemen gönderir.
import { useRef } from "react";

type Opt = { id: string; name: string; count: number };

export function CategoryFilter({ tops, subsByTop, top, sub }: { tops: Opt[]; subsByTop: Record<string, Opt[]>; top: string; sub: string }) {
  const subRef = useRef<HTMLSelectElement>(null);
  const subs = top ? (subsByTop[top] ?? []) : [];
  return (
    <>
      <select
        name="kategori"
        defaultValue={top}
        aria-label="Kategori"
        className="input max-w-52"
        onChange={(e) => {
          if (subRef.current) subRef.current.value = "";
          e.currentTarget.form?.requestSubmit();
        }}
      >
        <option value="">Tüm kategoriler</option>
        {tops.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.count})
          </option>
        ))}
      </select>
      <select
        ref={subRef}
        key={top /* ana kategori değişince seçenekler yenilensin */}
        name="alt"
        defaultValue={sub}
        aria-label="Alt kategori"
        disabled={!top || subs.length === 0}
        title={!top ? "Önce kategori seçin" : subs.length === 0 ? "Bu kategorinin alt kategorisi yok" : undefined}
        className="input max-w-52 disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">{!top ? "Alt kategori (önce kategori seçin)" : subs.length === 0 ? "Alt kategori yok" : "Tüm alt kategoriler"}</option>
        {subs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.count})
          </option>
        ))}
      </select>
    </>
  );
}
