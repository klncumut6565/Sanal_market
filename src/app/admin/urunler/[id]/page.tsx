import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/data/auth";
import { ProductForm } from "@/components/admin/ProductForm";
import type { Category, Product } from "@/lib/types";
import { deleteProduct } from "../../actions";

export const metadata = { title: "Ürünü düzenle" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: product }, { data: categories }, { data: cost }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("product_costs").select("cost_price").eq("product_id", id).maybeSingle(),
  ]);
  if (!product) notFound();
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Ürünü düzenle</h1>
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={id} />
          <button className="text-sm font-bold text-muted hover:text-brand">Ürünü sil</button>
        </form>
      </div>
      <ProductForm product={product as Product} categories={(categories ?? []) as Category[]} cost={cost ? Number(cost.cost_price) : null} />
    </div>
  );
}
