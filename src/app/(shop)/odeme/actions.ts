"use server";
import { createClient } from "@/lib/supabase/server";
import { orderErrorMessage } from "@/lib/format";
import { normalizeTrMobile } from "@/lib/phone";
import type { PaymentMethod } from "@/lib/types";

export type PlaceOrderInput = {
  items: { product_id: string; quantity: number }[];
  name: string;
  phone: string;
  address: string;
  address_note?: string;
  delivery_slot: string;
  payment_method: PaymentMethod;
  note?: string;
  accepted_terms: boolean;
};

export type PlaceOrderResult =
  | { ok: true; id: string; token: string; orderNo: number }
  | { ok: false; error: string };


export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const phone = normalizeTrMobile(input.phone ?? "");
  if (!input.accepted_terms) return { ok: false, error: "Devam etmek için sözleşmeyi onaylayın." };
  if (!phone) return { ok: false, error: "Geçerli bir cep telefonu girin (ör. +90 541 673 58 63)." };
  if (input.name.trim().length < 3) return { ok: false, error: "Ad soyad girin." };
  if (input.address.trim().length < 10) return { ok: false, error: "Adresi daha ayrıntılı yazın." };
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
      address: input.address.trim().slice(0, 500),
      address_note: input.address_note?.trim().slice(0, 200) ?? "",
      delivery_slot: input.delivery_slot,
      payment_method: input.payment_method,
      note: input.note?.trim().slice(0, 300) ?? "",
    },
  }));
  } catch (e) {
    console.error("[odeme] placeOrder:", e);
    return { ok: false, error: "Sipariş şu an oluşturulamıyor. Lütfen biraz sonra tekrar dene." };
  }

  if (error) return { ok: false, error: orderErrorMessage(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; access_token: string; order_no: number } | undefined;
  if (!row) return { ok: false, error: orderErrorMessage("") };
  return { ok: true, id: row.order_id, token: row.access_token, orderNo: Number(row.order_no) };
}
