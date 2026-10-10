export type Category = {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  unit_label: string | null;
  price: number;
  sale_price: number | null;
  stock: number;
  critical_stock: number;
  max_per_order: number;
  image_url: string | null;
  emoji: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
};

export type StoreSettings = {
  store_name: string;
  phone: string | null;
  address: string | null;
  delivery_area_note: string | null;
  delivery_fee: number;
  free_delivery_threshold: number;
  min_order_amount: number;
  delivery_slots: string[];
  working_hours: string | null;
  whatsapp_phone: string | null;
  is_open: boolean;
};

export type OrderStatus = "alindi" | "hazirlaniyor" | "yolda" | "teslim_edildi" | "iptal";
export type PaymentMethod = "kapida_nakit" | "kapida_pos";

export type Order = {
  id: string;
  order_no: number;
  user_id: string | null;
  customer_name: string;
  phone: string;
  address: string;
  address_note: string | null;
  delivery_slot: string;
  payment_method: PaymentMethod;
  payment_status: "beklemede" | "odendi" | "iade";
  status: OrderStatus;
  note: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_label: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};
