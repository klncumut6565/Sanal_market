-- Kategori şeridindeki "N ürün" sayıları: tüm ürün listesini indirmeden, kategori başına aktif ürün adedi (yalnızca sayı).
create or replace function public.category_product_counts()
returns table (category_id uuid, n int)
language sql stable security definer
set search_path = public as $$
  select category_id, count(*)::int from products where is_active and category_id is not null group by category_id
$$;
grant execute on function public.category_product_counts() to anon, authenticated;
