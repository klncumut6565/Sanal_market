import { Suspense } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { requireAdmin } from "@/lib/data/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { NewOrderAlarm } from "@/components/admin/NewOrderAlarm";
import { AdminVoiceAssistant } from "@/components/admin/AdminVoiceAssistant";

export const metadata = { title: { default: "Yönetim", template: "%s · Yönetim" } };
export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:py-5">
          <Link href="/admin" className="block">
            <Brand size="sm" />
            <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-muted">Yönetim paneli</span>
          </Link>
          <Link href="/" className="text-sm font-semibold text-brand lg:mt-3 lg:block">Mağazaya git →</Link>
        </div>
        <AdminNav />
      </aside>
      <main className="min-w-0 p-4 lg:p-8">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <NewOrderAlarm />
      <AdminVoiceAssistant />
      {children}
    </>
  );
}
