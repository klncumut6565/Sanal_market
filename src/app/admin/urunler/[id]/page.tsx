import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/data/auth";
import { ProductForm } from "@/components/admin/ProductForm";
import type { Category, Product } from "@/lib/types";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

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
        <span className="text-sm">
          <DeleteProductButton id={id} name={(product as Product).name} redirectTo="/admin/urunler" label="Ürünü sil" />
        </span>
      </div>
      <ProductForm product={product as Product} categories={(categories ?? []) as Category[]} cost={cost ? Number(cost.cost_price) : null} />
    </div>
  );
}
