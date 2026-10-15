import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, businessDateOf, businessDateStart } from "@/lib/hours";
import { sendWhatsAppChain, windowOpenFor } from "@/lib/notify";

// Gün sonu raporu: online siparişler ve mağaza (kasa) satışları AYRI hesaplanır, toplanmaz.
type Agg = Record<string, number>;
type Top = { name: string; qty: number; revenue: number }[];
type Data = {
  online: Agg;
  online_items: Agg;
  online_top: Top;
  store: Agg;
  store_items: Agg;
  store_top: Top;
  stock: { critical: number; out: number; list: { name: string; stock: number }[] };
  targets: { phone: string | null; backup: string | null; apikey: string | null; email: string | null; enabled: boolean };
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://sanalmarket.vercel.app").replace(/\/$/, "");
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(n) || 0);
const pct = (a: number, b: number) => (b > 0 ? `%${((a / b) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}` : "—");
const qty = (n: number) => String(Math.round(Number(n) * 1000) / 1000).replace(".", ",");
const short = (s: string, n = 28) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const topLine = (t: Top) => t.map((x) => `${short(x.name)} ×${qty(x.qty)}`).join(", ");

export function reportText(d: Data, day: string, openT: string) {
  const dayName = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" }).format(new Date(day + "T00:00:00Z"));
  const o = d.online;
  const oi = d.online_items;
  const s = d.store;
  const si = d.store_items;
  const oProfit = oi.costed_sales - oi.cost + o.fee;
  const sProfit = si.costed_sales - si.cost - s.discount;
  const L: string[] = [`📊 *GÜN SONU RAPORU*`, `${dayName} (iş günü ${openT}'dan itibaren)`, ""];

  L.push("🛵 *ONLINE SİPARİŞLER*");
  if (o.count === 0) L.push("Sipariş yok.");
  else {
    L.push(`Sipariş: ${o.count} · Ciro: *${tl(o.revenue)}*`);
    L.push(`Kapıda nakit ${tl(o.cash)} · Kapıda kart ${tl(o.card)}`);
    L.push(`Teslimat geliri: ${tl(o.fee)} · Ort. sepet: ${tl(o.revenue / o.count)}`);
    L.push(`Brüt kâr: *${tl(oProfit)}* (${pct(oProfit, o.revenue)})`);
    if (d.online_top.length) L.push(`En çok: ${topLine(d.online_top)}`);
  }
  if (o.cancelled || o.open) L.push(`İptal: ${o.cancelled}${o.open ? ` · ⚠️ Kapanmamış sipariş: ${o.open}` : ""}`);
  L.push("");

  L.push("🏪 *MAĞAZA (KASA)*");
  if (s.count === 0) L.push("Kasa satışı yok.");
  else {
    L.push(`Fiş: ${s.count} · Net satış: *${tl(s.net)}*${s.discount ? ` (indirim ${tl(s.discount)})` : ""}`);
    L.push(`Kasadaki nakit ${tl(s.cash)} · Kart ${tl(s.card)}`);
    L.push(`Ort. fiş: ${tl(s.net / s.count)} · Brüt kâr: *${tl(sProfit)}* (${pct(sProfit, s.net)})`);
    if (d.store_top.length) L.push(`En çok: ${topLine(d.store_top)}`);
  }
  if (s.voided) L.push(`İptal edilen fiş: ${s.voided}`);
  L.push("");

  L.push("📦 *STOK*");
  if (!d.stock.out && !d.stock.critical) L.push("Kritik seviyede ürün yok ✅");
  else {
    L.push(`Tükenen: ${d.stock.out} · Kritik: ${d.stock.critical}`);
    for (const p of d.stock.list.slice(0, 8)) L.push(`• ${short(p.name, 34)}: ${p.stock <= 0 ? "TÜKENDİ" : `${p.stock} adet`}`);
    if (d.stock.out + d.stock.critical > 8) L.push(`… ve ${d.stock.out + d.stock.critical - 8} ürün daha`);
  }

  const covO = oi.sales > 0 ? oi.costed_sales / oi.sales : 1;
  const covS = si.sales > 0 ? si.costed_sales / si.sales : 1;
  if (covO < 1 || covS < 1) {
    L.push("", `ℹ️ Kâr yalnızca alış fiyatı girilmiş satışlardan hesaplandı (online ${pct(covO, 1)}, kasa ${pct(covS, 1)}).`);
  }
  L.push("", `Ayrıntı: ${SITE}/admin/rapor`);
  return L.join("\n");
}

/**
 * Raporu hazırlayıp WhatsApp'tan gönderir.
 *  - secret: zamanlanmış çağrı için (WHATSAPP_VERIFY_TOKEN); yönetici oturumuyla çağrılıyorsa null.
 *  - force: aynı gün daha önce gönderildiyse bile gönder (test).
 *  - day: YYYY-MM-DD iş günü; yoksa en son biten/süren iş günü.
 */
export async function runDailyReport(sb: SupabaseClient, opts: { secret: string | null; force?: boolean; day?: string }) {
  const { data: hours } = await sb.from("store_settings").select("open_time").eq("id", 1).maybeSingle();
  const openT = (hours?.open_time as string | undefined)?.slice(0, 5) ?? "10:00";
  const day = opts.day ?? businessDateOf(Date.now(), openT);

  if (!opts.force) {
    const { data: claimed, error } = await sb.rpc("daily_report_claim", { p_secret: opts.secret, p_day: day });
    if (error) return { ok: false, status: `Yetki/ayar hatası: ${error.message}` };
    if (!claimed) return { ok: true, status: `${day} raporu zaten gönderilmiş ya da rapor kapalı — atlandı.` };
  }

  const { data, error } = await sb.rpc("daily_report_data", {
    p_secret: opts.secret,
    p_start: businessDateStart(day, openT),
    p_end: businessDateStart(addDays(day, 1), openT),
  });
  if (error || !data) return { ok: false, status: `Veri alınamadı: ${error?.message ?? "boş"}` };
  const d = data as Data;
  const text = reportText(d, day, openT);
  if (!d.targets.phone && !d.targets.backup) {
    const status = "WhatsApp numarası ayarlı değil.";
    await sb.rpc("daily_report_mark", { p_secret: opts.secret, p_result: `${day} · ${status}` });
    return { ok: false, status, text };
  }
  const r = await sendWhatsAppChain({
    phone: d.targets.phone,
    backupPhone: d.targets.backup,
    apikey: d.targets.apikey,
    text,
    windowOpen: await windowOpenFor(d.targets.phone),
  });
  await sb.rpc("daily_report_mark", { p_secret: opts.secret, p_result: `${day}${opts.force ? " (elle)" : ""} · ${r}` });
  return { ok: /gönderildi|iletildi/.test(r), status: r, text };
}
