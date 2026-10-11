"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";

export type CartLine = {
  id: string;
  slug: string;
  name: string;
  unit_label: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  emoji: string | null;
  max: number; // min(stock, max_per_order) — son bilinen değer; kesin kontrol sunucuda
  qty: number;
};

type CartState = {
  lines: CartLine[];
  add: (p: Product) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (p) =>
        set((s) => {
          const max = Math.max(0, Math.min(p.stock, p.max_per_order));
          const existing = s.lines.find((l) => l.id === p.id);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.id === p.id ? { ...l, max, qty: Math.min(l.qty + 1, max) } : l,
              ),
            };
          }
          if (max < 1) return s;
          return {
            lines: [
              ...s.lines,
              {
                id: p.id,
                slug: p.slug,
                name: p.name,
                unit_label: p.unit_label,
                price: p.price,
                sale_price: p.sale_price,
                image_url: p.image_url,
                emoji: p.emoji,
                max,
                qty: 1,
              },
            ],
          };
        }),
      setQty: (id, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => l.id !== id)
              : s.lines.map((l) => (l.id === id ? { ...l, qty: Math.min(qty, l.max) } : l)),
        })),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "sanal-market-sepet",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

/** localStorage'dan sepeti yalnızca istemcide yükler (hydration uyuşmazlığı olmaz). */
export function useCartHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const done = () => setReady(true);
    if (useCart.persist.hasHydrated()) done();
    else {
      const unsub = useCart.persist.onFinishHydration(done);
      useCart.persist.rehydrate();
      return unsub;
    }
  }, []);
  return ready;
}

export const lineUnit = (l: Pick<CartLine, "price" | "sale_price">) => Number(l.sale_price ?? l.price);

export function cartTotals(lines: CartLine[], fee: number, freeThreshold: number) {
  // Rozetlerde ürün ÇEŞİDİ sayısı gösterilir (2 × domates = 1 ürün), toplam adet ayrı
  const count = lines.length;
  const units = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + lineUnit(l) * l.qty, 0);
  const savings = lines.reduce(
    (a, l) => a + (l.sale_price != null ? (l.price - l.sale_price) * l.qty : 0),
    0,
  );
  const delivery = count === 0 || subtotal >= freeThreshold ? 0 : fee;
  return { count, units, subtotal, savings, delivery, total: subtotal + delivery };
}
