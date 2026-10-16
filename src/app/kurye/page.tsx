import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/data/auth";
import { createClient } from "@/lib/supabase/server";
import { CourierBoard } from "./CourierBoard";
import { CourierApp, type CourierMe } from "./CourierApp";

type Props = { searchParams: Promise<{ k?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { k = "" } = await searchParams;
  return {
    title: "Kurye paneli",
    robots: { index: false, follow: false },
    manifest: `/api/manifest/kurye?k=${encodeURIComponent(k)}`,
    appleWebApp: { capable: true, title: "SM Kurye", statusBarStyle: "default" },
    icons: { apple: "/pwa-192.png" },
  };
}

export default function CourierPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="p-6 text-center text-muted">Yükleniyor…</div>}>
      <Board searchParams={searchParams} />
    </Suspense>
  );
}

async function Board({ searchParams }: Props) {
  const { k = "" } = await searchParams;
  const user = await getSessionUser();
  // Üye girişli onaylı kurye → profesyonel kurye paneli
  if (user?.role === "courier") {
    const supabase = await createClient();
    const [{ data: me }, { data: st }] = await Promise.all([
      supabase.from("couriers").select("user_id, full_name, phone, vehicle, plate, per_delivery_fee, on_duty").eq("user_id", user.id).single(),
      supabase.from("store_settings").select("open_time, close_time, store_name, phone").eq("id", 1).maybeSingle(),
    ]);
    return (
      <CourierApp
        me={{ ...(me as CourierMe), per_delivery_fee: Number(me?.per_delivery_fee ?? 0), email: user.email }}
        openTime={String(st?.open_time ?? "10:00").slice(0, 5)}
        storePhone={(st?.phone as string | null) ?? null}
      />
    );
  }
  // Eski gizli bağlantı (?k=) — üyeliksiz tek kurye
  if (k) return <CourierBoard token={k} />;
  if (!user) redirect("/giris?kurye=1");
  redirect("/kurye/basvuru");
}
