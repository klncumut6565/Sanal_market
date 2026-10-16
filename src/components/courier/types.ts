// Kurye paneli veri tipleri ve sorgu kolonları
export type CourierOrder = {
  id: string;
  order_no: number;
  status: "alindi" | "hazirlaniyor" | "yolda" | "teslim_edildi" | "iptal";
  customer_name: string;
  phone: string;
  address: string;
  address_note: string | null;
  note: string | null;
  delivery_slot: string | null;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  dispatched_at: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  collected_method: "nakit" | "pos" | null;
  collected_amount: number | null;
  courier_note: string | null;
  delivery_issue: string | null;
  delivery_issue_at: string | null;
  settlement_id: number | null;
  courier_id: string | null;
  order_items?: { quantity: number; product_name: string; unit_label: string | null; removed: boolean | null }[];
};

export type Settlement = {
  id: number;
  created_at: string;
  order_count: number;
  cash_amount: number;
  pos_amount: number;
  fee_amount: number;
  note: string | null;
};

export const ORDER_COLS =
  "id,order_no,status,customer_name,phone,address,address_note,note,delivery_slot,payment_method,subtotal,delivery_fee,total,created_at,dispatched_at,assigned_at,picked_up_at,delivered_at,collected_method,collected_amount,courier_note,delivery_issue,delivery_issue_at,settlement_id,courier_id";

export const numOrder = (o: CourierOrder): CourierOrder => ({
  ...o,
  subtotal: Number(o.subtotal),
  delivery_fee: Number(o.delivery_fee),
  total: Number(o.total),
  collected_amount: o.collected_amount == null ? null : Number(o.collected_amount),
});

export const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(n) || 0);

/** "12 dk", "1 sa 5 dk" */
export function since(iso: string | null, now: number) {
  if (!iso) return "";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa ${m % 60} dk`;
}

export const hm = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso)) : "—";
export const dayHm = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso)) : "—";
