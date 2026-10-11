"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFavorites } from "@/store/favorites";
import { ProductGrid } from "@/components/shop/ProductCard";
import type { Product } from "@/lib/types";

const COLS =
  "id,category_id,name,slug,description,unit_label,price,sale_price,stock,critical_stock,max_per_order,image_url,emoji,is_active,is_featured,sort_order";

export function FavoritesClient() {
  const ids = useFavorites();
  const [products, setProducts] = useState<Product[] | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    let alive = true;
    const list = key ? key.split(",") : [];
    if (!list.length) {
      Promise.resolve().then(() => alive && setProducts([]));
      return;
    }
    createClient()
      .from("products")
      .select(COLS)
      .in("id", list)
      .eq("is_active", true)
      .then(({ data }) => {
        if (!alive) return;
        const byId = new Map(((data ?? []) as Product[]).map((p) => [p.id, { ...p, price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price) }]));
        setProducts(list.map((id) => byId.get(id)).filter(Boolean) as Product[]);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  if (products === null) return <div className="h-60 animate-pulse rounded-2xl bg-white" />;
  if (!products.length)
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-line">
        <Heart size={36} className="mx-auto text-brand" />
        <p className="mt-2 font-bold">Henüz favori ürünün yok</p>
        <p className="mt-1 text-sm text-muted">Ürünlerdeki ♡ simgesine dokunarak sık aldıklarını buraya ekleyebilirsin.</p>
        <Link href="/" className="btn-primary mx-auto mt-4 flex w-fit">Alışverişe başla</Link>
      </div>
    );
  return <ProductGrid products={products} />;
}
