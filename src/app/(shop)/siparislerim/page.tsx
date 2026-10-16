import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { getSessionUser } from "@/lib/data/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, formatDate, formatTL } from "@/lib/format";
import type { Order } from "@/lib/types";
import { signOut } from "@/app/giris/actions";
import { DeviceOrders } from "./DeviceOrders";
import { deleteAllPrefs, deletePref } from "./actions";
import { ReorderButton } from "@/components/shop/ReorderButton";

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
  // Yalnızca kendi siparişleri (admin hesabında RLS tüm siparişleri açtığı için filtre şart)
  const [{ data }, { data: prefs }] = await Promise.all([
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("customer_prefs").select("id,note,created_at").eq("user_id", user.id).order("created_at"),
  ]);
  const orders = (data ?? []) as Order[];
  return (
    <>
      <div className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
        <span>{user.email}</span>
        <div className="flex gap-2">
          {user.role === "admin" && <Link href="/admin" className="btn-ghost py-1.5">Yönetim paneli</Link>}
          {user.role === "courier" && <Link href="/kurye" className="btn-ghost py-1.5">🛵 Kurye paneli</Link>}
          <form action={signOut}><button className="btn-ghost py-1.5"><LogOut size={16} /> Çıkış</button></form>
        </div>
      </div>
      {prefs && prefs.length > 0 && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-extrabold">🧠 Sesli asistanın hatırladığı tercihlerin</h2>
            <form action={deleteAllPrefs}>
              <button className="text-xs font-bold text-muted hover:text-brand">Tümünü sil</button>
            </form>
          </div>
          <ul className="divide-y divide-line text-sm">
            {prefs.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>{p.note}</span>
                <form action={deletePref}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-lg px-2 py-1 text-xs font-bold text-muted hover:bg-brand-soft hover:text-brand">Sil</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Asistan bunları önerilerinde kullanır. Asistana &quot;bunu unut&quot; diyerek de silebilirsin.</p>
        </section>
      )}
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-muted ring-1 ring-line">Henüz siparişin yok.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="rounded-2xl bg-white p-4 ring-1 ring-line hover:ring-brand">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/siparis/${o.id}`} className="min-w-0 flex-1">
                  <b>#{o.order_no}</b> <span className="text-sm text-muted">· {formatDate(o.created_at)}</span>
                  <span className="block text-sm font-semibold text-brand">{STATUS_LABEL[o.status]}</span>
                </Link>
                <ReorderButton orderId={o.id} compact />
                <Link href={`/siparis/${o.id}`} className="flex items-center gap-1 font-bold">{formatTL(o.total)} <ChevronRight size={18} /></Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
