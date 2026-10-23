import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/data/auth";
import { StreetBulkForm } from "@/components/admin/StreetBulkForm";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import { deleteStreet, toggleNeighborhood } from "../../actions";

export const metadata = { title: "Mahalle sokakları" };

export default async function NeighborhoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: nb }, { data: streets }] = await Promise.all([
    supabase.from("delivery_neighborhoods").select("id,name,is_active").eq("id", Number(id)).maybeSingle(),
    supabase.from("delivery_streets").select("id,name").eq("neighborhood_id", Number(id)).limit(5000),
  ]);
  if (!nb) notFound();
  const list = (streets ?? []).sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/admin/bolgeler" className="text-sm font-semibold text-muted hover:text-brand">← Teslimat bölgeleri</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">{nb.name} Mah.</h1>
        <form action={toggleNeighborhood}>
          <input type="hidden" name="id" value={nb.id} />
          <input type="hidden" name="on" value={nb.is_active ? "0" : "1"} />
          <input type="hidden" name="back" value={`/admin/bolgeler/${nb.id}`} />
          <button className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${nb.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-zinc-100 text-zinc-500 ring-line"}`}>
            {nb.is_active ? "Teslimat açık" : "Teslimat kapalı"} · değiştir
          </button>
        </form>
      </div>

      <section className="rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
        <h2 className="mb-1 font-extrabold">Cadde / sokak ekle</h2>
        <p className="mb-2 text-xs text-muted">Her satıra bir isim yaz veya listeyi yapıştır. Aynı isim tekrar eklenmez.</p>
        <StreetBulkForm neighborhoodId={nb.id} />
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
        <h2 className="mb-2 font-extrabold">Kayıtlı cadde / sokaklar <span className="text-sm text-muted">({list.length})</span></h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted">Henüz sokak yok. Müşteriler bu mahallede sokak adını kendisi yazar.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {list.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span>{s.name}</span>
                <form action={deleteStreet}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="neighborhood_id" value={nb.id} />
                  <ConfirmSubmit message={`"${s.name}" silinsin mi?`} className="text-xs font-semibold text-muted hover:text-brand">
                    Sil
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
