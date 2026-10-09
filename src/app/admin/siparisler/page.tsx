import Link from "next/link";
import { requireAdmin } from "@/lib/data/auth";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OrderTable } from "@/components/admin/OrderTable";
import type { Order } from "@/lib/types";

export const metadata = { title: "Siparişler" };

const TABS = [
  { key: "acik", label: "Açık", statuses: ["alindi", "hazirlaniyor", "yolda"] },
  { key: "alindi", label: "Yeni", statuses: ["alindi"] },
  { key: "hazirlaniyor", label: "Hazırlanıyor", statuses: ["hazirlaniyor"] },
  { key: "yolda", label: "Yolda", statuses: ["yolda"] },
  { key: "teslim_edildi", label: "Teslim edildi", statuses: ["teslim_edildi"] },
  { key: "iptal", label: "İptal", statuses: ["iptal"] },
  { key: "tumu", label: "Tümü", statuses: [] as string[] },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const { durum = "acik" } = await searchParams;
  const tab = TABS.find((t) => t.key === durum) ?? TABS[0];
  const { supabase } = await requireAdmin();
  let q = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
  if (tab.statuses.length) q = q.in("status", tab.statuses);
  const { data } = await q;

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={30} />
      <h1 className="text-2xl font-black">Siparişler</h1>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/siparisler?durum=${t.key}`} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${t.key === tab.key ? "bg-brand text-white ring-brand" : "bg-white ring-line"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <OrderTable orders={(data ?? []) as Order[]} />
      </div>
    </div>
  );
}
