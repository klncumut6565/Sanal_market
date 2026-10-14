-- Ürün bilgisinin (ad, barkod, fiyat, birim, görsel, açıklama) en son ne zaman değiştiği.
-- updated_at her stok düşümünde de değiştiği için "eski / güncel olmayan ürün" ayırmaya uygun değil;
-- bu sütun yalnızca bilgi değişince ilerler (stok, aktiflik, kategori, sıra değişimi saymaz).
alter table public.products add column if not exists info_updated_at timestamptz;
update public.products set info_updated_at = created_at where info_updated_at is null;
alter table public.products alter column info_updated_at set default now();
alter table public.products alter column info_updated_at set not null;
create index if not exists products_info_updated_idx on public.products (info_updated_at);

create or replace function public.products_touch_info()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.name, new.barcode, new.price, new.sale_price, new.unit_label, new.image_url, new.description)
     is distinct from
     (old.name, old.barcode, old.price, old.sale_price, old.unit_label, old.image_url, old.description) then
    new.info_updated_at := now();
  else
    new.info_updated_at := old.info_updated_at;
  end if;
  return new;
end;
$$;

create or replace trigger products_touch_info before update on public.products
  for each row execute function public.products_touch_info();
