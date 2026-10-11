import Link from "next/link";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/data/auth";
import { formatTL } from "@/lib/format";
import { currentBusinessDay } from "@/lib/hours";
import type { Order } from "@/lib/types";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OrderTable } from "@/components/admin/OrderTable";
import { RevenueReport } from "@/components/admin/RevenueReport";

export const metadata = { title: "Genel bakış" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ bas?: string; bit?: string }> }) {
  const { bas, bit } = await searchParams;
  await connection();
  const { supabase } = await requireAdmin();

  const { data: hours } = await supabase.from("store_settings").select("open_time,close_time,is_open").eq("id", 1).single();
  const openT = hours?.open_time ?? "10:00";
  const closeT = hours?.close_time ?? "01:00";
  // İş günü: açılıştan (10:00) ertesi gün kapanışa (01:00) kadar; 01:00–10:00 arası bir önceki iş günü gösterilir
  const { window: win, state } = currentBusinessDay(openT, closeT, hours?.is_open ?? true);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso));

  const [today, open, lowStock, recent, waiting] = await Promise.all([
    supabase.from("orders").select("total,status").gte("created_at", win.start).lt("created_at", win.end),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["alindi", "hazirlaniyor", "yolda"]),
    supabase.from("products").select("id,name,stock,critical_stock").eq("is_active", true).order("stock").limit(50),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "alindi"),
  ]);
  const newCount = waiting.count ?? 0;

  const todays = (today.data ?? []).filter((o) => o.status !== "iptal");
  const revenue = todays.reduce((a, o) => a + Number(o.total), 0);
  const low = (lowStock.data ?? []).filter((p) => p.stock <= p.critical_stock);

  const stats = [
    { label: "İş günü siparişi", value: String(todays.length) },
    { label: "İş günü cirosu", value: formatTL(revenue) },
    {
      label: newCount ? `Bekleyen sipariş · ${newCount} onay bekliyor` : "Bekleyen sipariş",
      value: String(open.count ?? 0),
      href: "/admin/siparisler?durum=acik",
      alarm: newCount > 0,
    },
    { label: "Kritik stok", value: String(low.length), href: "/admin/urunler?stok=kritik" },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={30} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-black">Genel bakış</h1>
        <p className="text-sm">
          <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-bold ${state.open ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
            {state.open ? "Açık" : "Kapalı"}
          </span>
          <span className="text-muted">İş günü:</span> <b>{fmt(win.start)}</b> → <b>{fmt(win.end)}</b>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-sm font-semibold text-muted">{s.label}</p>
              <p className="mt-1 text-2xl font-black">{s.value}</p>
            </>
          );
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className={`rounded-2xl p-4 ring-1 ring-line hover:ring-brand ${"alarm" in s && s.alarm ? "bekleyen-yanip-son [&_p]:text-inherit!" : "bg-white"}`}
            >
              {body}
            </Link>
          ) : (
            <div key={s.label} className="rounded-2xl bg-white p-4 ring-1 ring-line">{body}</div>
          );
        })}
      </div>

      <RevenueReport supabase={supabase} openTime={openT} from={bas} to={bit} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="mb-3 font-extrabold">Son siparişler</h2>
          <OrderTable orders={(recent.data ?? []) as Order[]} />
        </section>
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="mb-3 font-extrabold">Kritik stok</h2>
          {low.length === 0 ? (
            <p className="text-sm text-muted">Kritik seviyede ürün yok.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {low.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <Link href={`/admin/urunler/${p.id}`} className="font-semibold hover:text-brand">{p.name}</Link>
                  <span className={`font-bold ${p.stock === 0 ? "text-brand" : "text-warn"}`}>{p.stock === 0 ? "Tükendi" : p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

