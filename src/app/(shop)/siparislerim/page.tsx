import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { getSessionUser } from "@/lib/data/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, formatDate, formatTL } from "@/lib/format";
import type { Order } from "@/lib/types";
import { signOut } from "@/app/giris/actions";
import { DeviceOrders } from "./DeviceOrders";

export const metadata = { title: "Siparişlerim" };

export default function MyOrdersPage({ searchParams }: { searchParams: Promise<{ sifre?: string }> }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <h1 className="text-2xl font-black">Siparişlerim</h1>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-white" />}>
        <PasswordNotice searchParams={searchParams} />
        <AccountOrders />
      </Suspense>
    </div>
  );
}

async function PasswordNotice({ searchParams }: { searchParams: Promise<{ sifre?: string }> }) {
  const { sifre } = await searchParams;
  if (sifre !== "yenilendi") return null;
  return <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">✓ Şifren yenilendi ve giriş yaptın.</p>;
}

async function AccountOrders() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
          <p className="text-sm">Giriş yaparak tüm siparişlerini her cihazdan görebilirsin.</p>
          <Link href="/giris?next=/siparislerim" className="btn-primary shrink-0 py-2">Giriş yap</Link>
        </div>
        <DeviceOrders />
      </>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50);
  const orders = (data ?? []) as Order[];
  return (
    <>
      <div className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
        <span>{user.email}</span>
        <div className="flex gap-2">
          {user.role === "admin" && <Link href="/admin" className="btn-ghost py-1.5">Yönetim paneli</Link>}
          <form action={signOut}><button className="btn-ghost py-1.5"><LogOut size={16} /> Çıkış</button></form>
        </div>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-muted ring-1 ring-line">Henüz siparişin yok.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/siparis/${o.id}`} className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-line hover:ring-brand">
                <span>
                  <b>#{o.order_no}</b> <span className="text-sm text-muted">· {formatDate(o.created_at)}</span>
                  <span className="block text-sm font-semibold text-brand">{STATUS_LABEL[o.status]}</span>
                </span>
                <span className="flex items-center gap-1 font-bold">{formatTL(o.total)} <ChevronRight size={18} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
