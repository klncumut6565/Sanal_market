"use client";
// Yönetim paneli sesli asistanının araçları — tarayıcıda, admin oturumuyla (RLS) salt okunur sorgular.
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/data/fetchAll";
import { fetchDiscounts } from "./discounts";
import { calcMargin } from "@/lib/margin";
import { addDays, businessDateOf, businessDateStart, hoursState, isYmd, reportRanges } from "@/lib/hours";
import { shortDay, tlv, type AdminVisual, type ProductChange } from "./adminVisual";
import { fold } from "@/lib/trFold";
import { formatTL } from "@/lib/format";
import { applyProductChange } from "@/app/admin/voiceActions";

const EVET = /(^|\s)(evet|onayl|onay|tamam|olur|uygula|yap|kaydet|doğru|aynen|tabi|tabii)/;
const HAYIR = /(hayır|hayir|vazgeç|vazgec|iptal|yapma|dur |bekle|olmaz|yanlış)/;
const CHANGE_TTL = 3 * 60_000;
const ynTL = (n: number | null) => (n == null ? "yok" : formatTL(n));
const numArg = (v: unknown) => {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

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
  satis: "/admin/satis",
  siparisler: "/admin/siparisler",
  rapor: "/admin/rapor",
  kuryeler: "/admin/kuryeler",
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

export function createAdminToolRunner(deps: {
  navigate: (path: string) => void;
  log: (text: string) => void;
  show?: (v: AdminVisual[]) => void;
  /** Onay bekleyen değişikliği panelde gösterir (null = kaldır) */
  setChange?: (c: ProductChange | null) => void;
  /** Kullanıcının en son söylediği cümle (sesli onay kontrolü için) */
  lastUserText?: () => string;
}) {
  const show = deps.show ?? (() => {});
  let pending: ProductChange | null = null;
  const publish = (c: ProductChange | null) => {
    pending = c;
    deps.setChange?.(c ? { ...c } : null);
  };

  /** Ekrandaki butondan ya da sesli onaydan sonra çağrılır — gerçek değişikliği yapan tek yer */
  async function confirmPending(id?: string): Promise<{ ok: boolean; message: string }> {
    const c = pending;
    if (!c || (id && c.id !== id) || c.status !== "bekliyor") return { ok: false, message: "Onay bekleyen değişiklik yok." };
    if (Date.now() - c.createdAt > CHANGE_TTL) {
      publish({ ...c, status: "iptal", error: "Süresi doldu" });
      return { ok: false, message: "Önerinin süresi doldu (3 dk). Değişikliği yeniden iste." };
    }
    publish({ ...c, status: "uygulaniyor" });
    const r = await applyProductChange(c.productId, c.expect, c.patch);
    if (!r.ok) {
      publish({ ...c, status: "hata", error: r.error });
      return { ok: false, message: r.error };
    }
    publish({ ...c, status: "uygulandi" });
    deps.log(`✅ ${c.name}: ${c.rows.map((x) => `${x.label} ${x.before} → ${x.after}`).join(", ")}`);
    return { ok: true, message: `${c.name} güncellendi: ${c.rows.map((x) => `${x.label} ${x.after}`).join(", ")}` };
  }
  function cancelPending(id?: string) {
    const c = pending;
    if (!c || (id && c.id !== id) || c.status !== "bekliyor") return false;
    publish({ ...c, status: "iptal" });
    return true;
  }
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

  const run = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
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
      const gp = await grossProfit(sb, p.cur, s.open_time);
      const cmp = td ?? pv;
      const vis: AdminVisual[] = [
        {
          kind: "kpis",
          title: `Online siparişler · ${p.cur.label}`,
          items: [
            { label: "Ciro", value: tlv(c.revenue_tl), delta: pct(c.revenue_tl, cmp.revenue_tl), hint: `${cmp.period}: ${tlv(cmp.revenue_tl)}` },
            { label: "Sipariş", value: String(c.orders), delta: pct(c.orders, cmp.orders) },
            { label: "Ort. sepet", value: tlv(c.avg_basket_tl) },
            { label: "Brüt kâr", value: "profit_tl" in gp && gp.profit_tl != null ? tlv(gp.profit_tl) : "—", hint: "margin_pct" in gp ? `%${gp.margin_pct}` : undefined },
          ],
        },
      ];
      if (p.cur.from !== p.cur.to) {
        const days: { label: string; value: number }[] = [];
        for (let d = p.cur.from; d <= p.cur.to && days.length < 31; d = addDays(d, 1)) days.push({ label: shortDay(d), value: r2(byDay.get(d) ?? 0) });
        vis.push({ kind: "bars", title: "Günlük ciro", unit: "tl", items: days });
      }
      show(vis);
      return {
        current: c,
        compare_previous: { ...pv, revenue_change_pct: pct(c.revenue_tl, pv.revenue_tl), orders_change_pct: pct(c.orders, pv.orders) },
        compare_to_date: td ? { ...td, revenue_change_pct: pct(c.revenue_tl, td.revenue_tl), orders_change_pct: pct(c.orders, td.orders) } : undefined,
        best_day: best && byDay.size > 1 ? { date: best[0], revenue_tl: r2(best[1]) } : undefined,
        gross_profit: gp,
        note: "YALNIZCA ONLINE siparişler (mağaza kasası hariç; onun için get_store_sales_report). Ciro = iptal edilmeyen siparişlerin toplamı (teslimat ücreti dahil). Gün = iş günü (açılıştan ertesi kapanışa).",
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
      show([{ kind: "bars", title: `En çok satanlar (online) · ${p.cur.label}`, unit: "adet", items: list.map((x) => ({ label: x.name, value: x.qty, sub: tlv(x.revenue) })) }]);
      return { period: p.cur.label, top_by_quantity: list.map((x) => ({ ...x, revenue: r2(x.revenue) })) };
    }

    if (name === "get_stock_status") {
      const { data, error } = await fetchAll((f, t) =>
        sb.from("products").select("name,stock,critical_stock,unit_label").eq("is_active", true).order("stock").order("id").range(f, t),
      );
      if (error) return { error: error.message };
      const rows = data ?? [];
      const out = rows.filter((p) => p.stock <= 0);
      const crit = rows.filter((p) => p.stock > 0 && p.stock <= p.critical_stock);
      show([
        {
          kind: "kpis",
          title: "Stok durumu",
          items: [
            { label: "Aktif ürün", value: rows.length.toLocaleString("tr-TR") },
            { label: "Tükenen", value: String(out.length) },
            { label: "Kritik", value: String(crit.length) },
          ],
        },
        ...(out.length + crit.length
          ? [
              {
                kind: "table" as const,
                title: "Tükenen ve kritik ürünler",
                columns: ["Ürün", "Stok"],
                rows: [...out, ...crit].slice(0, 25).map((p) => [p.name, p.stock <= 0 ? "Tükendi" : `${p.stock} / ${p.critical_stock}`]),
                alert: [...out, ...crit].slice(0, 25).map((p) => p.stock <= 0),
              },
            ]
          : []),
      ]);
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
      // Kelime bazlı, Türkçe karakter duyarsız arama (İ/ı, "70'lik", "kaç adet" gibi ekler sorun olmaz)
      const { data, error } = await sb.rpc("admin_search_products", { q, lim: 10 });
      if (error) return { error: error.message };
      const rows = (data ?? []) as {
        name: string;
        unit_label: string | null;
        price: number;
        sale_price: number | null;
        stock: number;
        critical_stock: number;
        is_active: boolean;
        barcode: string | null;
        cost_price: number | null;
      }[];
      if (!rows.length) return { results: [], note: "Bu adla ürün yok. Farklı bir kelimeyle (ör. yalnız marka) tekrar ara." };
      show([
        {
          kind: "table",
          title: `“${q}” araması`,
          columns: ["Ürün", "Fiyat", "Stok", "Marj"],
          rows: rows.map((p) => {
            const price = Number(p.sale_price ?? p.price);
            const m = p.cost_price == null ? null : calcMargin(price, Number(p.cost_price));
            return [`${p.name}${p.is_active ? "" : " (pasif)"}`, tlv(price), String(p.stock), m ? `%${m.marginPct}` : "—"];
          }),
          alert: rows.map((p) => p.stock <= p.critical_stock),
        },
      ]);
      return {
        results: rows.map((p) => ({
          name: p.name,
          unit: p.unit_label,
          barcode: p.barcode,
          price: Number(p.price),
          sale_price: p.sale_price == null ? null : Number(p.sale_price),
          stock: p.stock,
          critical: p.stock <= p.critical_stock,
          on_sale: p.is_active,
          ...costInfo({ price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price), product_costs: p.cost_price == null ? null : { cost_price: p.cost_price } }),
        })),
        note: rows.length > 1 ? "Birden fazla eşleşme var; soruya uyanları (ör. tüm boyları) stoklarıyla birlikte say." : undefined,
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
      const ST: Record<string, string> = { alindi: "Alındı", hazirlaniyor: "Hazırlanıyor", yolda: "Yolda" };
      show([
        {
          kind: "kpis",
          title: "Açık siparişler",
          items: [
            { label: "Alındı", value: String(rows.filter((r) => r.status === "alindi").length) },
            { label: "Hazırlanıyor", value: String(rows.filter((r) => r.status === "hazirlaniyor").length) },
            { label: "Yolda", value: String(rows.filter((r) => r.status === "yolda").length) },
            { label: "Gecikmiş", value: String(rows.filter((r) => r.late).length) },
          ],
        },
        ...(rows.length
          ? [
              {
                kind: "table" as const,
                title: "Siparişler",
                columns: ["No", "Aşama", "Süre", "Tutar"],
                rows: rows.slice(0, 15).map((r) => [`#${r.order_no}`, ST[r.status] ?? r.status, `${r.minutes_in_stage} dk`, tlv(r.total)]),
                alert: rows.slice(0, 15).map((r) => r.late),
              },
            ]
          : []),
      ]);
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
      show([
        {
          kind: "kpis",
          title: `Müşteriler (online) · ${p.cur.label}`,
          items: [
            { label: "Müşteri", value: String(by.size) },
            { label: "Yeni", value: String(newCount) },
            { label: "Tekrar gelen", value: String(by.size - newCount) },
          ],
        },
        ...(top.length ? [{ kind: "bars" as const, title: "En çok harcayanlar", unit: "tl" as const, items: top.map((x) => ({ label: x.name, value: x.spent, sub: `${x.orders} sipariş` })) }] : []),
      ]);
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
      const loss = sorted.filter((r) => r.unit_profit_tl < 0);
      const avg = withCost.length ? r2(withCost.reduce((a, r) => a + r.margin_pct, 0) / withCost.length) : null;
      const pick = q ? withCost.filter((r) => r.name.toLocaleLowerCase("tr").includes(q)).slice(0, 15) : [...loss.slice(0, 10), ...sorted.filter((r) => r.unit_profit_tl >= 0).slice(0, 10 - Math.min(10, loss.length))];
      show([
        {
          kind: "kpis",
          title: "Kâr marjı",
          items: [
            { label: "Ort. marj", value: avg == null ? "—" : `%${avg}` },
            { label: "Zararına", value: String(loss.length) },
            { label: "Alışı eksik", value: (rows.length - withCost.length).toLocaleString("tr-TR") },
          ],
        },
        ...(pick.length
          ? [
              {
                kind: "table" as const,
                title: q ? `“${q}” marjları` : "En düşük marjlı ürünler",
                columns: ["Ürün", "Alış", "Kâr", "Marj"],
                rows: pick.map((r) => [r.name, tlv(r.cost_price), tlv(r.unit_profit_tl), `%${r.margin_pct}`]),
                alert: pick.map((r) => r.unit_profit_tl < 0),
              },
            ]
          : []),
      ]);
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
      const r = await fetchDiscounts(sb, { includeInactive: args.include_inactive === true, query: args.query ? String(args.query) : undefined, limit: 30 });
      if (!("error" in r) && r.products.length)
        show([
          {
            kind: "table",
            title: `İndirimdeki ürünler (${r.count})`,
            columns: ["Ürün", "Normal", "İndirimli", "%"],
            rows: r.products.slice(0, 25).map((p) => [p.name, tlv(p.price), tlv(p.sale_price), `%${p.discount_pct}`]),
            alert: r.products.slice(0, 25).map((p) => !p.in_stock),
          },
        ]);
      return r;
    }

    if (name === "get_store_sales_report") {
      const p = periodRanges(period, s.open_time, start, end);
      if ("error" in p) return p;
      const load = async (rg: Range) => {
        const { data, error } = await fetchAll((f, t) =>
          sb
            .from("pos_sales")
            .select("created_at,total,discount,payment,cash_amount,card_amount,change_due,cost_total,voided_at,pos_sale_items(product_name,quantity,line_total,cost_price)")
            .gte("created_at", businessDateStart(rg.from, s.open_time))
            .lt("created_at", businessDateStart(addDays(rg.to, 1), s.open_time))
            .order("created_at")
            .range(f, t),
        );
        if (error) throw new Error(error.message);
        return (data ?? []) as unknown as {
          created_at: string;
          total: number;
          discount: number;
          cash_amount: number;
          card_amount: number;
          change_due: number;
          voided_at: string | null;
          pos_sale_items: { product_name: string; quantity: number; line_total: number; cost_price: number | null }[];
        }[];
      };
      const [cur, prev] = await Promise.all([load(p.cur), load(p.prevToDate ?? p.prev)]);
      const agg = (rows: Awaited<ReturnType<typeof load>>) => {
        const ok = rows.filter((x) => !x.voided_at);
        let costed = 0;
        let cost = 0;
        let disc = 0;
        for (const x of ok) {
          disc += Number(x.discount);
          for (const i of x.pos_sale_items)
            if (i.cost_price != null) {
              costed += Number(i.line_total);
              cost += Number(i.cost_price) * Number(i.quantity);
            }
        }
        const net = ok.reduce((a, x) => a + Number(x.total), 0);
        return {
          receipts: ok.length,
          net_sales_tl: r2(net),
          avg_receipt_tl: ok.length ? r2(net / ok.length) : 0,
          cash_tl: r2(ok.reduce((a, x) => a + Number(x.cash_amount) - Number(x.change_due), 0)),
          card_tl: r2(ok.reduce((a, x) => a + Number(x.card_amount), 0)),
          discount_tl: r2(disc),
          gross_profit_tl: costed ? r2(costed - cost - disc) : null,
          voided: rows.length - ok.length,
        };
      };
      const c = agg(cur);
      const pv = agg(prev);
      const byDay = new Map<string, number>();
      const top = new Map<string, { name: string; qty: number; revenue: number }>();
      for (const x of cur) {
        if (x.voided_at) continue;
        const d = businessDateOf(new Date(x.created_at).getTime(), s.open_time);
        byDay.set(d, (byDay.get(d) ?? 0) + Number(x.total));
        for (const i of x.pos_sale_items) {
          const t = top.get(i.product_name) ?? { name: i.product_name, qty: 0, revenue: 0 };
          t.qty += Number(i.quantity);
          t.revenue += Number(i.line_total);
          top.set(i.product_name, t);
        }
      }
      const topList = [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      const vis: AdminVisual[] = [
        {
          kind: "kpis",
          title: `Mağaza (kasa) · ${p.cur.label}`,
          items: [
            { label: "Net satış", value: tlv(c.net_sales_tl), delta: pct(c.net_sales_tl, pv.net_sales_tl), hint: `${(p.prevToDate ?? p.prev).label}: ${tlv(pv.net_sales_tl)}` },
            { label: "Fiş", value: String(c.receipts), delta: pct(c.receipts, pv.receipts) },
            { label: "Nakit / Kart", value: `${tlv(c.cash_tl)} / ${tlv(c.card_tl)}` },
            { label: "Brüt kâr", value: c.gross_profit_tl == null ? "—" : tlv(c.gross_profit_tl) },
          ],
        },
      ];
      if (p.cur.from !== p.cur.to) {
        const days: { label: string; value: number }[] = [];
        for (let d = p.cur.from; d <= p.cur.to && days.length < 31; d = addDays(d, 1)) days.push({ label: shortDay(d), value: r2(byDay.get(d) ?? 0) });
        vis.push({ kind: "bars", title: "Günlük kasa satışı", unit: "tl", items: days });
      }
      if (topList.length) vis.push({ kind: "bars", title: "Kasada en çok satanlar", unit: "tl", items: topList.map((x) => ({ label: x.name, value: r2(x.revenue), sub: `${x.qty} adet` })) });
      show(vis);
      return {
        current: { period: p.cur.label, ...c },
        compare: { period: (p.prevToDate ?? p.prev).label, ...pv, net_change_pct: pct(c.net_sales_tl, pv.net_sales_tl) },
        top_products: topList.map((x) => ({ ...x, revenue: r2(x.revenue) })),
        note: "YALNIZCA mağaza (kasa) satışları; online siparişlerle TOPLAMA, ayrı söyle.",
      };
    }

    if (name === "propose_product_change") {
      const q = String(args.product ?? "").trim().slice(0, 60);
      if (q.length < 2) return { error: "Hangi ürün? Ürün adını söyle." };
      const setStock = numArg(args.set_stock);
      const addStock = numArg(args.add_stock);
      const setPrice = numArg(args.set_price);
      const setSale = numArg(args.set_sale_price);
      const removeSale = args.remove_sale === true;
      const setActive = typeof args.set_active === "boolean" ? args.set_active : undefined;
      if ([setStock, addStock, setPrice, setSale].some((n) => Number.isNaN(n))) return { error: "Sayı anlaşılamadı; tekrar sor." };
      if (setStock == null && addStock == null && setPrice == null && setSale == null && !removeSale && setActive == null)
        return { error: "Ne değişecek? Stok, fiyat, indirimli fiyat ya da satış durumu söyle." };

      const { data, error } = await sb.rpc("admin_search_products", { q, lim: 8 });
      if (error) return { error: error.message };
      const rows = (data ?? []) as { id: string; name: string; unit_label: string | null; price: number; sale_price: number | null; stock: number; is_active: boolean; barcode: string | null }[];
      if (!rows.length) return { error: `“${q}” adında ürün bulunamadı. Farklı bir adla dene.` };
      const exact = rows.filter((r) => fold(r.name) === fold(q) || r.barcode === q.replace(/\s/g, ""));
      const p = exact.length === 1 ? exact[0] : rows.length === 1 ? rows[0] : null;
      if (!p) {
        show([{ kind: "table", title: `“${q}” — hangisi?`, columns: ["Ürün", "Fiyat", "Stok"], rows: rows.map((r) => [r.name, tlv(Number(r.sale_price ?? r.price)), String(r.stock)]) }]);
        return { ambiguous: true, choices: rows.map((r) => r.name), note: "Birden çok ürün var. Hangisi olduğunu sor; sonra product alanına TAM adını yazarak tekrar çağır." };
      }
      const before = { price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price), stock: p.stock, is_active: p.is_active };
      const patch: ProductChange["patch"] = {};
      const out: ProductChange["rows"] = [];
      if (setStock != null || addStock != null) {
        const st = setStock != null ? Math.round(setStock) : before.stock + Math.round(addStock!);
        if (st < 0) return { error: `Stok eksiye düşemez (şu an ${before.stock}).` };
        patch.stock = st;
        out.push({ label: "Stok", before: String(before.stock), after: String(st) });
      }
      if (setPrice != null) {
        if (setPrice <= 0) return { error: "Fiyat sıfırdan büyük olmalı." };
        patch.price = Math.round(setPrice * 100) / 100;
        out.push({ label: "Fiyat", before: ynTL(before.price), after: ynTL(patch.price) });
      }
      if (setSale != null || removeSale) {
        const sale = removeSale ? null : Math.round(setSale! * 100) / 100;
        const base = patch.price ?? before.price;
        if (sale != null && (sale <= 0 || sale >= base)) return { error: `İndirimli fiyat normal fiyattan (${ynTL(base)}) düşük olmalı.` };
        patch.sale_price = sale;
        out.push({ label: "İndirimli fiyat", before: ynTL(before.sale_price), after: ynTL(sale) });
      } else if (patch.price != null && before.sale_price != null && before.sale_price >= patch.price) {
        patch.sale_price = null;
        out.push({ label: "İndirimli fiyat", before: ynTL(before.sale_price), after: "kaldırılır (yeni fiyattan yüksek)" });
      }
      if (setActive != null && setActive !== before.is_active) {
        patch.is_active = setActive;
        out.push({ label: "Satış durumu", before: before.is_active ? "satışta" : "kapalı", after: setActive ? "satışta" : "kapalı" });
      }
      if (!out.length) return { error: "Bu değerler zaten aynı; değişecek bir şey yok." };
      if (pending?.status === "bekliyor") cancelPending();
      publish({
        id: crypto.randomUUID(),
        productId: p.id,
        name: p.name,
        rows: out,
        expect: before,
        patch,
        status: "bekliyor",
        createdAt: Date.now(),
        proposedAfter: deps.lastUserText?.() ?? "",
      });
      return {
        pending: true,
        product: p.name,
        changes: out.map((x) => `${x.label}: ${x.before} → ${x.after}`),
        note: "HENÜZ UYGULANMADI. Değişikliği kısaca oku ve 'Onaylıyor musun?' diye sor. Kullanıcı 'evet' derse confirm_product_change, 'hayır' derse cancel_product_change çağır. Ekranda da Onayla butonu var.",
      };
    }

    if (name === "confirm_product_change") {
      if (!pending || pending.status !== "bekliyor") return { error: "Onay bekleyen değişiklik yok." };
      const said = (deps.lastUserText?.() ?? "").toLocaleLowerCase("tr");
      if (!said || said === pending.proposedAfter.toLocaleLowerCase("tr") || !EVET.test(said) || HAYIR.test(said))
        return { error: "Kullanıcıdan açık bir 'evet' duymadım. Değişikliği uygulamadım; tekrar 'Onaylıyor musun?' diye sor ya da ekrandaki Onayla butonunu göster." };
      const r = await confirmPending();
      return r.ok ? { ok: true, done: r.message, note: "Uygulandı; kısaca 'Tamam, güncellendi' de." } : { error: r.message };
    }

    if (name === "cancel_product_change") {
      return cancelPending() ? { ok: true, note: "Vazgeçildi, hiçbir şey değişmedi." } : { error: "Bekleyen değişiklik yok." };
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
  return Object.assign(run, { confirmPending, cancelPending });
}
