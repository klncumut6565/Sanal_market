-- Mükerrer ürün tespiti
--   norm_barcode : barkodun karşılaştırma biçimi (yalnız harf/rakam, büyük harf, baştaki sıfırlar atılır).
--                  Böylece "0869..." ile "869...", "8690 504 ..." ile "8690504..." aynı sayılır.
--   name_key     : adın karşılaştırma biçimi (Türkçe karakter/büyük-küçük/boşluk/noktalama farkı yok).
--   products_barcode_norm_key : aynı barkodun farklı yazımla ikinci kez kaydedilmesini engeller.
--   find_product_duplicates   : ürün formunda yazarken "bu barkod / bu ad zaten var" uyarısı (yalnız admin).
create or replace function public.norm_barcode(t text)
returns text language sql immutable parallel safe
as $$ select nullif(ltrim(upper(regexp_replace(coalesce(t, ''), '[^0-9A-Za-z]', '', 'g')), '0'), '') $$;

create or replace function public.name_key(t text)
returns text language sql immutable parallel safe
set search_path = public
as $$ select regexp_replace(public.f_norm(t), '[^a-z0-9]', '', 'g') $$;

create unique index if not exists products_barcode_norm_key on public.products (public.norm_barcode(barcode))
  where public.norm_barcode(barcode) is not null;
create index if not exists products_name_key_idx on public.products (public.name_key(name));

create or replace function public.find_product_duplicates(p_id uuid, p_barcode text, p_name text)
returns table (id uuid, name text, barcode text, is_active boolean, match text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.barcode, p.is_active,
         case when public.norm_barcode(p.barcode) = public.norm_barcode(p_barcode) then 'barkod' else 'ad' end
  from public.products p
  where public.is_admin()
    and (p_id is null or p.id <> p_id)
    and (
      (public.norm_barcode(p_barcode) is not null and public.norm_barcode(p.barcode) = public.norm_barcode(p_barcode))
      or (length(public.name_key(p_name)) >= 3 and public.name_key(p.name) = public.name_key(p_name))
    )
  order by 5 desc, p.name
  limit 10;
$$;
revoke all on function public.find_product_duplicates(uuid, text, text) from public, anon;
grant execute on function public.find_product_duplicates(uuid, text, text) to authenticated;
