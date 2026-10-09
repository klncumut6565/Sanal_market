import { requireAdmin } from "@/lib/data/auth";
import { SettingsForm } from "@/components/admin/SettingsForm";
import type { StoreSettings } from "@/lib/types";

export const metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("store_settings").select("*").eq("id", 1).single();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-black">Market ayarları</h1>
      <SettingsForm settings={data as StoreSettings} />
    </div>
  );
}
