-- =====================================================================
-- Sanal Market — başlangıç şeması
-- Tek market · tek katalog · tek stok · tek sipariş sistemi
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Türkçe karakterleri sadeleştiren immutable yardımcı (arama için)
create or replace function public.f_norm(t text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')));
$$;

-- ---------------------------------------------------------------------
-- PROFİLLER & ROLLER
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'customer' check (role in ('customer', 'admin')),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- KATALOG
-- ---------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  emoji       text,
  image_url   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references public.categories (id) on delete set null,
  name            text not null,
  slug            text not null unique,
  description     text,
  unit_label      text,                       -- "1 L", "500 g", "1 kg", "10'lu"
  price           numeric(10,2) not null check (price >= 0),
  sale_price      numeric(10,2) check (sale_price is null or (sale_price >= 0 and sale_price < price)),
  stock           int not null default 0 check (stock >= 0),
  critical_stock  int not null default 5 check (critical_stock >= 0),
  max_per_order   int not null default 20 check (max_per_order > 0),
  image_url       text,
  emoji           text,
  is_active       boolean not null default true,
  is_featured     boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index products_category_idx on public.products (category_id) where is_active;
create index products_name_trgm_idx on public.products using gin (public.f_norm(name) extensions.gin_trgm_ops);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- MARKET AYARLARI (tek satır)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id                       int primary key default 1 check (id = 1),
  store_name               text not null default 'Sanal Market',
  phone                    text,
  address                  text,
  delivery_area_note       text default 'Teslimat bölgesi: merkez mahalleler',
  delivery_fee             numeric(10,2) not null default 29.90,
  free_delivery_threshold  numeric(10,2) not null default 500,
  min_order_amount         numeric(10,2) not null default 150,
  delivery_slots           text[] not null default array[
                             'En kısa sürede',
                             '10:00 - 12:00',
                             '12:00 - 14:00',
                             '14:00 - 16:00',
                             '16:00 - 18:00',
                             '18:00 - 20:00'
                           ],
  is_open                  boolean not null default true,
  updated_at               timestamptz not null default now()
);

insert into public.store_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- SİPARİŞLER
-- ---------------------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_no        bigint generated always as identity (start with 10001) unique,
  user_id         uuid references auth.users (id) on delete set null,
  access_token    uuid not null default gen_random_uuid(),
  customer_name   text not null,
  phone           text not null,
  address         text not null,
  address_note    text,
  delivery_slot   text not null,
  payment_method  text not null check (payment_method in ('kapida_nakit', 'kapida_pos')),
  payment_status  text not null default 'beklemede' check (payment_status in ('beklemede', 'odendi', 'iade')),
  status          text not null default 'alindi'
                    check (status in ('alindi', 'hazirlaniyor', 'yolda', 'teslim_edildi', 'iptal')),
  note            text,
  subtotal        numeric(10,2) not null,
  delivery_fee    numeric(10,2) not null,
  total           numeric(10,2) not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  text not null,
  unit_label    text,
  unit_price    numeric(10,2) not null,   -- sipariş anındaki fiyat
  quantity      int not null check (quantity > 0),
  line_total    numeric(10,2) not null
);

create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

-- profiles: kendi kaydını görür/düzenler; rol alanını DEĞİŞTİREMEZ
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- katalog: herkes aktifleri okur, yönetici her şeyi yönetir
create policy categories_read on public.categories
  for select using (is_active or public.is_admin());
create policy categories_admin on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products
  for select using (is_active or public.is_admin());
create policy products_admin on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy settings_read on public.store_settings
  for select using (true);
create policy settings_admin on public.store_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- siparişler: doğrudan INSERT yok (yalnızca place_order RPC)
create policy orders_read on public.orders
  for select using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_update on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

create policy order_items_read on public.order_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- ARAMA
-- ---------------------------------------------------------------------
create or replace function public.search_products(q text)
returns setof public.products
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from public.products p
  where p.is_active
    and public.f_norm(p.name) like '%' || public.f_norm(q) || '%'
  order by
    (public.f_norm(p.name) like public.f_norm(q) || '%') desc,
    extensions.similarity(public.f_norm(p.name), public.f_norm(q)) desc,
    p.name
  limit 60;
$$;

grant execute on function public.search_products(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- SİPARİŞ OLUŞTURMA (sunucu tarafı doğrulama + atomik stok düşümü)
-- p_items:    [{"product_id":"...","quantity":2}, ...]
-- p_customer: {"name","phone","address","address_note","delivery_slot","payment_method","note"}
-- ---------------------------------------------------------------------
create or replace function public.place_order(p_items jsonb, p_customer jsonb)
returns table (order_id uuid, order_no bigint, access_token uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  s             public.store_settings;
  v_order       public.orders;
  v_subtotal    numeric(10,2) := 0;
  v_fee         numeric(10,2);
  v_line        record;
  v_prod        public.products;
  v_price       numeric(10,2);
  v_name        text  := nullif(trim(p_customer ->> 'name'), '');
  v_phone       text  := nullif(trim(p_customer ->> 'phone'), '');
  v_address     text  := nullif(trim(p_customer ->> 'address'), '');
  v_slot        text  := nullif(trim(p_customer ->> 'delivery_slot'), '');
  v_payment     text  := p_customer ->> 'payment_method';
  v_lines       jsonb := '[]'::jsonb;
begin
  select * into s from public.store_settings where id = 1;
  if not s.is_open then
    raise exception 'MARKET_KAPALI' using errcode = 'P0001';
  end if;

  if v_name is null or v_phone is null or v_address is null then
    raise exception 'EKSIK_BILGI' using errcode = 'P0001';
  end if;
  if v_payment not in ('kapida_nakit', 'kapida_pos') then
    raise exception 'GECERSIZ_ODEME' using errcode = 'P0001';
  end if;
  if v_slot is null or not (v_slot = any (s.delivery_slots)) then
    raise exception 'GECERSIZ_SAAT' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'SEPET_BOS' using errcode = 'P0001';
  end if;

  -- Aynı ürün birden fazla kez gelirse topla; kilit sırası sabit olsun diye id'ye göre sırala
  for v_line in
    select (e ->> 'product_id')::uuid as product_id,
           sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_line.qty is null or v_line.qty < 1 then
      raise exception 'GECERSIZ_ADET' using errcode = 'P0001';
    end if;

    -- Atomik stok düşümü: stok yetmezse satır güncellenmez
    update public.products p
       set stock = p.stock - v_line.qty
     where p.id = v_line.product_id
       and p.is_active
       and p.stock >= v_line.qty
       and v_line.qty <= p.max_per_order
    returning p.* into v_prod;

    if not found then
      select * into v_prod from public.products where id = v_line.product_id;
      if v_prod.id is null or not v_prod.is_active then
        raise exception 'URUN_YOK' using errcode = 'P0001';
      elsif v_line.qty > v_prod.max_per_order then
        raise exception 'LIMIT_ASILDI:%', v_prod.name using errcode = 'P0001';
      else
        raise exception 'STOK_YETERSIZ:%', v_prod.name using errcode = 'P0001';
      end if;
    end if;

    v_price    := coalesce(v_prod.sale_price, v_prod.price);
    v_subtotal := v_subtotal + v_price * v_line.qty;
    v_lines    := v_lines || jsonb_build_object(
                    'product_id', v_prod.id,
                    'product_name', v_prod.name,
                    'unit_label', v_prod.unit_label,
                    'unit_price', v_price,
                    'quantity', v_line.qty
                  );
  end loop;

  if v_subtotal < s.min_order_amount then
    raise exception 'MIN_TUTAR:%', s.min_order_amount using errcode = 'P0001';
  end if;

  v_fee := case when v_subtotal >= s.free_delivery_threshold then 0 else s.delivery_fee end;

  insert into public.orders (
    user_id, customer_name, phone, address, address_note, delivery_slot,
    payment_method, note, subtotal, delivery_fee, total
  ) values (
    auth.uid(), v_name, v_phone, v_address,
    nullif(trim(p_customer ->> 'address_note'), ''), v_slot,
    v_payment, nullif(trim(p_customer ->> 'note'), ''),
    v_subtotal, v_fee, v_subtotal + v_fee
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit_label, unit_price, quantity, line_total)
  select v_order.id,
         (l ->> 'product_id')::uuid,
         l ->> 'product_name',
         l ->> 'unit_label',
         (l ->> 'unit_price')::numeric,
         (l ->> 'quantity')::int,
         (l ->> 'unit_price')::numeric * (l ->> 'quantity')::int
  from jsonb_array_elements(v_lines) l;

  return query select v_order.id, v_order.order_no, v_order.access_token;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- MİSAFİR SİPARİŞ TAKİBİ (id + erişim anahtarı ile)
-- ---------------------------------------------------------------------
create or replace function public.get_order_public(p_order_id uuid, p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order', to_jsonb(o) - 'access_token' - 'user_id',
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.product_name)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id and o.access_token = p_token;
$$;

revoke all on function public.get_order_public(uuid, uuid) from public;
grant execute on function public.get_order_public(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- YÖNETİCİ: SİPARİŞ DURUMU (iptalde stok iadesi)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_admin() then
    raise exception 'YETKISIZ' using errcode = '42501';
  end if;
  if p_status not in ('alindi', 'hazirlaniyor', 'yolda', 'teslim_edildi', 'iptal') then
    raise exception 'GECERSIZ_DURUM' using errcode = 'P0001';
  end if;

  select status into v_old from public.orders where id = p_order_id for update;
  if v_old is null then
    raise exception 'SIPARIS_YOK' using errcode = 'P0001';
  end if;
  if v_old in ('iptal', 'teslim_edildi') then
    raise exception 'SIPARIS_KAPALI' using errcode = 'P0001';
  end if;

  if p_status = 'iptal' then
    update public.products p
       set stock = p.stock + i.quantity
      from public.order_items i
     where i.order_id = p_order_id and i.product_id = p.id;
  end if;

  update public.orders
     set status = p_status,
         payment_status = case when p_status = 'teslim_edildi' then 'odendi' else payment_status end
   where id = p_order_id;
end;
$$;

revoke all on function public.admin_set_order_status(uuid, text) from public;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- STORAGE: ürün görselleri (herkes okur, yönetici yazar)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product images public read" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "product images admin insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin update" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());
