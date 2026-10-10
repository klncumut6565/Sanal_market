-- İşletmenin WhatsApp numarası (müşteri sipariş sayfasında "WhatsApp'tan bize yaz")
alter table public.store_settings add column if not exists whatsapp_phone text;
