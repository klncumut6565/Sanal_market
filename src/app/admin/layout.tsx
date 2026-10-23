import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { Brand } from "@/components/Brand";
import { requireAdmin } from "@/lib/data/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { NewOrderAlarm } from "@/components/admin/NewOrderAlarm";
import { AdminScanListener } from "@/components/admin/AdminScanListener";
import { AdminVoiceAssistant, AdminVoiceCard } from "@/components/admin/AdminVoiceAssistant";
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
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Arka plan: müşteri ekranındaki gibi yumuşak marka ışıkları */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <span className="absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-3xl" />
        <span className="absolute -bottom-48 left-[20%] h-[26rem] w-[26rem] rounded-full bg-brand/10 blur-3xl" />
      </div>

      <aside className="relative z-30 border-b border-line bg-white/90 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-4 lg:pb-4 lg:pt-5">
          <Link href="/admin" className="block">
            <Brand size="sm" />
          </Link>
          <div className="flex items-center gap-2 lg:mt-3">
            <span className="rounded-full bg-gradient-to-r from-navy to-brand whitespace-nowrap px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white">
              Yönetim paneli
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand transition hover:bg-brand hover:text-white"
            >
              <Store size={13} /> Mağaza
            </Link>
          </div>
        </div>
        <div className="thin-scrollbar lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <AdminNav />
        </div>
        <div className="hidden p-3 lg:block">
          <AdminVoiceCard />
        </div>
      </aside>
      <main className="admin-main min-w-0 p-4 pb-28 lg:p-7 lg:pb-28">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-white" />}>
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
