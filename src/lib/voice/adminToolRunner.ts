"use client";
// Yönetim paneli sesli asistanının araçları — tarayıcıda, admin oturumuyla (RLS) salt okunur sorgular.
import { createClient } from "@/lib/supabase/client";
import { fetchDiscounts } from "./discounts";
import { calcMargin } from "@/lib/margin";
import { addDays, businessDateOf, businessDateStart, hoursState, isYmd, reportRanges } from "@/lib/hours";

type Sb = ReturnType<typeof createClient>;
type Settings = {
  open_time: string;
  close_time: string;
  is_open: boolean;
  force_open?: boolean;
  delivery_fee: number;
  free_delivery_threshold: number;
  min_order_amount: number;
  sla_accept_min: number;
  sla_prepare_min: number;
  sla_delivery_min: number;
};

const DAY = 86400_000;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const minDate = (a: string, b: string) => (a < b ? a : b);
const r2 = (n: number) => Math.round(n * 100) / 100;

type Range = { from: string; to: string; label: string };
type Periods = { cur: Range; prev: Range; prevToDate?: Range };

export function periodRanges(period: string, openTime: string, start?: string, end?: string): Periods | { error: string } {
  const r = reportRanges(openTime);
  const t = r.today;
  const mk = (from: string, to: string, label: string): Range => ({ from, to, label });
  switch (period) {
    case "bugun":
      return { cur: mk(t, t, "bugün"), prev: mk(r.yesterday, r.yesterday, "dün") };
    case "dun":
      return { cur: mk(r.yesterday, r.yesterday, "dün"), prev: mk(addDays(t, -2), addDays(t, -2), "önceki gün") };
    case "bu_hafta": {
      const pws = addDays(r.weekStart, -7);
      return {
        cur: mk(r.weekStart, t, "bu hafta"),
        prev: mk(pws, addDays(r.weekStart, -1), "geçen haftanın tamamı"),
        prevToDate: mk(pws, addDays(t, -7), "geçen haftanın aynı günleri"),
      };
    }
    case "gecen_hafta": {
      const pws = addDays(r.weekStart, -7);
      return { cur: mk(pws, addDays(r.weekStart, -1), "geçen hafta"), prev: mk(addDays(pws, -7), addDays(pws, -1), "iki hafta önce") };
    }
    case "bu_ay": {
      const elapsed = dayDiff(r.monthStart, t);
      return {
        cur: mk(r.monthStart, t, "bu ay"),
        prev: mk(r.prevMonthStart, r.prevMonthEnd, "geçen ayın tamamı"),
        prevToDate: mk(r.prevMonthStart, minDate(addDays(r.prevMonthStart, elapsed), r.prevMonthEnd), "geçen ayın aynı günleri"),
      };
    }
    case "gecen_ay": {
      const [y, m] = r.prevMonthStart.split("-").map(Number);
      const ppStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
      return { cur: mk(r.prevMonthStart, r.prevMonthEnd, "geçen ay"), prev: mk(ppStart, addDays(r.prevMonthStart, -1), "iki ay önce") };
    }
    case "son_7_gun":
      return { cur: mk(addDays(t, -6), t, "son 7 gün"), prev: mk(addDays(t, -13), addDays(t, -7), "önceki 7 gün") };
    case "son_30_gun":
      return { cur: mk(addDays(t, -29), t, "son 30 gün"), prev: mk(addDays(t, -59), addDays(t, -30), "önceki 30 gün") };
    case "ozel": {
      if (!isYmd(start) || !isYmd(end) || start > end) return { error: "Özel dönem için geçerli start ve end (YYYY-AA-GG) ver." };
      const len = dayDiff(start, end) + 1;
      return { cur: mk(start, end, `${start} – ${end}`), prev: mk(addDays(start, -len), addDays(start, -1), "önceki eşit dönem") };
    }
  }
  return { error: "Bilinmeyen dönem." };
}

type OrderRow = { created_at: string; total: number; status: string; phone: string; customer_name: string };

async function ordersIn(sb: Sb, rg: Range, openTime: string, cols = "created_at,total,status") {
  const { data, error } = await sb
    .from("orders")
    .select(cols)
    .gte("created_at", businessDateStart(rg.from, openTime))
    .lt("created_at", businessDateStart(addDays(rg.to, 1), openTime))
    .limit(20000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrderRow[];
}

function summarize(rows: OrderRow[], rg: Range) {
  const ok = rows.filter((o) => o.status !== "iptal");
  const revenue = ok.reduce((a, o) => a + Number(o.total), 0);
  return {
    period: rg.label,
    dates: rg.from === rg.to ? rg.from : `${rg.from} → ${rg.to}`,
    revenue_tl: r2(revenue),
    orders: ok.length,
    avg_basket_tl: ok.length ? r2(revenue / ok.length) : 0,
    cancelled: rows.length - ok.length,
    delivered: rows.filter((o) => o.status === "teslim_edildi").length,
  };
}

/** Brüt kâr: ürün satışları − sipariş anındaki alış fiyatı (teslimat hariç) */
async function grossProfit(sb: Sb, rg: Range, openTime: string) {
  const { data, error } = await sb
    .from("order_items")
    .select("line_total,quantity,order_item_costs(unit_cost),orders!inner(created_at,status)")
    .eq("removed", false)
    .neq("orders.status", "iptal")
    .gte("orders.created_at", businessDateStart(rg.from, openTime))
    .lt("orders.created_at", businessDateStart(addDays(rg.to, 1), openTime))
    .limit(50000);
  if (error) return { error: error.message };
  let itemRev = 0;
  let costedRev = 0;
  let cost = 0;
  for (const i of (data ?? []) as unknown as { line_total: number; quantity: number; order_item_costs: { unit_cost: number } | { unit_cost: number }[] | null }[]) {
    itemRev += Number(i.line_total);
    const c = Array.isArray(i.order_item_costs) ? i.order_item_costs[0] : i.order_item_costs;
    if (c) {
      costedRev += Number(i.line_total);
      cost += Number(c.unit_cost) * i.quantity;
    }
  }
  if (!costedRev) return { note: "Bu dönemde alış fiyatı kayıtlı satış yok; kâr hesaplanamıyor." };
  return {
    profit_tl: r2(costedRev - cost),
    margin_pct: r2(((costedRev - cost) / costedRev) * 100),
    coverage_pct: Math.round((costedRev / itemRev) * 100),
    note: "Ürün satışlarından alış maliyeti düşülmüş brüt kâr; teslimat ücreti hariç. coverage_pct < 100 ise yalnızca alış fiyatı girilmiş ürünler hesaba katıldı.",
  };
}

const pct = (cur: number, prev: number) => (prev > 0 ? r2(((cur - prev) / prev) * 100) : null);

const PAGES: Record<string, string> = {
  genel_bakis: "/admin",
  siparisler: "/admin/siparisler",
  urunler: "/admin/urunler",
  kritik_stok: "/admin/urunler?stok=kritik",
  barkod: "/admin/barkod",
  kategoriler: "/admin/kategoriler",
  musteriler: "/admin/musteriler",
  bolgeler: "/admin/bolgeler",
  ayarlar: "/admin/ayarlar",
};

type CostJoin = { cost_price: number } | { cost_price: number }[] | null;
function costOfJoin(j: CostJoin | undefined) {
  const c = Array.isArray(j) ? j[0] : j;
  return c ? Number(c.cost_price) : null;
}
function costInfo(p: { price: number; sale_price: number | null; product_costs?: CostJoin }) {
  const cost = costOfJoin(p.product_costs);
  if (cost == null) return { cost_price: null as number | null, note_cost: "alış fiyatı girilmemiş" };
  const m = calcMargin(Number(p.sale_price ?? p.price), cost);
  return { cost_price: cost, unit_profit_tl: m?.profit, margin_pct: m?.marginPct, markup_pct: m?.markupPct };
}

export function createAdminToolRunner(deps: { navigate: (path: string) => void; log: (text: string) => void }) {
  let settings: Settings | null = null;
  const sb = createClient();
  const getSettings = async () => {
    if (settings) return settings;
    const { data } = await sb
      .from("store_settings")
      .select("open_time,close_time,is_open,force_open,delivery_fee,free_delivery_threshold,min_order_amount,sla_accept_min,sla_prepare_min,sla_delivery_min")
      .eq("id", 1)
      .single();
    settings = (data ?? {
      open_time: "10:00",
      close_time: "01:00",
      is_open: true,
      delivery_fee: 0,
      free_delivery_threshold: 0,
      min_order_amount: 0,
      sla_accept_min: 3,
      sla_prepare_min: 7,
      sla_delivery_min: 20,
    }) as Settings;
    settings.open_time = settings.open_time.slice(0, 5);
    settings.close_time = settings.close_time.slice(0, 5);
    return settings;
  };

  return async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const s = await getSettings();
    const period = String(args.period ?? "");
    const start = args.start ? String(args.start) : undefined;
    const end = args.end ? String(args.end) : undefined;

    if (name === "get_sales_report") {
      const p = periodRanges(period, s.open_time, start, end);
      if ("error" in p) return p;
      const [cur, prev, prevTd] = await Promise.all([
        ordersIn(sb, p.cur, s.open_time),
        ordersIn(sb, p.prev, s.open_time),
        p.prevToDate ? ordersIn(sb, p.prevToDate, s.open_time) : Promise.resolve(null),
      ]);
      const c = summarize(cur, p.cur);
      const pv = summarize(prev, p.prev);
      const td = prevTd && p.prevToDate ? summarize(prevTd, p.prevToDate) : null;
      // Günlük kırılım (en yoğun gün yorumu için)
      const byDay = new Map<string, number>();
      for (const o of cur) {
        if (o.status === "iptal") continue;
        const d = businessDateOf(new Date(o.created_at).getTime(), s.open_time);
        byDay.set(d, (byDay.get(d) ?? 0) + Number(o.total));
      }
      const best = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        current: c,
        compare_previous: { ...pv, revenue_change_pct: pct(c.revenue_tl, pv.revenue_tl), orders_change_pct: pct(c.orders, pv.orders) },
        compare_to_date: td ? { ...td, revenue_change_pct: pct(c.revenue_tl, td.revenue_tl), orders_change_pct: pct(c.orders, td.orders) } : undefined,
        best_day: best && byDay.size > 1 ? { date: best[0], revenue_tl: r2(best[1]) } : undefined,
        gross_profit: await grossProfit(sb, p.cur, s.open_time),
        note: "Ciro = iptal edilmeyen siparişlerin toplamı (teslimat ücreti dahil). Gün = iş günü (açılıştan ertesi kapanışa).",
      };
    }

    if (name === "get_top_products") {
      const p = periodRanges(period, s.open_time, start, end);
      if ("error" in p) return p;
      const limit = Math.max(1, Math.min(15, Math.trunc(Number(args.limit) || 5)));
      const { data, error } = await sb
        .from("order_items")
        .select("product_name,quantity,line_total,removed,orders!inner(created_at,status)")
        .gte("orders.created_at", businessDateStart(p.cur.from, s.open_time))
        .lt("orders.created_at", businessDateStart(addDays(p.cur.to, 1), s.open_time))
        .neq("orders.status", "iptal")
        .eq("removed", false)
        .limit(20000);
      if (error) return { error: error.message };
      const m = new Map<string, { name: string; qty: number; revenue: number }>();
      for (const i of data ?? []) {
        const x = m.get(i.product_name) ?? { name: i.product_name, qty: 0, revenue: 0 };
        x.qty += i.quantity;
        x.revenue += Number(i.line_total);
        m.set(i.product_name, x);
      }
      const list = [...m.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, limit);
      return { period: p.cur.label, top_by_quantity: list.map((x) => ({ ...x, revenue: r2(x.revenue) })) };
    }

    if (name === "get_stock_status") {
      const { data, error } = await sb.from("products").select("name,stock,critical_stock,unit_label").eq("is_active", true).order("stock").limit(5000);
      if (error) return { error: error.message };
      const rows = data ?? [];
      const out = rows.filter((p) => p.stock <= 0);
      const crit = rows.filter((p) => p.stock > 0 && p.stock <= p.critical_stock);
      return {
        active_products: rows.length,
        out_of_stock_count: out.length,
        out_of_stock: out.slice(0, 15).map((p) => p.name),
        critical_count: crit.length,
        critical: crit.slice(0, 15).map((p) => ({ name: p.name, stock: p.stock, critical_level: p.critical_stock })),
      };
    }

    if (name === "search_products") {
      const q = String(args.query ?? "").trim().slice(0, 60);
      if (q.length < 2) return { error: "Ürün adı çok kısa." };
      const { data, error } = await sb
        .from("products")
        .select("id,name,unit_label,price,sale_price,stock,critical_stock,is_active,barcode,product_costs(cost_price)")
        .ilike("name", `%${q.replace(/[%_\\]/g, "")}%`)
        .order("name")
        .limit(10);
      if (error) return { error: error.message };
      if (!data?.length) return { results: [], note: "Bu adla ürün yok." };
      return {
        results: data.map((p) => ({
          name: p.name,
          unit: p.unit_label,
          price: Number(p.price),
          sale_price: p.sale_price == null ? null : Number(p.sale_price),
          stock: p.stock,
          critical: p.stock <= p.critical_stock,
          on_sale: p.is_active,
          ...costInfo(p),
        })),
      };
    }

    if (name === "get_open_orders") {
      const { data, error } = await sb
        .from("orders")
        .select("order_no,status,created_at,preparing_at,dispatched_at,customer_name,total")
        .in("status", ["alindi", "hazirlaniyor", "yolda"])
        .order("created_at")
        .limit(200);
      if (error) return { error: error.message };
      const now = Date.now();
      const age = (iso: string | null) => (iso ? Math.round((now - new Date(iso).getTime()) / 60000) : 0);
      const rows = (data ?? []).map((o) => {
        const stageStart = o.status === "alindi" ? o.created_at : o.status === "hazirlaniyor" ? o.preparing_at ?? o.created_at : o.dispatched_at ?? o.created_at;
        const target = o.status === "alindi" ? s.sla_accept_min : o.status === "hazirlaniyor" ? s.sla_prepare_min : s.sla_delivery_min;
        const mins = age(stageStart);
        return { order_no: o.order_no, status: o.status, minutes_in_stage: mins, late: mins > target, customer: o.customer_name, total: Number(o.total) };
      });
      return {
        open_count: rows.length,
        by_status: {
          alindi: rows.filter((r) => r.status === "alindi").length,
          hazirlaniyor: rows.filter((r) => r.status === "hazirlaniyor").length,
          yolda: rows.filter((r) => r.status === "yolda").length,
        },
        late_count: rows.filter((r) => r.late).length,
        orders: rows.slice(0, 10),
      };
    }

    if (name === "get_customer_stats") {
      const p = periodRanges(period, s.open_time, start, end);
      if ("error" in p) return p;
      const rows = (await ordersIn(sb, p.cur, s.open_time, "created_at,total,status,phone,customer_name")).filter((o) => o.status !== "iptal");
      const by = new Map<string, { name: string; orders: number; spent: number }>();
      for (const o of rows) {
        const x = by.get(o.phone) ?? { name: o.customer_name, orders: 0, spent: 0 };
        x.orders++;
        x.spent += Number(o.total);
        by.set(o.phone, x);
      }
      // Yeni müşteri: dönemden önce hiç siparişi olmayan telefon
      const phones = [...by.keys()];
      let newCount = 0;
      if (phones.length) {
        const { data: older } = await sb
          .from("orders")
          .select("phone")
          .in("phone", phones.slice(0, 500))
          .lt("created_at", businessDateStart(p.cur.from, s.open_time))
          .limit(5000);
        const old = new Set((older ?? []).map((o) => o.phone));
        newCount = phones.filter((ph) => !old.has(ph)).length;
      }
      const top = [...by.values()].sort((a, b) => b.spent - a.spent).slice(0, 5).map((x) => ({ ...x, spent: r2(x.spent) }));
      return { period: p.cur.label, customers: by.size, new_customers: newCount, returning_customers: by.size - newCount, top_customers: top };
    }

    if (name === "get_store_status") {
      const h = hoursState(Date.now(), s.open_time, s.close_time, s.is_open, s.force_open);
      return {
        open_now: h.open,
        manually_closed: !s.is_open,
        hours: `${s.open_time} - ${s.close_time}`,
        delivery_fee: Number(s.delivery_fee),
        free_delivery_over: Number(s.free_delivery_threshold),
        min_order: Number(s.min_order_amount),
      };
    }

    if (name === "get_margin_report") {
      const { data, error } = await sb
        .from("products")
        .select("name,price,sale_price,is_active,product_costs(cost_price)")
        .eq("is_active", true)
        .limit(5000);
      if (error) return { error: error.message };
      const rows = (data ?? []).map((p) => ({ name: p.name, ...costInfo(p as never) }));
      const withCost = rows.filter((r) => r.cost_price != null) as { name: string; margin_pct: number; unit_profit_tl: number; cost_price: number }[];
      const sorted = [...withCost].sort((a, b) => a.margin_pct - b.margin_pct);
      const q = args.query ? String(args.query).toLocaleLowerCase("tr") : "";
      return {
        active_products: rows.length,
        with_cost: withCost.length,
        missing_cost: rows.length - withCost.length,
        avg_margin_pct: withCost.length ? r2(withCost.reduce((a, r) => a + r.margin_pct, 0) / withCost.length) : null,
        loss_making: sorted.filter((r) => r.unit_profit_tl < 0).slice(0, 10),
        lowest_margin: sorted.slice(0, 5),
        highest_margin: sorted.slice(-5).reverse(),
        matches: q ? withCost.filter((r) => r.name.toLocaleLowerCase("tr").includes(q)).slice(0, 10) : undefined,
      };
    }

    if (name === "get_discounted_products") {
      return fetchDiscounts(sb, { includeInactive: args.include_inactive === true, query: args.query ? String(args.query) : undefined, limit: 30 });
    }

    if (name === "go_to_page") {
      const path = PAGES[String(args.page)];
      if (!path) return { error: "Bilinmeyen sayfa." };
      deps.navigate(path);
      deps.log(`➡️ ${String(args.page).replace("_", " ")} açıldı`);
      return { ok: true };
    }

    return { error: "Bilinmeyen araç." };
  };
}
