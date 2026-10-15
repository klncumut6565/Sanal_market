import { connection } from "next/server";
import { requireAdmin } from "@/lib/data/auth";
import { isRecent } from "@/lib/hours";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { NotifySettingsForm } from "@/components/admin/NotifySettingsForm";
import { DailyReportCard } from "@/components/admin/DailyReportCard";
import type { StoreSettings } from "@/lib/types";

export const metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  await connection();
  const { supabase } = await requireAdmin();
  const [{ data }, { data: notify }] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", 1).single(),
    supabase.from("notify_settings").select("*").eq("id", 1).single(),
  ]);
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-black">Market ayarları</h1>
      <SettingsForm settings={data as StoreSettings} />
      {notify && <NotifySettingsForm n={notify} hasResendKey={!!process.env.RESEND_API_KEY?.trim()} panelOpen={isRecent(notify.admin_last_seen, 120_000)} cloud={!!(process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim())} />}
      {notify && <DailyReportCard enabled={notify.daily_report_enabled ?? true} lastResult={notify.daily_report_last_result ?? null} lastAt={notify.daily_report_last_at ?? null} />}
    </div>
  );
}
