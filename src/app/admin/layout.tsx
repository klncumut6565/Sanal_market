import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { requireAdmin } from "@/lib/data/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { NewOrderAlarm } from "@/components/admin/NewOrderAlarm";
import { AdminScanListener } from "@/components/admin/AdminScanListener";
import { AdminVoiceAssistant } from "@/components/admin/AdminVoiceAssistant";
import { StoreModeSwitch } from "@/components/admin/StoreModeSwitch";
import { CatalogAutoFlush } from "@/components/admin/CatalogAutoFlush";

export const metadata: Metadata = {
  title: { default: "Yönetim", template: "%s · Yönetim" },
  robots: { index: false, follow: false },
  manifest: "/api/manifest/admin",
  appleWebApp: { capable: true, title: "SM Yönetim", statusBarStyle: "default" },
  icons: { apple: "/pwa-192.png" },
};
export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[176px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-3 lg:py-4">
          <Link href="/admin" className="block">
            <Brand size="sm" />
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Yönetim paneli</span>
          </Link>
          <Link href="/" className="text-sm font-semibold text-brand lg:mt-3 lg:block">Mağazaya git →</Link>
        </div>
        <AdminNav />
      </aside>
      <main className="min-w-0 p-4 pb-24 lg:p-6 lg:pb-24">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();
  const { data: s } = await supabase.from("store_settings").select("is_open,force_open,open_time,close_time").eq("id", 1).maybeSingle();
  return (
    <>
      {/* Mağaza modu: her sayfada sağ üstte sabit */}
      <div className="pointer-events-none sticky top-2 z-40 -mt-1 mb-3 flex justify-end lg:-mt-4">
        <div className="pointer-events-auto">
          <StoreModeSwitch
            isOpen={s?.is_open ?? true}
            forceOpen={s?.force_open ?? false}
            openTime={s?.open_time ?? "10:00"}
            closeTime={s?.close_time ?? "01:00"}
          />
        </div>
      </div>
      <NewOrderAlarm />
      <AdminScanListener />
      <AdminVoiceAssistant />
      <CatalogAutoFlush />
      {children}
    </>
  );
}
