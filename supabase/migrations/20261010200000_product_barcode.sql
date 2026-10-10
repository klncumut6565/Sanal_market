-- Ürün barkodu (EAN-13 vb.) — barkodla hızlı fiyat/stok güncelleme için
alter table public.products add column if not exists barcode text;
create unique index if not exists products_barcode_key on public.products (barcode) where barcode is not null;

-- Deneme ayarları (2026-10-10): WhatsApp deneme numarası, teslimat ücreti 130 TL
update public.store_settings set whatsapp_phone = '+905416735863', delivery_fee = 130 where id = 1;
