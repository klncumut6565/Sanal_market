-- 1) KİŞİSEL VERİ GİZLİLİĞİ: kurye, teslim edilen / iptal edilen siparişlerin müşteri bilgilerini (ad, telefon, adres,
--    not, ürünler) artık göremez. orders / order_items okuma izni yalnızca açık (hazırlanan / yoldaki) siparişler için.
--    Geçmiş ve kasa ekranı courier_history() ile yalnızca anonim alanları (no, mahalle, tutar, zaman) alır.
alter policy orders_courier_read on public.orders using (
  public.is_courier() and status in ('hazirlaniyor', 'yolda')
  and (courier_id = (select auth.uid()) or courier_id is null)
);
alter policy order_items_courier_read on public.order_items using (
  public.is_courier() and exists (
    select 1 from public.orders o
     where o.id = order_items.order_id and o.status in ('hazirlaniyor', 'yolda')
       and (o.courier_id = (select auth.uid()) or o.courier_id is null)
  )
);

-- Kuryenin teslim geçmişi — müşteri adı, telefonu ve açık adresi YOK; yalnızca mahalle
create or replace function public.courier_history(p_from timestamptz, p_to timestamptz, p_unsettled boolean default false)
returns table (id uuid, order_no bigint, area text, payment_method text, total numeric, collected_method text, collected_amount numeric,
               courier_note text, dispatched_at timestamptz, picked_up_at timestamptz, delivered_at timestamptz, settlement_id bigint)
language sql stable security definer set search_path to 'public' as $$
  select o.id, o.order_no, coalesce(nullif(o.addr_neighborhood, ''), 'Teslimat'), o.payment_method, o.total, o.collected_method, o.collected_amount,
         o.courier_note, o.dispatched_at, o.picked_up_at, o.delivered_at, o.settlement_id
    from public.orders o
   where public.is_courier() and o.courier_id = auth.uid() and o.status = 'teslim_edildi'
     and (case when p_unsettled then o.settlement_id is null
               else o.delivered_at >= p_from and o.delivered_at < p_to end)
   order by o.delivered_at desc
   limit 2000;
$$;
grant execute on function public.courier_history(timestamptz, timestamptz, boolean) to authenticated;

-- 2) KURYE KONUM TAKİBİ: yalnızca kurye MESAİDEYKEN telefonundan gönderilir. Son konum couriers'ta,
--    yoldaki siparişler sırasında iz (rota) courier_track'te tutulur. Yalnızca yöneticiler görür.
alter table public.couriers add column if not exists last_lat double precision;
alter table public.couriers add column if not exists last_lng double precision;
alter table public.couriers add column if not exists last_accuracy real;
alter table public.couriers add column if not exists last_speed real;
alter table public.couriers add column if not exists last_heading real;
alter table public.couriers add column if not exists last_loc_at timestamptz;

create table if not exists public.courier_track (
  id bigint generated always as identity primary key,
  courier_id uuid not null references public.couriers (user_id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  accuracy real
);
create index if not exists courier_track_idx on public.courier_track (courier_id, at desc);
create index if not exists courier_track_order_idx on public.courier_track (order_id, at);
alter table public.courier_track enable row level security;
create policy courier_track_admin_read on public.courier_track for select using (public.is_admin());

create or replace function public.courier_update_location(p_lat double precision, p_lng double precision, p_accuracy real, p_speed real, p_heading real)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c public.couriers; o uuid;
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'GECERSIZ_KONUM'; end if;
  select * into c from public.couriers where user_id = auth.uid();
  if not c.on_duty then raise exception 'MESAI_KAPALI'; end if;
  -- en fazla 10 sn'de bir kayıt (cihaz çok sık gönderirse)
  if c.last_loc_at is not null and c.last_loc_at > now() - interval '10 seconds' then return; end if;
  update public.couriers
     set last_lat = p_lat, last_lng = p_lng, last_accuracy = p_accuracy, last_speed = p_speed, last_heading = p_heading, last_loc_at = now()
   where user_id = auth.uid();
  -- yoldaki siparişi varsa rota izine ekle
  select id into o from public.orders where courier_id = auth.uid() and status = 'yolda' order by picked_up_at nulls last limit 1;
  if o is not null then
    insert into public.courier_track (courier_id, order_id, lat, lng, accuracy) values (auth.uid(), o, p_lat, p_lng, p_accuracy);
  end if;
end;
$$;
grant execute on function public.courier_update_location(double precision, double precision, real, real, real) to authenticated;

-- Mola / mesai kapanınca konum paylaşımı da biter: son konum silinmez (yönetici "son görülme" görür)
