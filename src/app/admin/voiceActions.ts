"use server";
// Yönetim sesli asistanının ONAYLI değişiklikleri. Asistan yalnızca öneri hazırlar; bu aksiyon
// yalnızca yöneticinin onayından sonra çağrılır ve ürün öneri anındaki değerlerden farklıysa uygulamaz.
import { invalidateCatalog } from "@/lib/data/invalidate";
import { requireAdmin } from "@/lib/data/auth";

export type ProductSnapshot = { price: number; sale_price: number | null; stock: number; is_active: boolean };
export type ProductPatch = Partial<ProductSnapshot>;

const same = (a: number | null, b: number | null) => (a == null || b == null ? a === b : Math.abs(Number(a) - Number(b)) < 0.005);

export async function applyProductChange(id: string, expect: ProductSnapshot, patch: ProductPatch): Promise<{ ok: true; now: ProductSnapshot } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Geçersiz ürün." };
  const { data: cur, error: e1 } = await supabase.from("products").select("price,sale_price,stock,is_active").eq("id", id).single();
  if (e1 || !cur) return { ok: false, error: "Ürün bulunamadı." };
  if (!same(cur.price, expect.price) || !same(cur.sale_price, expect.sale_price) || cur.stock !== expect.stock || cur.is_active !== expect.is_active)
    return { ok: false, error: "Ürün bu arada değişmiş (ör. satış oldu). Değişikliği yeniden iste." };

  const next = { ...expect, ...patch };
  if (!(next.price > 0)) return { ok: false, error: "Fiyat sıfırdan büyük olmalı." };
  if (next.sale_price != null && !(next.sale_price > 0 && next.sale_price < next.price)) return { ok: false, error: "İndirimli fiyat normal fiyattan düşük olmalı." };
  if (!Number.isInteger(next.stock) || next.stock < 0 || next.stock > 100_000) return { ok: false, error: "Stok 0 veya pozitif tam sayı olmalı." };

  const upd: Record<string, unknown> = {};
  for (const k of ["price", "sale_price", "stock", "is_active"] as const) if (k in patch) upd[k] = next[k];
  if (!Object.keys(upd).length) return { ok: false, error: "Değişiklik yok." };
  const { data, error } = await supabase.from("products").update(upd).eq("id", id).select("price,sale_price,stock,is_active").single();
  if (error || !data) return { ok: false, error: "Kaydedilemedi: " + (error?.message ?? "") };
  await invalidateCatalog([id]);
  return { ok: true, now: { price: Number(data.price), sale_price: data.sale_price == null ? null : Number(data.sale_price), stock: data.stock, is_active: data.is_active } };
}
