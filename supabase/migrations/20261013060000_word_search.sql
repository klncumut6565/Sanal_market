-- Kelime bazlı, Türkçe karakter duyarsız ürün araması.
-- Sorun: ilike '%yeni rakı%' → "YENİ RAKI" bulunamıyordu (İ/ı küçük harf dönüşümü) ve tam ifade
-- aranınca "yeni rakı 70'lik" gibi konuşma dili sorguları hiçbir şey döndürmüyordu.
-- Çözüm: f_norm (unaccent + lower) ile her kelime ayrı aranır; en çok kelimesi eşleşen en üstte.

create or replace function public.search_tokens(q text)
returns text[]
language sql
immutable
set search_path = public, extensions
as $$
  select coalesce(array_agg(w), '{}')
  from (
    select distinct w
    from regexp_split_to_table(regexp_replace(public.f_norm(q), '[^a-z0-9]+', ' ', 'g'), '\s+') w
    where length(w) >= 2 and w not in ('lik','lık','luk','lük','li','lı','lu','lü','adet','tane','kac','stok','stokta','var','mi','mı','ne','kadar','fiyat','fiyati','urun')
  ) x;
$$;

-- Yönetici sesli asistanı / panel: pasifler dahil, maliyetle
create or replace function public.admin_search_products(q text, lim int default 15)
returns table (
  id uuid, name text, unit_label text, price numeric, sale_price numeric, stock int, critical_stock int,
  is_active boolean, barcode text, cost_price numeric, matched int
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare toks text[] := public.search_tokens(q); nq text := public.f_norm(q);
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  return query
  select p.id, p.name, p.unit_label, p.price, p.sale_price, p.stock, p.critical_stock, p.is_active, p.barcode, pc.cost_price,
         (select count(*)::int from unnest(toks) t where public.f_norm(p.name) like '%' || t || '%') as matched
  from public.products p
  left join public.product_costs pc on pc.product_id = p.id
  where (p.barcode is not null and p.barcode = regexp_replace(q, '\s', '', 'g'))
     or exists (select 1 from unnest(toks) t where public.f_norm(p.name) like '%' || t || '%')
  order by
    (p.barcode = regexp_replace(q, '\s', '', 'g')) desc nulls last,
    matched desc,
    (public.f_norm(p.name) like nq || '%') desc,
    extensions.similarity(public.f_norm(p.name), nq) desc,
    p.is_active desc,
    p.name
  limit greatest(1, least(lim, 50));
end;
$$;
revoke all on function public.admin_search_products(text, int) from public, anon;
grant execute on function public.admin_search_products(text, int) to authenticated;

-- Mağaza araması (müşteri, sesli asistan): aynı kelime mantığı, yalnızca müşterinin görebildikleri
create or replace function public.search_products(q text)
returns setof public.products
language sql
stable
set search_path = public
as $$
  with t as (select public.search_tokens(q) toks, public.f_norm(q) nq)
  select p.*
  from public.products p
  left join public.categories c on c.id = p.category_id, t
  where p.is_active
    and public.shop_product_visible(p.category_id)
    and (
      exists (select 1 from unnest(t.toks) w where public.f_norm(p.name) like '%' || w || '%')
      or (c.is_active and exists (select 1 from unnest(t.toks) w where public.f_norm(c.name) like '%' || w || '%'))
      or public.f_norm(p.name) like '%' || t.nq || '%'
      or p.barcode = trim(q)
    )
  order by
    (select count(*) from unnest(t.toks) w where public.f_norm(p.name) like '%' || w || '%') desc,
    (public.f_norm(p.name) like '%' || t.nq || '%') desc,
    (public.f_norm(p.name) like t.nq || '%') desc,
    extensions.similarity(public.f_norm(p.name), t.nq) desc,
    p.name
  limit 60;
$$;
