import Link from "next/link";
import { STATUS_LABEL, formatDate, formatTL } from "@/lib/format";
import type { Order } from "@/lib/types";

export function OrderTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <p className="text-sm text-muted">Sipariş yok.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs uppercase text-muted">
          <tr><th className="py-2">No</th><th>Müşteri</th><th>Tarih</th><th>Durum</th><th>Ödeme</th><th className="text-right">Tutar</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-bg">
              <td className="py-2.5"><Link href={`/admin/siparisler/${o.id}`} className="font-bold text-brand">#{o.order_no}</Link></td>
              <td>{o.customer_name}</td>
              <td className="text-muted">{formatDate(o.created_at)}</td>
              <td><StatusBadge status={o.status} /></td>
              <td>{o.payment_method === "kapida_pos" ? "POS" : "Nakit"}</td>
              <td className="text-right font-bold">{formatTL(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ status }: { status: Order["status"] }) {
  const cls: Record<Order["status"], string> = {
    alindi: "bg-brand-soft text-brand",
    hazirlaniyor: "bg-amber-50 text-amber-700",
    yolda: "bg-sky-50 text-sky-700",
    teslim_edildi: "bg-emerald-50 text-emerald-700",
    iptal: "bg-zinc-100 text-zinc-500",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls[status]}`}>{STATUS_LABEL[status]}</span>;
}
