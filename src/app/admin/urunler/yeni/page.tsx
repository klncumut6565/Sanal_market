import { requireAdmin } from "@/lib/data/auth";
import { ProductForm } from "@/components/admin/ProductForm";
import type { Category } from "@/lib/types";

export const metadata = { title: "Yeni ürün" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ barkod?: string }> }) {
  const { barkod } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-black">Yeni ürün</h1>
      <ProductForm categories={(data ?? []) as Category[]} initialBarcode={barkod} />
    </div>
  );
}
