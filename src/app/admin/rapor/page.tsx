import Link from "next/link";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/data/auth";
import { fetchAll } from "@/lib/data/fetchAll";
import { addDays, businessDateOf, businessDateStart, isYmd, reportRanges } from "@/lib/hours";
import { PAYMENT_LABEL, formatTL } from "@/lib/format";
import { pctTR } from "@/lib/margin";
import { PAY_LABEL } from "@/components/admin/pos/posTypes";

export const metadata = { title: "Kâr raporu" };

// Online siparişler ve mağaza (kasa) satışları AYRI hesaplanır; rapor iki kanalı hiçbir yerde toplamaz.
type Kanal = "online" | "magaza";
type Day = { revenue: number; profit: number; count: number };
type Top = { name: string; qty: number; revenue: number; profit: number | null };
type Report = {
  pl: { k: string; v: number; sign?: "+" | "−" | "="; strong?: boolean }[];
  count: number;
  countLabel: string;
  revenue: number;
  profit: number;
  cancelled: { n: number; amount: number };
  coverage: number; // satışların alış fiyatı kayıtlı yüzdesi
  payments: { k: string; n: number; amount: number }[];
  byDay: Map<string, Day>;
  top: Top[];
};

const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", weekday: "short" }) =>
  new Intl.DateTimeFormat("tr-TR", { ...opts, timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x);

function addTop(m: Map<string, Top>, name: string, qty: number, lt: number, cost: number | null) {
  const t = m.get(name) ?? { name, qty: 0, revenue: 0, profit: 0 };
  t.qty += qty;
  t.revenue += lt;
  t.profit = cost == null || t.profit == null ? null : t.profit + lt - cost * qty;
  m.set(name, t);
}
const bump = (m: Map<string, Day>, d: string, rev: number, prof: number, cnt: number) => {
  const x = m.get(d) ?? { revenue: 0, profit: 0, count: 0 };
  x.revenue += rev;
  x.profit += prof;
  x.count += cnt;
  m.set(d, x);
};

async function onlineReport(sb: SupabaseClient, start: string, end: string, openT: string): Promise<Report> {
  type O = { id: string; created_at: string; subtotal: number; delivery_fee: number; total: number; status: string; payment_method: keyof typeof PAYMENT_LABEL };
  type I = { order_id: string; product_name: string; line_total: number; quantity: number; order_item_costs: { unit_cost: number } | { unit_cost: number }[] | null };
  const [{ data: orders }, { data: items }] = await Promise.all([
    fetchAll<O>((f, t) => sb.from("orders").select("id,created_at,subtotal,delivery_fee,total,status,payment_method").gte("created_at", start).lt("created_at", end).order("created_at").order("id").range(f, t)),
    fetchAll<I>((f, t) =>
      sb
        .from("order_items")
        .select("order_id,product_name,line_total,quantity,order_item_costs(unit_cost),orders!inner(created_at,status)")
        .eq("removed", false)
        .neq("orders.status", "iptal")
        .gte("orders.created_at", start)
        .lt("orders.created_at", end)
        .order("id")
        .range(f, t),
    ),
  ]);
  const live = orders.filter((o) => o.status !== "iptal");
  const dayOf = new Map(live.map((o) => [o.id, businessDateOf(Date.parse(o.created_at), openT)]));
  const byDay = new Map<string, Day>();
  const top = new Map<string, Top>();
  let sales = 0;
  let costed = 0;
  let cost = 0;
  for (const i of items) {
    const lt = Number(i.line_total);
    const c = one(i.order_item_costs);
    const uc = c ? Number(c.unit_cost) : null;
    sales += lt;
    if (uc != null) {
      costed += lt;
      cost += uc * i.quantity;
    }
    const d = dayOf.get(i.order_id);
    if (d) bump(byDay, d, 0, uc != null ? lt - uc * i.quantity : 0, 0);
    addTop(top, i.product_name, i.quantity, lt, uc);
  }
  const fee = live.reduce((a, o) => a + Number(o.delivery_fee), 0);
  const revenue = live.reduce((a, o) => a + Number(o.total), 0);
  for (const o of live) bump(byDay, dayOf.get(o.id)!, Number(o.total), Number(o.delivery_fee), 1);
  const itemProfit = costed - cost;
  const pay = new Map<string, { n: number; amount: number }>();
  for (const o of live) {
    const p = pay.get(o.payment_method) ?? { n: 0, amount: 0 };
    p.n++;
    p.amount += Number(o.total);
    pay.set(o.payment_method, p);
  }
  const cancelled = orders.filter((o) => o.status === "iptal");
  return {
    pl: [
      { k: "Ürün satışı", v: sales },
      { k: "Ürün maliyeti (alış)", v: cost, sign: "−" },
      { k: "Ürün kârı", v: itemProfit, sign: "=" },
      { k: "Teslimat geliri", v: fee, sign: "+" },
      { k: "Brüt kâr", v: itemProfit + fee, sign: "=", strong: true },
    ],
    count: live.length,
    countLabel: "Sipariş",
    revenue,
    profit: itemProfit + fee,
    cancelled: { n: cancelled.length, amount: cancelled.reduce((a, o) => a + Number(o.total), 0) },
    coverage: sales > 0 ? Math.round((costed / sales) * 100) : 100,
    payments: [...pay].map(([k, v]) => ({ k: PAYMENT_LABEL[k as keyof typeof PAYMENT_LABEL] ?? k, ...v })),
    byDay,
    top: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15),
  };
}

async function storeReport(sb: SupabaseClient, start: string, end: string, openT: string): Promise<Report> {
  type S = {
    id: string;
    created_at: string;
    subtotal: number;
    discount: number;
    total: number;
    payment: keyof typeof PAY_LABEL;
    cash_amount: number;
    card_amount: number;
    change_due: number;
    voided_at: string | null;
    pos_sale_items: { product_name: string; quantity: number; line_total: number; cost_price: number | null }[];
  };
  const { data: sales } = await fetchAll<S>((f, t) =>
    sb
      .from("pos_sales")
      .select("id,created_at,subtotal,discount,total,payment,cash_amount,card_amount,change_due,voided_at,pos_sale_items(product_name,quantity,line_total,cost_price)")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at")
      .order("id")
      .range(f, t),
  );
  const live = sales.filter((s) => !s.voided_at);
  const byDay = new Map<string, Day>();
  const top = new Map<string, Top>();
  let gross = 0;
  let discount = 0;
  let costed = 0;
  let cost = 0;
  let cash = 0;
  let card = 0;
  for (const s of live) {
    const d = businessDateOf(Date.parse(s.created_at), openT);
    let p = -Number(s.discount);
    for (const i of s.pos_sale_items) {
      const lt = Number(i.line_total);
      const q = Number(i.quantity);
      const uc = i.cost_price == null ? null : Number(i.cost_price);
      if (uc != null) {
        costed += lt;
        cost += uc * q;
        p += lt - uc * q;
      }
      addTop(top, i.product_name, q, lt, uc);
    }
    gross += Number(s.subtotal);
    discount += Number(s.discount);
    cash += Number(s.cash_amount) - Number(s.change_due);
    card += Number(s.card_amount);
    bump(byDay, d, Number(s.total), p, 1);
  }
  const net = gross - discount;
  const profit = costed - cost - discount;
  const voided = sales.filter((s) => s.voided_at);
  return {
    pl: [
      { k: "Ürün satışı", v: gross },
      { k: "Fiş indirimleri", v: discount, sign: "−" },
      { k: "Net satış", v: net, sign: "=" },
      { k: "Ürün maliyeti (alış)", v: cost, sign: "−" },
      { k: "Brüt kâr", v: profit, sign: "=", strong: true },
    ],
    count: live.length,
    countLabel: "Fiş",
    revenue: net,
    profit,
    cancelled: { n: voided.length, amount: voided.reduce((a, s) => a + Number(s.total), 0) },
    coverage: gross > 0 ? Math.round((costed / gross) * 100) : 100,
    payments: [
      { k: "Nakit (kasaya giren)", n: live.filter((s) => s.payment !== "kart").length, amount: cash },
      { k: "Kart", n: live.filter((s) => s.payment !== "nakit").length, amount: card },
    ].filter((x) => x.n > 0),
    byDay,
    top: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15),
  };
}

type SP = { kanal?: string; bas?: string; bit?: string };

export default async function ReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  await connection();
  const { supabase } = await requireAdmin();
  const { data: hours } = await supabase.from("store_settings").select("open_time").eq("id", 1).single();
  const openT = hours?.open_time ?? "10:00";

  const kanal: Kanal = sp.kanal === "magaza" ? "magaza" : "online";
  const r = reportRanges(openT);
  let from = isYmd(sp.bas) ? sp.bas : r.monthStart;
  let to = isYmd(sp.bit) ? sp.bit : r.today;
  if (from > to) [from, to] = [to, from];
  if (Date.parse(to) - Date.parse(from) > 366 * 86400_000) from = addDays(to, -366);
  const start = businessDateStart(from, openT);
  const end = businessDateStart(addDays(to, 1), openT);

  const rep = kanal === "online" ? await onlineReport(supabase, start, end, openT) : await storeReport(supabase, start, end, openT);
  const margin = rep.revenue > 0 ? pctTR(Math.round((rep.profit / rep.revenue) * 1000) / 10) : "—";

  const q = (o: Partial<SP>) => {
    const p = new URLSearchParams({ kanal, bas: from, bit: to, ...o } as Record<string, string>);
    return `/admin/rapor?${p}`;
  };
  const presets = [
    { k: "Bugün", a: r.today, b: r.today },
    { k: "Dün", a: r.yesterday, b: r.yesterday },
    { k: "Bu hafta", a: r.weekStart, b: r.today },
    { k: "Bu ay", a: r.monthStart, b: r.today },
    { k: "Geçen ay", a: r.prevMonthStart, b: r.prevMonthEnd },
  ];
  const days: { d: string; x: Day }[] = [];
  for (let d = to; d >= from; d = addDays(d, -1)) days.push({ d, x: rep.byDay.get(d) ?? { revenue: 0, profit: 0, count: 0 } });
  const maxRev = Math.max(1, ...days.map((x) => x.x.revenue));
  const accent = kanal === "online" ? "bg-sky-600" : "bg-emerald-600";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-black">Kâr raporu</h1>
        <p className="text-sm text-muted">
          {fmtDay(from, { day: "numeric", month: "long", year: "numeric" })} – {fmtDay(to, { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Kanal seçimi — iki kanal ayrı raporlanır */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 ring-1 ring-line sm:inline-grid">
        {(
          [
            ["online", "🛵 Online siparişler"],
            ["magaza", "🏪 Mağaza (kasa) satışları"],
          ] as const
        ).map(([k, label]) => (
          <Link key={k} href={q({ kanal: k })} className={`rounded-xl px-4 py-2.5 text-center text-sm font-bold ${kanal === k ? (k === "online" ? "bg-sky-600 text-white" : "bg-emerald-600 text-white") : "hover:bg-bg"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-line">
        {presets.map((p) => (
          <Link key={p.k} href={q({ bas: p.a, bit: p.b })} className={`rounded-lg px-3 py-2 text-sm font-semibold ${from === p.a && to === p.b ? "bg-brand-soft text-brand" : "bg-bg hover:ring-1 hover:ring-brand"}`}>
            {p.k}
          </Link>
        ))}
        <form className="ml-auto flex flex-wrap items-end gap-2">
          <input type="hidden" name="kanal" value={kanal} />
          <label className="space-y-1">
            <span className="block text-xs font-bold">Başlangıç</span>
            <input type="date" name="bas" defaultValue={from} max={r.today} className="input py-2" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-bold">Bitiş</span>
            <input type="date" name="bit" defaultValue={to} max={r.today} className="input py-2" />
          </label>
          <button className="btn-primary py-2.5">Göster</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {[
          [kanal === "online" ? "Ciro (teslimat dahil)" : "Ciro (net)", formatTL(rep.revenue)],
          ["Brüt kâr", formatTL(rep.profit)],
          ["Kâr marjı", margin],
          [rep.countLabel, String(rep.count)],
          [kanal === "online" ? "Ortalama sepet" : "Ortalama fiş", formatTL(rep.count ? rep.revenue / rep.count : 0)],
          [kanal === "online" ? "İptal" : "İptal fiş", rep.cancelled.n ? `${rep.cancelled.n} · ${formatTL(rep.cancelled.amount)}` : "0"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
            <p className="text-xs font-semibold text-muted">{k}</p>
            <p className="mt-1 text-xl font-black tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {rep.coverage < 100 && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
          ⚠️ Satışların yalnızca <b>%{rep.coverage}</b>&apos;inde alış fiyatı kayıtlı. Alış fiyatı olmayan ürünler kâra katılmadı; gerçek kâr daha yüksektir.{" "}
          <Link href="/admin/urunler" className="font-bold text-brand underline">
            Alış fiyatı gir
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="mb-3 font-extrabold">Kâr hesabı</h2>
          <dl className="divide-y divide-line text-sm">
            {rep.pl.map((l) => (
              <div key={l.k} className={`flex justify-between py-2 ${l.strong ? "text-base font-black" : l.sign === "=" ? "font-bold" : ""}`}>
                <dt>
                  <span className="inline-block w-5 text-muted">{l.sign ?? ""}</span>
                  {l.k}
                </dt>
                <dd className={`tabular-nums ${l.sign === "−" ? "text-brand" : ""}`}>{l.sign === "−" ? "−" : ""}{formatTL(l.v)}</dd>
              </div>
            ))}
          </dl>
          {rep.payments.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-sm font-extrabold">Ödeme dağılımı</h3>
              <ul className="space-y-1 text-sm">
                {rep.payments.map((p) => (
                  <li key={p.k} className="flex justify-between">
                    <span>
                      {p.k} <span className="text-muted">· {p.n}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatTL(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-xs text-muted">
            {kanal === "online"
              ? "İptal edilen siparişler ve stokta olmadığı için çıkarılan ürünler dahil değil. Maliyet, sipariş anındaki alış fiyatıdır."
              : "İptal edilen fişler dahil değil. Maliyet, satış anındaki alış fiyatıdır."}{" "}
            İş günü {openT}&apos;da başlar.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="mb-3 font-extrabold">En çok satanlar</h2>
          {rep.top.length === 0 ? (
            <p className="text-sm text-muted">Bu aralıkta satış yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1 font-semibold">Ürün</th>
                  <th className="py-1 text-right font-semibold">Adet</th>
                  <th className="py-1 text-right font-semibold">Satış</th>
                  <th className="py-1 text-right font-semibold">Kâr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rep.top.map((t) => (
                  <tr key={t.name}>
                    <td className="py-1.5 pr-2">{t.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{String(Math.round(t.qty * 1000) / 1000).replace(".", ",")}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{formatTL(t.revenue)}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.profit == null ? <span className="text-muted">—</span> : formatTL(t.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 font-extrabold">Günlük</h2>
        <ul className="divide-y divide-line">
          {days.map(({ d, x }) => (
            <li key={d} className="py-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{fmtDay(d)}</span>
                <span className="flex items-baseline gap-3">
                  <span className="text-xs text-muted tabular-nums">
                    {x.count} {rep.countLabel.toLocaleLowerCase("tr-TR")}
                  </span>
                  <span className="w-24 text-right text-xs tabular-nums text-muted">kâr {formatTL(x.profit)}</span>
                  <span className="w-24 text-right font-bold tabular-nums">{formatTL(x.revenue)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
                <div className={`h-full rounded-full ${accent}`} style={{ width: `${(x.revenue / maxRev) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
