-- =====================================================================
-- İki tik:
--   🔵 mavi tik  (verified_customers) → visibility 'onayli' kategoriler (alkol, tütün)
--   🚬 sigara tik (special_customers) → visibility 'ozel'   kategoriler (elektronik)
-- + categories.night_ban: 22:00–06:00 (TR saati) satış yasağı (alkol)
-- =====================================================================
alter table public.categories drop constraint if exists categories_visibility_check;
alter table public.categories add constraint categories_visibility_check
  check (visibility in ('herkes', 'uye', 'onayli', 'ozel', 'kapali'));
alter table public.categories add column if not exists night_ban boolean not null default false;

create table if not exists public.special_customers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.special_customers enable row level security;
create policy special_customers_admin on public.special_customers
  for all using (public.is_admin()) with check (public.is_admin());
create policy special_customers_self on public.special_customers
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
    when 'ozel'   then exists (select 1 from public.special_customers where user_id = auth.uid())
    else false
  end;
$$;

create or replace function public.block_restricted_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h int := extract(hour from (now() at time zone 'Europe/Istanbul'));
begin
  if new.product_id is null or public.is_admin() then return new; end if;
  if not exists (
    select 1 from public.products p where p.id = new.product_id and public.product_visible(p.category_id)
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

update public.categories set visibility = 'onayli', night_ban = (slug = 'alkol-urunleri')
 where slug in ('alkol-urunleri', 'tutun-urunleri');
update public.categories set visibility = 'ozel' where slug = 'elektronik-urunler';
