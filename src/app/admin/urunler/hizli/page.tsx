import { requireAdmin } from "@/lib/data/auth";
import { QuickAddGrid } from "@/components/admin/QuickAddGrid";
import type { Category } from "@/lib/types";

export const metadata = { title: "Hızlı ürün ekle" };

export default async function QuickAddPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return <QuickAddGrid categories={(data ?? []) as Category[]} />;
}
