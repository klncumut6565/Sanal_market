import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "@/lib/types";

export type Customer = {
  phone: string;
  name: string;
  member: boolean;
  orderCount: number;
  delivered: number;
  cancelled: number;
  totalSpent: number; // iptal hariç
  firstOrder: string | null;
  lastOrder: string | null;
  lastAddress: string | null;
};

/** Siparişlerden (telefona göre) ve üyelerden müşteri listesi çıkarır. */
export async function loadCustomers(supabase: SupabaseClient): Promise<Customer[]> {
  const [{ data: orders }, { data: profiles }] = await Promise.all([
    supabase
      .from("orders")
      .select("customer_name, phone, total, status, created_at, address, user_id")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("profiles").select("id, full_name, phone, role"),
  ]);

  const map = new Map<string, Customer>();
  const memberPhones = new Set((profiles ?? []).map((p) => p.phone).filter(Boolean));

  for (const o of (orders ?? []) as Pick<Order, "customer_name" | "phone" | "total" | "status" | "created_at" | "address" | "user_id">[]) {
    let c = map.get(o.phone);
    if (!c) {
      c = {
        phone: o.phone,
        name: o.customer_name,
        member: !!o.user_id || memberPhones.has(o.phone),
        orderCount: 0,
        delivered: 0,
        cancelled: 0,
        totalSpent: 0,
        firstOrder: o.created_at,
        lastOrder: o.created_at,
        lastAddress: o.address,
      };
      map.set(o.phone, c);
    }
    c.orderCount++;
    if (o.status === "teslim_edildi") c.delivered++;
    if (o.status === "iptal") c.cancelled++;
    else c.totalSpent += Number(o.total);
    c.firstOrder = o.created_at; // liste yeniden eskiye sıralı
    if (o.user_id) c.member = true;
  }

  // Henüz sipariş vermemiş üyeler
  for (const p of profiles ?? []) {
    if (p.role === "admin" || !p.phone || map.has(p.phone)) continue;
    map.set(p.phone, {
      phone: p.phone,
      name: p.full_name ?? "—",
      member: true,
      orderCount: 0,
      delivered: 0,
      cancelled: 0,
      totalSpent: 0,
      firstOrder: null,
      lastOrder: null,
      lastAddress: null,
    });
  }

  return [...map.values()].sort((a, b) => (b.lastOrder ?? "").localeCompare(a.lastOrder ?? ""));
}
