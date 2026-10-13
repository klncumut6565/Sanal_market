import Link from "next/link";
import { requireAdmin } from "@/lib/data/auth";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OrderTable } from "@/components/admin/OrderTable";
import { OrderCard } from "@/components/admin/OrderProgress";
import { STAGES } from "@/lib/sla";
import { CourierSettingsForm } from "@/components/admin/CourierSettingsForm";
import { StoreModeSwitch } from "@/components/admin/StoreModeSwitch";
import type { Order, StoreSettings } from "@/lib/types";

export const metadata = { title: "Siparişler" };

const TABS = [
  { key: "acik", label: "Açık siparişler (pano)" },
  { key: "teslim_edildi", label: "Teslim edildi" },
  { key: "iptal", label: "İptal" },
  { key: "tumu", label: "Tümü" },
];

const COLUMNS = ["alindi", "hazirlaniyor", "yolda"] as const;
const COLUMN_STYLE = {
  alindi: "bg-brand",
  hazirlaniyor: "bg-amber-500",
  yolda: "bg-sky-600",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ durum?: string; hata?: string }> }) {
  const { durum = "acik", hata } = await searchParams;
  const tab = TABS.find((t) => t.key === durum) ?? TABS[0];
  const { supabase } = await requireAdmin();

  const settingsQ = supabase
    .from("store_settings")
    .select("sla_accept_min,sla_prepare_min,sla_delivery_min,is_open,force_open,open_time,close_time")
    .eq("id", 1)
    .single();
  let q = supabase.from("orders").select("*").order("created_at", { ascending: tab.key === "acik" }).limit(200);
  if (tab.key === "acik") q = q.in("status", COLUMNS as unknown as string[]);
  else if (tab.key !== "tumu") q = q.eq("status", tab.key);
  const courierQ = supabase.from("notify_settings").select("courier_phone, courier_apikey, courier_last_result").eq("id", 1).maybeSingle();
  const [{ data }, { data: sla }, { data: courier }] = await Promise.all([q, settingsQ, courierQ]);
  const orders = (data ?? []) as Order[];
  const targets = (sla ?? { sla_accept_min: 2, sla_prepare_min: 7, sla_delivery_min: 20 }) as Pick<StoreSettings, "sla_accept_min" | "sla_prepare_min" | "sla_delivery_min">;

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={20} />
      <h1 className="text-2xl font-black">Siparişler</h1>
      <StoreModeSwitch
        isOpen={sla?.is_open ?? true}
        forceOpen={sla?.force_open ?? false}
        openTime={sla?.open_time ?? "10:00"}
        closeTime={sla?.close_time ?? "01:00"}
      />
      <CourierSettingsForm phone={courier?.courier_phone ?? null} apikey={courier?.courier_apikey ?? null} lastResult={courier?.courier_last_result ?? null} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/siparisler?durum=${t.key}`} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${t.key === tab.key ? "bg-brand text-white ring-brand" : "bg-white ring-line"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {hata && <p className="rounded-lg bg-brand-soft p-3 text-sm font-semibold text-brand">Durum değiştirilemedi. Sayfayı yenileyip tekrar dene.</p>}

      {tab.key === "acik" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = orders.filter((o) => o.status === col);
            return (
              <section key={col} className="space-y-2.5">
                <h2 className="flex items-center gap-2 font-extrabold">
                  <span className={`h-3 w-3 rounded-full ${COLUMN_STYLE[col]}`} />
                  {STAGES[col].title}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-line">{list.length}</span>
                </h2>
                {list.length === 0 ? (
                  <p className="rounded-2xl border-2 border-dashed border-line p-4 text-center text-sm text-muted">Sipariş yok</p>
                ) : (
                  list.map((o) => <OrderCard key={o.id} order={o} sla={targets} />)
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <OrderTable orders={orders} />
        </div>
      )}
    </div>
  );
}
