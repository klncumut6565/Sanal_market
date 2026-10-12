-- Ürün araması kategori adını da kapsasın ("alkol" → Alkol Ürünleri kategorisindeki rakı).
-- Önce ürün adı eşleşmeleri, sonra yalnızca kategori adı eşleşenler gelir.
create or replace function public.search_products(q text)
returns setof public.products
language sql
stable
set search_path = public
as $$
  select p.*
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.is_active
    and (
      public.f_norm(p.name) like '%' || public.f_norm(q) || '%'
      or (c.is_active and public.f_norm(c.name) like '%' || public.f_norm(q) || '%')
    )
  order by
    (public.f_norm(p.name) like '%' || public.f_norm(q) || '%') desc,
    (public.f_norm(p.name) like public.f_norm(q) || '%') desc,
    extensions.similarity(public.f_norm(p.name), public.f_norm(q)) desc,
    p.name
  limit 60;
$$;
