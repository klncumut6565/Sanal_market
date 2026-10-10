import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { addSuggestedStreet, toggleDistrict } from "../actions";

export const metadata = { title: "Teslimat bölgeleri" };

type Nb = { id: number; name: string; is_active: boolean; district_id: number };

export default async function AreasPage() {
  const { supabase } = await requireAdmin();
  const [{ data: districts }, { data: nbs }, { data: streetRows }, { data: typed }] = await Promise.all([
    supabase.from("delivery_districts").select("id,name,is_active").order("sort_order"),
    supabase.from("delivery_neighborhoods").select("id,name,is_active,district_id").order("name"),
    supabase.from("delivery_streets").select("neighborhood_id").limit(20000),
    supabase.from("orders").select("addr_neighborhood,addr_street").is("addr_street_id", null).not("addr_street", "is", null).limit(500),
  ]);
  const counts = new Map<number, number>();
  for (const r of streetRows ?? []) counts.set(r.neighborhood_id, (counts.get(r.neighborhood_id) ?? 0) + 1);
  const neighborhoods = ((nbs ?? []) as Nb[]).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const corlu = (districts ?? []).find((d) => d.name === "Çorlu");

  // Müşterilerin elle yazdığı, listede olmayan sokaklar
  const sugg = new Map<string, { nb: Nb; street: string; count: number }>();
  for (const o of typed ?? []) {
    const nb = neighborhoods.find((n) => n.name === o.addr_neighborhood && n.district_id === corlu?.id);
    if (!nb || !o.addr_street) continue;
    const key = `${nb.id}|${o.addr_street.toLocaleLowerCase("tr")}`;
    const cur = sugg.get(key);
    if (cur) cur.count++;
    else sugg.set(key, { nb, street: o.addr_street, count: 1 });
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black">Teslimat bölgeleri</h1>
        <p className="text-sm text-muted">Tekirdağ · Müşteriler adresini buradaki ilçe, mahalle ve sokaklardan seçer.</p>
      </div>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 font-extrabold">İlçeler</h2>
        <div className="flex flex-wrap gap-2">
          {(districts ?? []).map((d) => (
            <form key={d.id} action={toggleDistrict}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="on" value={d.is_active ? "0" : "1"} />
              <button className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${d.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-muted ring-line"}`}>
                {d.is_active ? "✓ " : ""}
                {d.name}
              </button>
            </form>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Yeşil olanlara teslimat açık. Dokunarak açıp kapatabilirsin (yeni ilçenin mahallelerini eklemeden açma).</p>
      </section>

      {sugg.size > 0 && (
        <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h2 className="font-extrabold">Müşterilerin yazdığı, listede olmayan sokaklar</h2>
          <p className="mb-2 text-xs text-muted">Doğruysa tek dokunuşla listeye ekle; sonraki müşteriler seçebilsin.</p>
          <ul className="divide-y divide-amber-200 text-sm">
            {[...sugg.values()].map((s) => (
              <li key={`${s.nb.id}-${s.street}`} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <b>{s.street}</b> <span className="text-muted">· {s.nb.name} Mah. · {s.count} sipariş</span>
                </span>
                <form action={addSuggestedStreet}>
                  <input type="hidden" name="neighborhood_id" value={s.nb.id} />
                  <input type="hidden" name="name" value={s.street} />
                  <input type="hidden" name="back" value="/admin/bolgeler" />
                  <button className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand ring-1 ring-line">Listeye ekle</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 flex items-center gap-2 font-extrabold"><MapPin size={18} className="text-brand" /> Çorlu mahalleleri</h2>
        <ul className="divide-y divide-line">
          {neighborhoods
            .filter((n) => n.district_id === corlu?.id)
            .map((n) => {
              const c = counts.get(n.id) ?? 0;
              return (
                <li key={n.id}>
                  <Link href={`/admin/bolgeler/${n.id}`} className="flex items-center justify-between py-2.5 hover:text-brand">
                    <span className={`font-semibold ${n.is_active ? "" : "text-muted line-through"}`}>{n.name} Mah.</span>
                    <span className="flex items-center gap-2 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {c ? `${c} sokak` : "sokak yok"}
                      </span>
                      <ChevronRight size={18} />
                    </span>
                  </Link>
                </li>
              );
            })}
        </ul>
        <p className="mt-2 text-xs text-muted">Sokağı olmayan mahallede müşteri sokak adını kendisi yazar.</p>
      </section>
    </div>
  );
}
