import Link from "next/link";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/data/auth";
import { formatTL } from "@/lib/format";
import type { Order } from "@/lib/types";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OrderTable } from "@/components/admin/OrderTable";

export const metadata = { title: "Genel bakış" };

export default async function AdminHome() {
  await connection();
  const { supabase } = await requireAdmin();

  // İstanbul (UTC+3) gün başlangıcı
  const now = new Date();
  const ist = new Date(now.getTime() + 3 * 3600_000);
  const dayStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 3 * 3600_000).toISOString();

  const [today, open, lowStock, recent] = await Promise.all([
    supabase.from("orders").select("total,status").gte("created_at", dayStart),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["alindi", "hazirlaniyor", "yolda"]),
    supabase.from("products").select("id,name,stock,critical_stock").eq("is_active", true).order("stock").limit(50),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
  ]);

  const todays = (today.data ?? []).filter((o) => o.status !== "iptal");
  const revenue = todays.reduce((a, o) => a + Number(o.total), 0);
  const low = (lowStock.data ?? []).filter((p) => p.stock <= p.critical_stock);

  const stats = [
    { label: "Bugünkü sipariş", value: String(todays.length) },
    { label: "Bugünkü ciro", value: formatTL(revenue) },
    { label: "Bekleyen sipariş", value: String(open.count ?? 0), href: "/admin/siparisler?durum=acik" },
    { label: "Kritik stok", value: String(low.length), href: "/admin/urunler?stok=kritik" },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={30} />
      <h1 className="text-2xl font-black">Genel bakış</h1>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-sm font-semibold text-muted">{s.label}</p>
              <p className="mt-1 text-2xl font-black">{s.value}</p>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="rounded-2xl bg-white p-4 ring-1 ring-line hover:ring-brand">{body}</Link>
          ) : (
            <div key={s.label} className="rounded-2xl bg-white p-4 ring-1 ring-line">{body}</div>
          );
        })}
      </div>

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

