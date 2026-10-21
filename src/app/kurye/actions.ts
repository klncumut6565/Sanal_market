"use server";
// Kurye paneli aksiyonları. Tüm yetki ve kurallar veritabanı fonksiyonlarında (is_courier + siparişin sahibi) kontrol edilir.
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, requireCourier } from "@/lib/data/auth";
import { sendPush } from "@/lib/push/server";
import { formatTL } from "@/lib/format";

export type CourierResult = { ok: true; message?: string } | { ok: false; error: string };

const ERR: Record<string, string> = {
  YETKISIZ: "Kurye yetkin yok ya da hesabın pasif. Yöneticiye danış.",
  SIPARIS_YOK: "Sipariş bulunamadı.",
  BASKA_KURYEDE: "Bu sipariş başka bir kuryeye verilmiş.",
  MESAI_KAPALI: "Mesain kapalı. Sipariş almak için önce mesaini başlat.",
  SIPARIS_UYGUN_DEGIL: "Bu sipariş şu an alınamaz (teslim edilmiş ya da iptal).",
  SENIN_DEGIL: "Bu sipariş sana atanmamış.",
  TESLIM_ALINDI: "Paketi teslim aldıktan sonra sipariş bırakılamaz; yöneticiye haber ver.",
  ONCE_TESLIM_AL: "Önce 'Paketi teslim aldım' de.",
  GECERSIZ_TUTAR: "Tahsilat tutarı geçersiz.",
  GECERSIZ_YONTEM: "Tahsilat yöntemi seç (nakit / POS).",
  SIPARIS_KAPALI: "Sipariş kapanmış (teslim edildi ya da iptal).",
  POS_FISI_GEREKLI: "POS ile ödeme varsa en az bir POS fişi fotoğrafı ekle.",
  FIS_TUTARI_UYUSMUYOR: "POS fişlerinin toplamı POS tutarına eşit değil.",
  GECERSIZ_FIS: "Fiş görseli yüklenemedi; tekrar dene.",
  COK_FAZLA_FIS: "En fazla 10 fiş eklenebilir.",
};
const msg = (e: { message?: string } | null) => {
  const k = (e?.message ?? "").split(":")[0].trim();
  return ERR[k] ?? "İşlem yapılamadı. Sayfayı yenileyip tekrar dene.";
};
const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

async function rpc(name: string, args: Record<string, unknown>): Promise<CourierResult> {
  const { supabase } = await requireCourier();
  const { error } = await supabase.rpc(name, args);
  return error ? { ok: false, error: msg(error) } : { ok: true };
}

/** Yöneticilere telefon bildirimi (arka planda) */
function tellAdmins(title: string, body: string, url: string, tag: string) {
  after(async () => {
    try {
      await sendPush("admin", { title, body, url, tag });
    } catch (e) {
      console.error("[kurye→yönetici]", e);
    }
  });
}

export async function setDuty(on: boolean) {
  return rpc("courier_set_duty", { p_on: on });
}

export async function claimOrder(id: string) {
  if (!isId(id)) return { ok: false, error: "Geçersiz sipariş." } as CourierResult;
  return rpc("courier_claim", { p_order_id: id });
}

export async function releaseOrder(id: string) {
  if (!isId(id)) return { ok: false, error: "Geçersiz sipariş." } as CourierResult;
  return rpc("courier_release", { p_order_id: id });
}

export async function pickupOrder(id: string) {
  if (!isId(id)) return { ok: false, error: "Geçersiz sipariş." } as CourierResult;
  return rpc("courier_pickup", { p_order_id: id });
}

export async function deliverOrder(id: string, cash: number, pos: number, note: string, receipts: { path: string; amount: number | null }[]): Promise<CourierResult> {
  if (!isId(id)) return { ok: false, error: "Geçersiz sipariş." };
  const { user, supabase } = await requireCourier();
  // Teslimden sonra kurye siparişi göremez (kişisel veri gizliliği) — gerekli alanlar önceden okunur
  const { data: o } = await supabase.from("orders").select("order_no, total").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("courier_deliver_split", {
    p_order_id: id,
    p_cash: cash,
    p_pos: pos,
    p_note: note || null,
    p_receipts: receipts.slice(0, 10).map((r) => ({ path: r.path, amount: r.amount == null ? "" : String(r.amount) })),
  });
  if (error) return { ok: false, error: msg(error) };
  const got = Math.round((cash + pos) * 100) / 100;
  if (o && Math.abs(Number(o.total) - got) >= 0.01)
    tellAdmins(
      `⚠️ Tahsilat farkı #${o.order_no}`,
      `${user.full_name ?? "Kurye"}: ${formatTL(got)} aldı (nakit ${formatTL(cash)}, POS ${formatTL(pos)}); sipariş ${formatTL(o.total)}.${note ? ` Not: ${note}` : ""}`,
      `/admin/siparisler/${id}`,
      `tahsilat-${o.order_no}`,
    );
  return { ok: true };
}

export async function reportIssue(id: string, reason: string): Promise<CourierResult> {
  if (!isId(id)) return { ok: false, error: "Geçersiz sipariş." };
  const r = reason.trim();
  if (r.length < 3) return { ok: false, error: "Sorunu kısaca yaz ya da seç." };
  const { user, supabase } = await requireCourier();
  const { error } = await supabase.rpc("courier_report_issue", { p_order_id: id, p_reason: r });
  if (error) return { ok: false, error: msg(error) };
  const { data: o } = await supabase.from("orders").select("order_no, customer_name").eq("id", id).maybeSingle();
  tellAdmins(`🚫 Teslim edilemedi #${o?.order_no ?? ""}`, `${user.full_name ?? "Kurye"} · ${o?.customer_name ?? ""}: ${r}`, `/admin/siparisler/${id}`, `sorun-${o?.order_no ?? id}`);
  return { ok: true, message: "Yöneticiye bildirildi." };
}

export async function subscribeCourierPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, device: string) {
  const { supabase } = await requireCourier();
  const { error } = await supabase.rpc("courier_push_subscribe_me", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
    p_device: device,
  });
  return error ? { error: "Bildirim kaydedilemedi." } : {};
}

// ------------------------------------------------------------------ başvuru
export type ApplyState = { error?: string; ok?: string };

export async function applyCourier(_: ApplyState, fd: FormData): Promise<ApplyState> {
  const user = await getSessionUser();
  if (!user) redirect("/giris?kurye=1");
  if (user.isCourier) redirect("/kurye");
  const vehicle = String(fd.get("vehicle") ?? "motosiklet");
  const plate = String(fd.get("plate") ?? "").trim().slice(0, 15);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_courier_access", { p_vehicle: vehicle, p_plate: plate || null });
  if (error) return { error: "Başvuru gönderilemedi. Biraz sonra tekrar dene." };
  if (data === "kurye") redirect("/kurye");
  if (data === "reddedildi") return { error: "Başvurun yakın zamanda reddedildi. Yöneticiyle görüş." };
  tellAdmins("🛵 Yeni kurye başvurusu", `${user.full_name ?? user.email ?? "Bir üye"} kurye olmak istiyor.`, "/admin/kuryeler", "kurye-basvuru");
  return { ok: "Başvurun alındı. Yönetici onaylayınca bu sayfadan kurye paneline geçebilirsin." };
}
