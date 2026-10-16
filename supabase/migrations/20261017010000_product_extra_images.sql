-- Ürün başına birden fazla görsel: image_url = ana (vitrin) görsel, extra_images = ek görseller (en fazla 10)
alter table public.products add column if not exists extra_images text[] not null default '{}';
alter table public.products add constraint products_extra_images_max check (coalesce(array_length(extra_images, 1), 0) <= 10) not valid;
