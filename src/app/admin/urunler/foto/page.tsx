import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { PhotoMatcher } from "@/components/admin/PhotoMatcher";

export const metadata = { title: "Fotoğrafla ürün tanı" };

export default async function PhotoMatchPage() {
  const { supabase } = await requireAdmin();
  const [{ count: missing }, { count: total }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true).is("image_url", null),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  return (
    <div className="max-w-4xl space-y-4">
      <Link href="/admin/urunler" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> Ürünler & stok
      </Link>
      <div>
        <h1 className="text-2xl font-black">Fotoğrafla ürün tanı</h1>
        <p className="text-sm text-muted">
          Ürünün ön yüzünün fotoğrafını çekin (birden fazla da seçebilirsiniz). Yapay zekâ ambalajı okur ve katalogdaki kaydı bulur; siz
          doğru ürünü seçince görsel eklenir. Onayınız olmadan hiçbir şey kaydedilmez.
        </p>
        <p className="mt-2 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
          Satıştaki {total ?? 0} ürünün {missing ?? 0} tanesinin görseli yok ·{" "}
          <Link href="/admin/urunler?stok=gorselsiz" className="underline">listeyi gör</Link>
        </p>
      </div>
      <PhotoMatcher />
    </div>
  );
}
