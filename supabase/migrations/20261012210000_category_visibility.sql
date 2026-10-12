-- =====================================================================
-- Kategori görünürlüğü + onaylı (tikli) müşteri
--   herkes : tüm ziyaretçiler
--   uye    : yalnızca giriş yapmış üyeler
--   onayli : yalnızca yönetimin tik verdiği üyeler (ör. Elektronik)
--   kapali : hiçbir müşteri görmez/sipariş edemez (ör. alkol, tütün — online satış yasak)
-- Kural RLS ile uygulanır (vitrin, arama, sesli asistan); sipariş de tetikleyiciyle engellenir.
-- =====================================================================
alter table public.categories
  add column if not exists visibility text not null default 'herkes'
  check (visibility in ('herkes', 'uye', 'onayli', 'kapali'));

-- Tik bilgisi AYRI tabloda: profiles satırını müşteri kendisi güncelleyebildiği için oraya konmaz.
create table if not exists public.verified_customers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.verified_customers enable row level security;
create policy verified_customers_admin on public.verified_customers
  for all using (public.is_admin()) with check (public.is_admin());
create policy verified_customers_self on public.verified_customers
  for select using (user_id = (select auth.uid()));

create or replace function public.category_visible(v text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or case coalesce(v, 'herkes')
    when 'herkes' then true
    when 'uye'    then auth.uid() is not null
    when 'onayli' then exists (select 1 from public.verified_customers where user_id = auth.uid())
    else false
  end;
$$;

create or replace function public.product_visible(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select cid is null or exists (
    select 1 from public.categories c where c.id = cid and public.category_visible(c.visibility)
  );
$$;

alter policy categories_read on public.categories
  using ((is_active and public.category_visible(visibility)) or public.is_admin());
alter policy products_read on public.products
  using ((is_active and public.product_visible(category_id)) or public.is_admin());

-- Sipariş kalemi: müşteri göremediği kategorideki ürünü sipariş edemez (place_order dahil)
create or replace function public.block_restricted_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null and not public.is_admin() and not exists (
    select 1 from public.products p where p.id = new.product_id and public.product_visible(p.category_id)
  ) then
    raise exception 'URUN_KISITLI' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.block_restricted_items() from public, anon, authenticated;

create trigger order_items_block_restricted
  before insert on public.order_items
  for each row execute function public.block_restricted_items();

-- Başlangıç: alkol ve tütün kapalı (mevzuat), elektronik yalnızca onaylı üyelere
update public.categories set visibility = 'kapali' where slug in ('alkol-urunleri', 'tutun-urunleri');
update public.categories set visibility = 'onayli' where slug = 'elektronik-urunler';
