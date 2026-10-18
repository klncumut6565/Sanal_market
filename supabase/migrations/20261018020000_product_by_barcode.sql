-- Barkodla ürün bulma: benzersizlik kuralı (products_barcode_norm_key) ile AYNI karşılaştırma.
-- Önceden arama birebir eşleşmeyle yapılıyordu: kayıtlı "0123…" (EAN-13) ile okunan "123…" (UPC-A)
-- eşleşmiyor, ama yeni ürün eklerken benzersizlik kuralı "bu barkod kayıtlı" diyordu.
create or replace function public.product_by_barcode(p_code text)
returns setof public.products
language sql stable security invoker
set search_path = public as $$
  select * from public.products
  where public.norm_barcode(barcode) = public.norm_barcode(p_code)
    and public.norm_barcode(p_code) is not null
  limit 1
$$;

grant execute on function public.product_by_barcode(text) to authenticated;
