-- =====================================================================
-- Mağaza tarafı görünürlük ("müşteri gözüyle"): yönetici istisnası YOK.
-- RLS'teki is_admin() istisnası yönetim paneli için kalır; mağaza (vitrin, arama,
-- sesli asistan, sipariş) yöneticiyi de tik durumuna göre normal müşteri sayar.
-- =====================================================================
create or replace function public.shop_category_visible(v text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce(v, 'herkes')
    when 'herkes' then true
    when 'uye'    then auth.uid() is not null
    when 'onayli' then exists (select 1 from public.verified_customers where user_id = auth.uid())
    when 'ozel'   then exists (select 1 from public.special_customers where user_id = auth.uid())
    else false
  end;
$$;

create or replace function public.shop_product_visible(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select cid is null or exists (
    select 1 from public.categories c where c.id = cid and c.is_active and public.shop_category_visible(c.visibility)
  );
$$;

-- Oturumdaki kişinin mağazada görebildiği kategoriler
create or replace function public.shop_categories()
returns setof public.categories
language sql
stable
set search_path = public
as $$
  select c.* from public.categories c
   where c.is_active and public.shop_category_visible(c.visibility)
   order by c.sort_order, c.name;
$$;

-- Ürün araması (yalnızca mağaza kullanır): müşteri gözüyle
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
    and public.shop_product_visible(p.category_id)
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

-- Sipariş kalemi: kişi KENDİ siparişini veriyorsa (yönetici dahil) müşteri kuralı uygulanır.
-- Yönetici başkasının siparişinde ürün değişimi yapıyorsa kural uygulanmaz.
create or replace function public.block_restricted_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h int := extract(hour from (now() at time zone 'Europe/Istanbul'));
begin
  if new.product_id is null then return new; end if;
  if public.is_admin() and not exists (
    select 1 from public.orders o where o.id = new.order_id and o.user_id = auth.uid()
  ) then
    return new;
  end if;
  if not exists (
    select 1 from public.products p where p.id = new.product_id and public.shop_product_visible(p.category_id)
  ) then
    raise exception 'URUN_KISITLI' using errcode = 'P0001';
  end if;
  if (h >= 22 or h < 6) and exists (
    select 1 from public.products p join public.categories c on c.id = p.category_id
     where p.id = new.product_id and c.night_ban
  ) then
    raise exception 'GECE_SATIS_YASAGI' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
