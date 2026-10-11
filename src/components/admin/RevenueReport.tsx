import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, businessDateOf, businessDateStart, isYmd, reportRanges } from "@/lib/hours";
import { formatTL } from "@/lib/format";
import { pctTR } from "@/lib/margin";

type Row = { created_at: string; total: number; status: string };
type Agg = { orders: number; revenue: number; cancelled: number };

const empty = (): Agg => ({ orders: 0, revenue: 0, cancelled: 0 });
const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", weekday: "short" }) =>
  new Intl.DateTimeFormat("tr-TR", { ...opts, timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));

/** İş gününe göre ciro raporu (iptaller ciroya dahil değil; teslimat ücreti dahil). */
export async function RevenueReport({ supabase, openTime, from, to }: { supabase: SupabaseClient; openTime: string; from?: string; to?: string }) {
  const r = reportRanges(openTime);
  let cFrom = isYmd(from) ? from : r.weekStart;
  let cTo = isYmd(to) ? to : r.today;
  if (cFrom > cTo) [cFrom, cTo] = [cTo, cFrom];
  // en fazla 366 gün
  if (Date.parse(cTo) - Date.parse(cFrom) > 366 * 86400_000) cFrom = addDays(cTo, -366);

  const qFrom = [r.prevMonthStart, cFrom].sort()[0];
  const qTo = [r.today, cTo].sort()[1];
  const rows: Row[] = [];
  for (let off = 0; off < 50000; off += 1000) {
    const { data } = await supabase
      .from("orders")
      .select("created_at,total,status")
      .gte("created_at", businessDateStart(qFrom, openTime))
      .lt("created_at", businessDateStart(addDays(qTo, 1), openTime))
      .order("created_at")
      .range(off, off + 999);
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
  }

  const byDay = new Map<string, Agg>();
  for (const o of rows) {
    const day = businessDateOf(Date.parse(o.created_at), openTime);
    const a = byDay.get(day) ?? empty();
    if (o.status === "iptal") a.cancelled++;
    else {
      a.orders++;
      a.revenue += Number(o.total);
    }
    byDay.set(day, a);
  }
  const sum = (a: string, b: string) => {
    const t = empty();
    for (let d = a; d <= b; d = addDays(d, 1)) {
      const x = byDay.get(d);
      if (x) {
        t.orders += x.orders;
        t.revenue += x.revenue;
        t.cancelled += x.cancelled;
      }
    }
    return t;
  };

  const cards = [
    { label: "Bugün", sub: fmtDay(r.today), a: sum(r.today, r.today), q: `bas=${r.today}&bit=${r.today}` },
    { label: "Dün", sub: fmtDay(r.yesterday), a: sum(r.yesterday, r.yesterday), q: `bas=${r.yesterday}&bit=${r.yesterday}` },
    { label: "Bu hafta", sub: `${fmtDay(r.weekStart, { day: "numeric", month: "short" })} – bugün`, a: sum(r.weekStart, r.today), q: `bas=${r.weekStart}&bit=${r.today}` },
    { label: "Bu ay", sub: fmtDay(r.monthStart, { month: "long" }), a: sum(r.monthStart, r.today), q: `bas=${r.monthStart}&bit=${r.today}` },
    { label: "Geçen ay", sub: fmtDay(r.prevMonthStart, { month: "long" }), a: sum(r.prevMonthStart, r.prevMonthEnd), q: `bas=${r.prevMonthStart}&bit=${r.prevMonthEnd}` },
  ];

  const total = sum(cFrom, cTo);

  // Brüt kâr: seçili aralıktaki ürün satışları − sipariş anındaki alış fiyatı (teslimat ücreti hariç)
  let itemRevenue = 0;
  let costedRevenue = 0;
  let costedCost = 0;
  for (let off = 0; off < 100000; off += 1000) {
    const { data } = await supabase
      .from("order_items")
      .select("line_total,quantity,removed,order_item_costs(unit_cost),orders!inner(created_at,status)")
      .eq("removed", false)
      .neq("orders.status", "iptal")
      .gte("orders.created_at", businessDateStart(cFrom, openTime))
      .lt("orders.created_at", businessDateStart(addDays(cTo, 1), openTime))
      .range(off, off + 999);
    if (!data?.length) break;
    for (const i of data as unknown as { line_total: number; quantity: number; order_item_costs: { unit_cost: number } | { unit_cost: number }[] | null }[]) {
      const lt = Number(i.line_total);
      itemRevenue += lt;
      const c = Array.isArray(i.order_item_costs) ? i.order_item_costs[0] : i.order_item_costs;
      if (c) {
        costedRevenue += lt;
        costedCost += Number(c.unit_cost) * i.quantity;
      }
    }
    if (data.length < 1000) break;
  }
  const grossProfit = costedRevenue - costedCost;
  const coverage = itemRevenue > 0 ? Math.round((costedRevenue / itemRevenue) * 100) : 0;
  const days: { d: string; a: Agg }[] = [];
  for (let d = cTo; d >= cFrom; d = addDays(d, -1)) days.push({ d, a: byDay.get(d) ?? empty() });
  const maxRev = Math.max(1, ...days.map((x) => x.a.revenue));

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-extrabold">Ciro</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={`/admin?${c.q}#rapor`} className="rounded-2xl bg-white p-3.5 ring-1 ring-line hover:ring-brand">
            <p className="text-sm font-bold">{c.label}</p>
            <p className="text-xs text-muted">{c.sub}</p>
            <p className="mt-1.5 text-xl font-black tabular-nums">{formatTL(c.a.revenue)}</p>
            <p className="text-xs text-muted">{c.a.orders} sipariş</p>
          </Link>
        ))}
      </div>

      <div id="rapor" className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <form className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="block text-xs font-bold">Başlangıç</span>
            <input type="date" name="bas" defaultValue={cFrom} max={r.today} className="input py-2" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-bold">Bitiş</span>
            <input type="date" name="bit" defaultValue={cTo} max={r.today} className="input py-2" />
          </label>
          <button className="btn-primary py-2.5">Göster</button>
        </form>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Ciro", formatTL(total.revenue)],
            ["Sipariş", String(total.orders)],
            ["Ortalama sepet", formatTL(total.orders ? total.revenue / total.orders : 0)],
            ["İptal", String(total.cancelled)],
            ["Brüt kâr", costedRevenue > 0 ? formatTL(grossProfit) : "—"],
            ["Kâr marjı", costedRevenue > 0 ? pctTR(Math.round((grossProfit / costedRevenue) * 1000) / 10) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-bg p-3">
              <p className="text-xs font-semibold text-muted">{k}</p>
              <p className="text-lg font-black tabular-nums">{v}</p>
            </div>
          ))}
        </div>

        <ul className="divide-y divide-line">
          {days.map(({ d, a }) => (
            <li key={d} className="py-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{fmtDay(d)}</span>
                <span className="flex items-baseline gap-3">
                  <span className="text-xs text-muted tabular-nums">
                    {a.orders} sipariş{a.cancelled ? ` · ${a.cancelled} iptal` : ""}
                  </span>
                  <span className="w-24 text-right font-bold tabular-nums">{formatTL(a.revenue)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(a.revenue / maxRev) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          İş günü {openTime}&apos;da başlar, kapanışa (ertesi gün) kadar sürer. Ciroya teslimat ücreti dahildir, iptal edilen siparişler dahil değildir.
          Brüt kâr = ürün satışları − sipariş anındaki alış fiyatı (teslimat ücreti hariç)
          {itemRevenue > 0 && coverage < 100 ? `; satışların yalnızca %${coverage}'inin alış fiyatı kayıtlı, kâr bu kısımdan hesaplandı` : ""}.
        </p>
      </div>
    </section>
  );
}
