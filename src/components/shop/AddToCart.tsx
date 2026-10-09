"use client";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart, useCartHydrated } from "@/store/cart";
import type { Product } from "@/lib/types";

export function AddToCart({ product, variant = "card" }: { product: Product; variant?: "card" | "wide" }) {
  const ready = useCartHydrated();
  const line = useCart((s) => s.lines.find((l) => l.id === product.id));
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const qty = ready ? (line?.qty ?? 0) : 0;
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
      <button
        onClick={() => add(product)}
        aria-label={`${product.name} sepete ekle`}
        className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-brand shadow-sm transition hover:border-brand hover:bg-brand hover:text-white active:scale-95"
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <div
      className={`flex items-center justify-between rounded-full bg-brand text-white shadow-sm ${
        variant === "wide" ? "h-12 w-full px-2 text-base" : "h-9 w-[104px] px-1 text-sm"
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
