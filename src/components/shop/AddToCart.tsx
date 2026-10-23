"use client";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCart, useCartHydrated } from "@/store/cart";
import type { Product } from "@/lib/types";

export function AddToCart({ product, variant = "card" }: { product: Product; variant?: "card" | "wide" }) {
  const ready = useCartHydrated();
  const line = useCart((s) => s.lines.find((l) => l.id === product.id));
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const qty = ready ? (line?.qty ?? 0) : 0;
  const [pick, setPick] = useState(1); // sepete eklemeden önce seçilen adet (kart görünümü)
  const max = Math.min(product.stock, product.max_per_order);
  const soldOut = product.stock <= 0;

  if (soldOut) {
    return variant === "wide" ? (
      <button disabled className="btn-primary w-full">Tükendi</button>
    ) : null;
  }

  if (qty === 0) {
    return variant === "wide" ? (
      <button onClick={() => add(product)} className="btn-primary w-full">
        <Plus size={18} /> Sepete ekle
      </button>
    ) : (
      // Kart: – adet + seçici ve sepet düğmesi
      <div className="flex w-full items-center gap-1.5">
        <div className="flex h-9 flex-1 items-center justify-between rounded-xl bg-bg px-0.5 text-sm ring-1 ring-line">
          <button onClick={() => setPick((n) => Math.max(1, n - 1))} aria-label="Azalt" className="grid h-8 w-7 place-items-center rounded-lg text-muted hover:text-ink disabled:opacity-30" disabled={pick <= 1}>
            <Minus size={15} strokeWidth={2.5} />
          </button>
          <span className="font-bold tabular-nums">{pick}</span>
          <button onClick={() => setPick((n) => Math.min(max, n + 1))} aria-label="Artır" className="grid h-8 w-7 place-items-center rounded-lg text-muted hover:text-ink disabled:opacity-30" disabled={pick >= max}>
            <Plus size={15} strokeWidth={2.5} />
          </button>
        </div>
        <button
          onClick={() => {
            add(product);
            if (pick > 1) setQty(product.id, pick);
            setPick(1);
          }}
          aria-label={`${product.name} sepete ekle`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
        >
          <ShoppingCart size={17} strokeWidth={2.4} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between rounded-full bg-brand text-white shadow-sm ${
        variant === "wide" ? "h-12 w-full px-2 text-base" : "h-9 w-full rounded-xl px-1 text-sm"
      }`}
    >
      <button
        onClick={() => setQty(product.id, qty - 1)}
        aria-label="Azalt"
        className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15"
      >
        {qty === 1 ? <Trash2 size={16} /> : <Minus size={16} strokeWidth={2.5} />}
      </button>
      <span className="font-bold tabular-nums">{qty}</span>
      <button
        onClick={() => add(product)}
        disabled={qty >= max}
        aria-label="Artır"
        className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15 disabled:opacity-40"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
