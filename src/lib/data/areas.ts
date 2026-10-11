import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export const AREAS_TAG = "areas";

export type DeliveryAreas = {
  districts: { id: number; name: string; is_active: boolean }[];
  neighborhoods: { id: number; district_id: number; name: string; semt: string | null; is_active: boolean }[];
  streets: { id: number; neighborhood_id: number; name: string }[];
};

/** Teslimat bölgeleri (ilçe → mahalle → sokak). Supabase varsayılan 1000 satır sınırı için sayfalı çeker. */
export async function getDeliveryAreas(): Promise<DeliveryAreas> {
  "use cache";
  cacheTag(AREAS_TAG);
  cacheLife("minutes");
  const sb = createPublicClient();
  const [d, n] = await Promise.all([
    sb.from("delivery_districts").select("id,name,is_active").order("sort_order"),
    // Pasif mahalleler de gelir: listede "teslimat yok" diye soluk gösterilir
    sb.from("delivery_neighborhoods").select("id,district_id,name,semt,is_active").order("name"),
  ]);
  const streets: DeliveryAreas["streets"] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await sb
      .from("delivery_streets")
      .select("id,neighborhood_id,name")
      .eq("is_active", true)
      .order("id")
      .range(from, from + 999);
    if (error || !data?.length) break;
    streets.push(...data);
    if (data.length < 1000) break;
  }
  const tr = (a: string, b: string) => a.localeCompare(b, "tr");
  return {
    districts: d.data ?? [],
    neighborhoods: (n.data ?? []).sort((a, b) => tr(a.name, b.name)),
    streets: streets.sort((a, b) => tr(a.name, b.name)),
  };
}
