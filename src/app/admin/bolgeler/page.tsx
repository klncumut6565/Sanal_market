import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { addSuggestedStreet, ignoreSuggestedStreet, mapSuggestedStreet, toggleDistrict } from "../actions";
import { closestStreet, prettyStreet, streetKey } from "@/lib/streetSuggest";

export const metadata = { title: "Teslimat bölgeleri" };

type Nb = { id: number; name: string; is_active: boolean; district_id: number };

export default async function AreasPage() {
  const { supabase } = await requireAdmin();
  const [{ data: districts }, { data: nbs }, { data: streetRows }, { data: typed }, { data: ignored }] = await Promise.all([
    supabase.from("delivery_districts").select("id,name,is_active").order("sort_order"),
    supabase.from("delivery_neighborhoods").select("id,name,is_active,district_id").order("name"),
    supabase.from("delivery_streets").select("id,neighborhood_id,name").limit(20000),
    supabase
      .from("orders")
      .select("addr_neighborhood,addr_street,created_at")
      .eq("addr_district", "Çorlu")
      .is("addr_street_id", null)
      .not("addr_street", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("delivery_street_ignored").select("neighborhood_id,name_key"),
  ]);
  const counts = new Map<number, number>();
  for (const r of streetRows ?? []) counts.set(r.neighborhood_id, (counts.get(r.neighborhood_id) ?? 0) + 1);
  const neighborhoods = ((nbs ?? []) as Nb[]).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const corlu = (districts ?? []).find((d) => d.name === "Çorlu");

  // Müşterilerin elle yazdığı, listede olmayan sokaklar
  const byNb = new Map<number, { id: number; name: string }[]>();
  for (const r of streetRows ?? []) {
    const l = byNb.get(r.neighborhood_id) ?? [];
    l.push({ id: r.id, name: r.name });
    byNb.set(r.neighborhood_id, l);
  }
  const skip = new Set((ignored ?? []).map((i) => `${i.neighborhood_id}|${i.name_key}`));
  const sugg = new Map<string, { nb: Nb; street: string; count: number; last: string; similar: { id: number; name: string } | null }>();
  for (const o of typed ?? []) {
    const nb = neighborhoods.find((n) => n.name === o.addr_neighborhood && n.district_id === corlu?.id);
    if (!nb || !nb.is_active || !o.addr_street) continue;
    const k = streetKey(o.addr_street);
    const key = `${nb.id}|${k}`;
    if (skip.has(key)) continue;
    const list = byNb.get(nb.id) ?? [];
    if (list.some((x) => streetKey(x.name) === k)) continue; // zaten listede
    const cur = sugg.get(key);
    if (cur) cur.count++;
    else sugg.set(key, { nb, street: o.addr_street, count: 1, last: o.created_at, similar: closestStreet(o.addr_street, list) });
  }
  const suggestions = [...sugg.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black">Teslimat bölgeleri</h1>
        <p className="text-sm text-muted">Tekirdağ · Müşteriler adresini buradaki ilçe, mahalle ve sokaklardan seçer.</p>
      </div>

      <section className="rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
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

      <section id="oneriler" className="scroll-mt-20 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <h2 className="font-extrabold">
          Müşterilerin yazdığı sokaklar{" "}
          {suggestions.length > 0 && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs text-white">{suggestions.length}</span>}
        </h2>
        <p className="mb-2 text-xs text-muted">
          Listede bulamayıp elle yazılan sokaklar. Adı düzeltip <b>Ekle</b>; yazım hatasıysa listedeki karşılığını seç; anlamsızsa <b>Yoksay</b>. Eklenince o
          siparişler de bu sokağa bağlanır.
        </p>
        {suggestions.length === 0 ? (
          <p className="rounded-xl bg-white/70 p-3 text-sm text-muted">Şu an bekleyen öneri yok.</p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={`${s.nb.id}-${s.street}`} className="rounded-xl bg-white p-3 ring-1 ring-amber-200">
                <p className="text-xs text-muted">
                  {s.nb.name} Mah. · {s.count} sipariş · yazılan: <span className="font-semibold text-ink">&quot;{s.street}&quot;</span>
                </p>
                <form action={addSuggestedStreet} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="neighborhood_id" value={s.nb.id} />
                  <input type="hidden" name="typed" value={s.street} />
                  <input type="hidden" name="back" value="/admin/bolgeler#oneriler" />
                  <input name="name" defaultValue={prettyStreet(s.street)} maxLength={120} className="input h-10 min-w-0 flex-1 basis-48 text-sm" aria-label="Sokak adı" />
                  <button className="btn-primary h-10 px-3 text-sm">Ekle</button>
                  {s.similar && (
                    <button formAction={mapSuggestedStreet} name="street_id" value={s.similar.id} className="h-10 rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                      = {s.similar.name}
                    </button>
                  )}
                  <button formAction={ignoreSuggestedStreet} className="h-10 rounded-xl px-3 text-xs font-bold text-muted ring-1 ring-line">
                    Yoksay
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
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
