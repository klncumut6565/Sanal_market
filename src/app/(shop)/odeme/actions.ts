"use server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyOrderPlaced } from "@/lib/orderNotify";
import { orderErrorMessage } from "@/lib/format";
import { normalizeTrMobile } from "@/lib/phone";
import type { PaymentMethod } from "@/lib/types";

export type PlaceOrderInput = {
  items: { product_id: string; quantity: number }[];
  name: string;
  phone: string;
  address: {
    district_id: string;
    neighborhood_id: string;
    street_id: string;
    street_text: string;
    door_no: string;
    inner_no: string;
    building: string;
  };
  address_note?: string;
  delivery_slot: string;
  payment_method: PaymentMethod;
  note?: string;
  accepted_terms: boolean;
  /** Ödeme ekranı başına bir kez üretilir; tekrar gönderimde aynı sipariş döner. */
  client_order_id: string;
};

/** Sözleşme / aydınlatma metni değiştiğinde güncelle (siparişe kaydedilir). */
const TERMS_VERSION = "2026-10-11";

export type PlaceOrderResult =
  | { ok: true; id: string; token: string; orderNo: number }
  | { ok: false; error: string };


export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const phone = normalizeTrMobile(input.phone ?? "");
  if (!input.accepted_terms) return { ok: false, error: "Devam etmek için sözleşmeyi onaylayın." };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID.test(input.client_order_id ?? "")) return { ok: false, error: "Sayfayı yenileyip tekrar dene." };
  if (!phone) return { ok: false, error: "Geçerli bir cep telefonu girin (ör. +90 541 673 58 63)." };
  if (input.name.trim().length < 3) return { ok: false, error: "Ad soyad girin." };
  const a = input.address;
  if (!a?.neighborhood_id) return { ok: false, error: "Teslimat adresi için mahalle seçin." };
  const otherStreet = !a.street_id || a.street_id === "__other";
  if (otherStreet ? (a.street_text ?? "").trim().length < 2 : !/^\d+$/.test(a.street_id))
    return { ok: false, error: "Cadde / sokak seçin veya yazın." };
  if (!(a.door_no ?? "").trim()) return { ok: false, error: "Dış kapı numarasını girin." };
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 100)
    return { ok: false, error: "Sepetiniz boş." };

  const items = input.items
    .filter((i) => typeof i.product_id === "string" && Number.isInteger(i.quantity) && i.quantity > 0)
    .map((i) => ({ product_id: i.product_id, quantity: i.quantity }));

  let data: unknown, error: { message: string } | null;
  try {
    const supabase = await createClient();
    ({ data, error } = await supabase.rpc("place_order", {
    p_items: items,
    p_customer: {
      name: input.name.trim().slice(0, 120),
      phone,
      district_id: a.district_id,
      neighborhood_id: a.neighborhood_id,
      street_id: otherStreet ? "" : a.street_id,
      street_text: otherStreet ? a.street_text.trim().slice(0, 120) : "",
      door_no: a.door_no.trim().slice(0, 10),
      inner_no: (a.inner_no ?? "").trim().slice(0, 10),
      building: (a.building ?? "").trim().slice(0, 80),
      address_note: input.address_note?.trim().slice(0, 200) ?? "",
      delivery_slot: input.delivery_slot,
      payment_method: input.payment_method,
      note: input.note?.trim().slice(0, 300) ?? "",
      accepted_terms: true,
      terms_version: TERMS_VERSION,
      client_order_id: input.client_order_id,
    },
  }));
  } catch (e) {
    console.error("[odeme] placeOrder:", e);
    return { ok: false, error: "Sipariş şu an oluşturulamıyor. Lütfen biraz sonra tekrar dene." };
  }

  if (error) return { ok: false, error: orderErrorMessage(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; access_token: string; order_no: number } | undefined;
  if (!row) return { ok: false, error: orderErrorMessage("") };
  // Yönetici telefon bildirimi + (panel kapalıysa) e-posta/WhatsApp — yanıtı geciktirmeden
  after(() => notifyOrderPlaced(row, input.name.trim()));
  return { ok: true, id: row.order_id, token: row.access_token, orderNo: Number(row.order_no) };
}
