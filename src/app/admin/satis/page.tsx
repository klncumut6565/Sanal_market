import { requireAdmin } from "@/lib/data/auth";
import { PosScreen } from "@/components/admin/pos/PosScreen";
import { displayPhone } from "@/lib/phone";

export const metadata = { title: "Satış ekranı" };

export default async function PosPage() {
  const { supabase } = await requireAdmin();
  const [{ data: s }, { data: cats }] = await Promise.all([
    supabase.from("store_settings").select("store_name,address,phone,whatsapp_phone").eq("id", 1).maybeSingle(),
    supabase.from("categories").select("id,name,emoji").order("sort_order"),
  ]);
  const phone = s?.phone || s?.whatsapp_phone || null;
  return (
    <PosScreen
      store={{ name: s?.store_name || "Sanal Market", address: s?.address ?? null, phone: phone ? displayPhone(phone) : null }}
      categories={(cats ?? []) as { id: string; name: string; emoji: string | null }[]}
    />
  );
}
