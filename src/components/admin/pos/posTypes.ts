export type PosProduct = {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  sale_price: number | null;
  stock: number;
  category_id: string | null;
  unit_label: string | null;
  image_url: string | null;
  emoji: string | null;
  is_active: boolean;
};

export type PosLine = {
  key: string;
  product_id: string | null;
  name: string;
  barcode: string | null;
  price: number;
  qty: number;
  stock?: number;
};

export type PosStore = { name: string; address: string | null; phone: string | null };

export type PosSaleRow = {
  id: string;
  sale_no: number;
  created_at: string;
  total: number;
  subtotal: number;
  discount: number;
  payment: "nakit" | "kart" | "karisik";
  cash_amount: number;
  card_amount: number;
  paid: number;
  change_due: number;
  cost_total: number | null;
  item_count: number;
  voided_at: string | null;
  pos_sale_items: { product_name: string; quantity: number; unit_price: number; line_total: number }[];
};

export const PAY_LABEL = { nakit: "Nakit", kart: "Kart", karisik: "Nakit + Kart" } as const;

export const unitPrice = (p: Pick<PosProduct, "price" | "sale_price">) => Number(p.sale_price ?? p.price);
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Aramada Türkçe karakter/büyük-küçük farkını yok say */
export { fold } from "@/lib/trFold";

export const POS_ERR: Record<string, string> = {
  YETKISIZ: "Bu işlem için yönetici girişi gerekli.",
  SEPET_BOS: "Fiş boş.",
  ODEME_EKSIK: "Alınan tutar toplamdan az.",
  ODEME_GECERSIZ: "Ödeme türü geçersiz.",
  KALEM_GECERSIZ: "Fişte geçersiz miktar veya fiyat var.",
  URUN_YOK: "Fişteki bir ürün artık sistemde yok.",
  FIS_YOK: "Fiş bulunamadı veya zaten iptal edilmiş.",
};
export const posError = (m: string) => {
  const k = Object.keys(POS_ERR).find((x) => m.includes(x));
  return k ? POS_ERR[k] : "İşlem yapılamadı: " + m;
};
