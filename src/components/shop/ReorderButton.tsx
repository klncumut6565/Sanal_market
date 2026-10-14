"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCart, useCartHydrated } from "@/store/cart";
import type { OrderItem, Product } from "@/lib/types";

type Item = Pick<OrderItem, "product_id" | "product_name" | "quantity" | "removed">;
type Props = {
  /** Sipariş kalemleri elde varsa doğrudan verilir; yoksa orderId (+ token) ile yüklenir. */
  items?: Item[];
  orderId?: string;
  token?: string;
  compact?: boolean;
};

const PRODUCT_COLS = "id,category_id,name,slug,description,unit_label,price,sale_price,stock,critical_stock,max_per_order,image_url,emoji,is_active,is_featured,sort_order";

/** Önceki siparişteki ürünleri güncel fiyat ve stokla sepete ekler. */
export function ReorderButton({ items, orderId, token, compact }: Props) {
  const router = useRouter();
  const ready = useCartHydrated();
  const addQty = useCart((s) => s.addQty);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; missing: string[]; partial: string[] } | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const sb = createClient();
      let list = items;
      if (!list && orderId) {
        if (token) {
          const { data } = await sb.rpc("get_order_public", { p_order_id: orderId, p_token: token });
          list = (data as { items: Item[] } | null)?.items ?? [];
        } else {
          const { data } = await sb.from("order_items").select("product_id,product_name,quantity,removed").eq("order_id", orderId);
          list = (data ?? []) as Item[];
        }
      }
      const wanted = new Map<string, { name: string; qty: number }>();
      const missing: string[] = [];
      for (const it of list ?? []) {
        if (it.removed) continue;
        if (!it.product_id) {
          missing.push(it.product_name);
          continue;
        }
        const w = wanted.get(it.product_id);
        wanted.set(it.product_id, { name: it.product_name, qty: (w?.qty ?? 0) + Number(it.quantity) });
      }
      const ids = [...wanted.keys()];
      const { data: prods } = ids.length ? await sb.from("products").select(PRODUCT_COLS).in("id", ids) : { data: [] };
      const byId = new Map(((prods ?? []) as Product[]).filter((p) => p.is_active).map((p) => [p.id, p]));
      let added = 0;
      const partial: string[] = [];
      for (const [id, w] of wanted) {
        const p = byId.get(id);
        if (!p || p.stock < 1) {
          missing.push(w.name);
          continue;
        }
        const n = addQty(p, w.qty);
        if (n > 0) added++;
        if (n < w.qty) partial.push(p.name);
      }
      if (added > 0 && missing.length === 0 && partial.length === 0) {
        router.push("/sepet");
        return;
      }
      setResult({ added, missing, partial });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "" : "space-y-2"}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void run();
        }}
        disabled={!ready || busy}
        className={compact ? "flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs font-bold text-brand disabled:opacity-50" : "btn-primary w-full disabled:opacity-60"}
      >
        {busy ? <Loader2 size={compact ? 14 : 18} className="animate-spin" /> : <RotateCcw size={compact ? 14 : 18} />}
        {compact ? "Tekrarla" : "Bu siparişi tekrar sepete ekle"}
      </button>
      {result && (
        <div className={`rounded-2xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200 ${compact ? "mt-2" : ""}`}>
          {result.added > 0 ? <p className="font-bold">{result.added} ürün sepete eklendi.</p> : <p className="font-bold">Bu siparişteki ürünler şu an satışta değil.</p>}
          {result.missing.length > 0 && <p className="text-muted">Stokta yok / satıştan kalktı: {result.missing.join(", ")}</p>}
          {result.partial.length > 0 && <p className="text-muted">Stok yetersiz, eksik eklendi: {result.partial.join(", ")}</p>}
          {result.added > 0 && (
            <Link href="/sepet" className="mt-2 inline-block font-bold text-brand underline">
              Sepete git →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
