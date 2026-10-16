import Link from "next/link";
import { AlertTriangle, Bike } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { formatDate, formatTL } from "@/lib/format";
import { collectedLabel } from "@/lib/courierShared";
import { assignCourier, clearIssue } from "@/app/admin/kuryeler/actions";
import { CourierMap } from "./CourierMap";

export type CourierCols = {
  courier_id: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  collected_method: "nakit" | "pos" | null;
  collected_amount: number | null;
  courier_note: string | null;
  delivery_issue: string | null;
  delivery_issue_at: string | null;
  settlement_id: number | null;
};

/** Sipariş detayında kurye: atama, durum, sorun ve tahsilat */
export async function CourierCard({ order }: { order: { id: string; status: string; total: number } & CourierCols }) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("couriers").select("user_id, full_name, on_duty, is_active").order("full_name");
  const couriers = (data ?? []) as { user_id: string; full_name: string | null; on_duty: boolean; is_active: boolean }[];
  if (!couriers.length && !order.courier_id) return null;
  const cur = couriers.find((c) => c.user_id === order.courier_id);
  const openOrder = order.status !== "teslim_edildi" && order.status !== "iptal";
  const back = `/admin/siparisler/${order.id}`;

  return (
    <div className="space-y-2 rounded-xl bg-bg p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Bike size={18} className="text-brand" />
        <b>Kurye:</b>
        {cur ? (
          <span className="font-semibold">
            {cur.full_name}
            {order.assigned_at && <span className="text-muted"> · atandı {formatDate(order.assigned_at)}</span>}
            {order.picked_up_at && <span className="text-sky-700"> · paketi aldı {formatDate(order.picked_up_at)}</span>}
          </span>
        ) : (
          <span className="text-muted">atanmadı{openOrder ? " (kuryeler havuzda görür ve üstlenebilir)" : ""}</span>
        )}
        <Link href="/admin/kuryeler" className="ml-auto text-xs font-bold text-muted underline">
          Kuryeler
        </Link>
      </div>

      {openOrder && couriers.some((c) => c.is_active) && (
        <form action={assignCourier} className="flex flex-wrap gap-2">
          <input type="hidden" name="order_id" value={order.id} />
          <input type="hidden" name="back" value={back} />
          <select name="courier_id" defaultValue={order.courier_id ?? ""} className="input min-w-0 flex-1 py-2">
            <option value="">— Atanmamış (havuz) —</option>
            {couriers
              .filter((c) => c.is_active)
              .sort((a, b) => Number(b.on_duty) - Number(a.on_duty))
              .map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.on_duty ? "🟢" : "⚪"} {c.full_name ?? "Kurye"}
                  {c.on_duty ? " (mesaide)" : " (molada)"}
                </option>
              ))}
          </select>
          <button className="btn-primary py-2 text-sm">{order.courier_id ? "Değiştir" : "Ata ve bildir"}</button>
        </form>
      )}

      {order.courier_id && (order.status === "yolda" || order.picked_up_at) && (
        <details open={order.status === "yolda"} className="rounded-lg bg-white p-1.5">
          <summary className="cursor-pointer px-1 text-xs font-bold text-muted">📍 Kurye konumu ve teslimat rotası</summary>
          <div className="mt-1.5">
            <CourierMap orderId={order.id} courierId={order.courier_id} height={280} />
          </div>
        </details>
      )}

      {order.delivery_issue && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-2.5 font-semibold text-red-700 ring-1 ring-red-200">
          <AlertTriangle size={16} /> Teslim edilemedi: {order.delivery_issue}
          {order.delivery_issue_at && <span className="text-xs font-normal">({formatDate(order.delivery_issue_at)})</span>}
          <form action={clearIssue} className="ml-auto">
            <input type="hidden" name="order_id" value={order.id} />
            <input type="hidden" name="back" value={back} />
            <button className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold ring-1 ring-red-200">Tekrar denenecek (sorunu kapat)</button>
          </form>
        </div>
      )}

      {order.collected_method && (
        <p className="font-semibold">
          Tahsilat: {formatTL(order.collected_amount ?? 0)} {collectedLabel(order.collected_method)}
          {Math.abs(Number(order.collected_amount ?? 0) - Number(order.total)) >= 0.01 && (
            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">sipariş {formatTL(order.total)}</span>
          )}
          {order.courier_note && <span className="font-normal text-muted"> · Not: {order.courier_note}</span>}
          <span className="ml-1 text-xs font-normal text-muted">{order.settlement_id ? "· hesaplaşıldı ✓" : "· kuryede (hesaplaşılmadı)"}</span>
        </p>
      )}
    </div>
  );
}
