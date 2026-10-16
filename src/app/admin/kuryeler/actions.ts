"use server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/data/auth";
import { notifyCourier } from "@/lib/courier";
import { formatTL } from "@/lib/format";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s === "" || !Number.isFinite(n) ? null : n;
};
const ERR: Record<string, string> = {
  YETKISIZ: "Yetkin yok.",
  KURYE_YOK: "Kurye bulunamadı ya da pasif.",
  SIPARIS_KAPALI: "Sipariş kapanmış (teslim edildi / iptal).",
  SIPARIS_YOK: "Sipariş bulunamadı.",
  HESAPLASACAK_YOK: "Hesaplaşılacak teslimat yok.",
  KULLANICI_YOK: "Kullanıcı bulunamadı.",
};
const em = (e: { message?: string }) => ERR[(e.message ?? "").split(":")[0].trim()] ?? e.message ?? "İşlem yapılamadı.";
const back = (fd: FormData, fallback: string) => {
  const b = str(fd, "back");
  return b.startsWith("/admin") && !b.startsWith("//") ? b : fallback;
};
const go = (url: string, key: "ok" | "hata", text: string) => redirect(`${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(text)}`);

export async function decideCourier(fd: FormData) {
  const { supabase } = await requireAdmin();
  const userId = str(fd, "user_id");
  const approve = str(fd, "approve") === "1";
  if (!isId(userId)) return;
  const { error } = await supabase.rpc("admin_courier_decide", { p_user_id: userId, p_approve: approve, p_fee: num(str(fd, "fee")) ?? 0 });
  revalidatePath("/admin/kuryeler");
  if (error) go("/admin/kuryeler", "hata", em(error));
  go("/admin/kuryeler", "ok", approve ? "Kurye onaylandı. Kişi giriş yaptığında kurye paneline yönlendirilir." : "Kurye yetkisi kapatıldı.");
}

export async function updateCourier(fd: FormData) {
  const { supabase } = await requireAdmin();
  const userId = str(fd, "user_id");
  if (!isId(userId)) return;
  const { error } = await supabase.rpc("admin_courier_update", {
    p_user_id: userId,
    p_fee: num(str(fd, "fee")),
    p_vehicle: str(fd, "vehicle") || null,
    p_plate: str(fd, "plate"),
    p_phone: str(fd, "phone") || null,
    p_active: fd.get("active") == null ? null : str(fd, "active") === "1",
  });
  revalidatePath("/admin/kuryeler");
  if (error) go("/admin/kuryeler", "hata", em(error));
  go("/admin/kuryeler", "ok", "Kurye bilgileri güncellendi.");
}

export async function settleCourier(fd: FormData) {
  const { supabase } = await requireAdmin();
  const courierId = str(fd, "courier_id");
  if (!isId(courierId)) return;
  const { data, error } = await supabase.rpc("admin_settle_courier", { p_courier_id: courierId, p_note: str(fd, "note") || null });
  revalidatePath("/admin/kuryeler");
  if (error) go(back(fd, "/admin/kuryeler"), "hata", em(error));
  const r = data as { orders: number; cash: number; pos: number; fee: number };
  go(back(fd, "/admin/kuryeler"), "ok", `Hesaplaşıldı: ${r.orders} teslimat · nakit ${formatTL(r.cash)} teslim alındı · POS ${formatTL(r.pos)} · hak ediş ${formatTL(r.fee)}`);
}

export async function assignCourier(fd: FormData) {
  const { supabase } = await requireAdmin();
  const orderId = str(fd, "order_id");
  const courierId = str(fd, "courier_id");
  if (!isId(orderId)) return;
  const { error } = await supabase.rpc("admin_assign_courier", { p_order_id: orderId, p_courier_id: isId(courierId) ? courierId : null });
  const url = back(fd, `/admin/siparisler/${orderId}`);
  if (error) go(url, "hata", em(error));
  if (isId(courierId))
    after(async () => {
      try {
        await notifyCourier(supabase, orderId, "atandi");
      } catch (e) {
        console.error("[kurye atama]", e);
      }
    });
  revalidatePath(url);
  redirect(url);
}

export async function clearIssue(fd: FormData) {
  const { supabase } = await requireAdmin();
  const orderId = str(fd, "order_id");
  if (!isId(orderId)) return;
  await supabase.rpc("admin_clear_issue", { p_order_id: orderId });
  const url = back(fd, `/admin/siparisler/${orderId}`);
  revalidatePath(url);
  redirect(url);
}
