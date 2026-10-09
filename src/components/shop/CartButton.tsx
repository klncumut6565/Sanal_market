"use client";
import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { useCart, useCartHydrated, cartTotals } from "@/store/cart";
import { formatTL } from "@/lib/format";

export function CartButton() {
  const ready = useCartHydrated();
  const lines = useCart((s) => s.lines);
  const { count, subtotal } = cartTotals(ready ? lines : [], 0, 0);
  return (
    <Link
      href="/sepet"
      className="relative flex h-11 items-center gap-2 rounded-full bg-brand px-3.5 font-bold text-white transition hover:bg-brand-dark"
    >
      <ShoppingBasket size={20} />
      <span className="hidden text-sm sm:inline">{count > 0 ? formatTL(subtotal) : "Sepet"}</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px]">
          {count}
        </span>
      )}
    </Link>
  );
}
