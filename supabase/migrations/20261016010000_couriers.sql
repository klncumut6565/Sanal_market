-- KURYE ROLÜ VE PANELİ
-- Kurye = couriers tablosunda aktif kaydı olan üye (profiles.role değişmez; müşteri olarak da alışveriş yapabilir).
-- Akış: üye "Kurye girişi"nden başvurur → yönetici onaylar → kurye paneli açılır.
-- Sipariş: yönetici atar (ya da kurye havuzdan üstlenir) → kurye "Teslim aldım" (yolda) → "Teslim ettim" (nakit/POS, tutar)
-- → üzerindeki nakit yöneticiye teslim edilince "hesaplaşma" kaydı oluşur.

create table if not exists public.couriers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  vehicle text not null default 'motosiklet' check (vehicle in ('motosiklet', 'bisiklet', 'otomobil', 'yaya', 'diger')),
  plate text,
  per_delivery_fee numeric(10, 2) not null default 0 check (per_delivery_fee >= 0),
  is_active boolean not null default true,
  on_duty boolean not null default false,
  duty_changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.courier_applications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'bekliyor' check (status in ('bekliyor', 'onaylandi', 'reddedildi')),
  vehicle text,
  plate text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.courier_settlements (
  id bigint generated always as identity primary key,
  courier_id uuid not null references public.couriers (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  order_count int not null default 0,
  cash_amount numeric(12, 2) not null default 0,
  pos_amount numeric(12, 2) not null default 0,
  fee_amount numeric(12, 2) not null default 0,
  note text
);
create index if not exists courier_settlements_courier_idx on public.courier_settlements (courier_id, created_at desc);

alter table public.orders add column if not exists courier_id uuid references public.couriers (user_id) on delete set null;
alter table public.orders add column if not exists assigned_at timestamptz;
alter table public.orders add column if not exists picked_up_at timestamptz;
alter table public.orders add column if not exists collected_method text check (collected_method in ('nakit', 'pos'));
alter table public.orders add column if not exists collected_amount numeric(12, 2);
alter table public.orders add column if not exists courier_note text;
alter table public.orders add column if not exists delivery_issue text;
alter table public.orders add column if not exists delivery_issue_at timestamptz;
alter table public.orders add column if not exists settlement_id bigint references public.courier_settlements (id) on delete set null;
create index if not exists orders_courier_idx on public.orders (courier_id, status, delivered_at desc);

alter table public.push_subscriptions add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- ------------------------------------------------------------------ yardımcılar
create or replace function public.is_courier()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.couriers where user_id = auth.uid() and is_active);
$$;
grant execute on function public.is_courier() to anon, authenticated;

-- ------------------------------------------------------------------ RLS
alter table public.couriers enable row level security;
alter table public.courier_applications enable row level security;
alter table public.courier_settlements enable row level security;

create policy couriers_read on public.couriers for select using (user_id = (select auth.uid()) or public.is_admin());
create policy courier_app_read on public.courier_applications for select using (user_id = (select auth.uid()) or public.is_admin());
create policy courier_settle_read on public.courier_settlements for select using (courier_id = (select auth.uid()) or public.is_admin());

-- Kurye: kendine atanan siparişler + havuz (atanmamış, hazırlanan/yoldaki)
create policy orders_courier_read on public.orders for select using (
  public.is_courier() and (courier_id = (select auth.uid()) or (courier_id is null and status in ('hazirlaniyor', 'yolda')))
);
create policy order_items_courier_read on public.order_items for select using (
  public.is_courier() and exists (
    select 1 from public.orders o
     where o.id = order_items.order_id
       and (o.courier_id = (select auth.uid()) or (o.courier_id is null and o.status in ('hazirlaniyor', 'yolda')))
  )
);

-- ------------------------------------------------------------------ başvuru / onay
create or replace function public.request_courier_access(p_vehicle text default null, p_plate text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'GIRIS_GEREKLI'; end if;
  if public.is_courier() then return 'kurye'; end if;
  insert into public.courier_applications (user_id, vehicle, plate)
  values (auth.uid(), left(p_vehicle, 20), left(upper(p_plate), 15))
  on conflict (user_id) do update
     set status = case when courier_applications.status = 'reddedildi' and courier_applications.decided_at > now() - interval '1 day'
                       then 'reddedildi' else 'bekliyor' end,
         vehicle = coalesce(excluded.vehicle, courier_applications.vehicle),
         plate = coalesce(excluded.plate, courier_applications.plate),
         requested_at = case when courier_applications.status = 'bekliyor' then courier_applications.requested_at else now() end;
  return (select status from public.courier_applications where user_id = auth.uid());
end;
$$;
grant execute on function public.request_courier_access(text, text) to authenticated;

create or replace function public.admin_courier_overview()
returns table (user_id uuid, email text, full_name text, phone text, app_status text, requested_at timestamptz,
               app_vehicle text, app_plate text, is_courier boolean, is_active boolean, on_duty boolean,
               vehicle text, plate text, per_delivery_fee numeric, duty_changed_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select u.id, u.email::text, coalesce(c.full_name, p.full_name), coalesce(c.phone, p.phone), a.status, a.requested_at,
         a.vehicle, a.plate, c.user_id is not null, coalesce(c.is_active, false), coalesce(c.on_duty, false),
         c.vehicle, c.plate, c.per_delivery_fee, c.duty_changed_at
    from auth.users u
    join public.profiles p on p.id = u.id
    left join public.courier_applications a on a.user_id = u.id
    left join public.couriers c on c.user_id = u.id
   where public.is_admin() and (a.user_id is not null or c.user_id is not null)
   order by (a.status = 'bekliyor' and c.user_id is null) desc, c.is_active desc nulls last, coalesce(c.full_name, p.full_name);
$$;
grant execute on function public.admin_courier_overview() to authenticated;

create or replace function public.admin_courier_decide(p_user_id uuid, p_approve boolean, p_fee numeric default 0)
returns void language plpgsql security definer set search_path to 'public' as $$
declare a public.courier_applications;
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  select * into a from public.courier_applications where user_id = p_user_id;
  if p_approve then
    insert into public.couriers (user_id, full_name, phone, vehicle, plate, per_delivery_fee)
    select p.id, p.full_name, p.phone,
           case when a.vehicle in ('motosiklet', 'bisiklet', 'otomobil', 'yaya', 'diger') then a.vehicle else 'motosiklet' end,
           a.plate, greatest(coalesce(p_fee, 0), 0)
      from public.profiles p where p.id = p_user_id
    on conflict (user_id) do update set is_active = true;
    if not found then raise exception 'KULLANICI_YOK'; end if;
  else
    update public.couriers set is_active = false, on_duty = false where user_id = p_user_id;
  end if;
  update public.courier_applications
     set status = case when p_approve then 'onaylandi' else 'reddedildi' end, decided_at = now()
   where user_id = p_user_id;
end;
$$;
grant execute on function public.admin_courier_decide(uuid, boolean, numeric) to authenticated;

create or replace function public.admin_courier_update(p_user_id uuid, p_fee numeric, p_vehicle text, p_plate text, p_phone text, p_active boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  update public.couriers
     set per_delivery_fee = greatest(coalesce(p_fee, per_delivery_fee), 0),
         vehicle = case when p_vehicle in ('motosiklet', 'bisiklet', 'otomobil', 'yaya', 'diger') then p_vehicle else vehicle end,
         plate = nullif(left(upper(trim(coalesce(p_plate, plate))), 15), ''),
         phone = coalesce(nullif(trim(p_phone), ''), phone),
         is_active = coalesce(p_active, is_active),
         on_duty = case when p_active = false then false else on_duty end
   where user_id = p_user_id;
  if not found then raise exception 'KURYE_YOK'; end if;
end;
$$;
grant execute on function public.admin_courier_update(uuid, numeric, text, text, text, boolean) to authenticated;

-- ------------------------------------------------------------------ atama
create or replace function public.admin_assign_courier(p_order_id uuid, p_courier_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_status text;
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'SIPARIS_YOK'; end if;
  if v_status in ('teslim_edildi', 'iptal') then raise exception 'SIPARIS_KAPALI'; end if;
  if p_courier_id is not null and not exists (select 1 from public.couriers where user_id = p_courier_id and is_active) then
    raise exception 'KURYE_YOK';
  end if;
  update public.orders
     set courier_id = p_courier_id,
         assigned_at = case when p_courier_id is null then null else now() end,
         picked_up_at = case when p_courier_id is distinct from courier_id then null else picked_up_at end
   where id = p_order_id;
end;
$$;
grant execute on function public.admin_assign_courier(uuid, uuid) to authenticated;

-- "Hazır · Kuryeye ver": kurye atanmamışsa ve mesaide TEK aktif kurye varsa ona ata (atanan id döner)
create or replace function public.admin_auto_assign(p_order_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_cur uuid; v_one uuid; v_n int;
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  select courier_id into v_cur from public.orders where id = p_order_id;
  if v_cur is not null then return v_cur; end if;
  select count(*), min(user_id::text)::uuid into v_n, v_one from public.couriers where is_active and on_duty;
  if v_n <> 1 then return null; end if;
  update public.orders set courier_id = v_one, assigned_at = now()
   where id = p_order_id and courier_id is null and status in ('hazirlaniyor', 'yolda');
  return v_one;
end;
$$;
grant execute on function public.admin_auto_assign(uuid) to authenticated;

-- ------------------------------------------------------------------ kurye işlemleri
create or replace function public.courier_set_duty(p_on boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  update public.couriers set on_duty = p_on, duty_changed_at = now() where user_id = auth.uid();
  return p_on;
end;
$$;
grant execute on function public.courier_set_duty(boolean) to authenticated;

create or replace function public.courier_claim(p_order_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare o public.orders;
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'SIPARIS_YOK'; end if;
  if o.courier_id = auth.uid() then return; end if;
  if o.courier_id is not null then raise exception 'BASKA_KURYEDE'; end if;
  if o.status not in ('hazirlaniyor', 'yolda') then raise exception 'SIPARIS_UYGUN_DEGIL'; end if;
  update public.orders set courier_id = auth.uid(), assigned_at = now() where id = p_order_id;
end;
$$;
grant execute on function public.courier_claim(uuid) to authenticated;

create or replace function public.courier_release(p_order_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare o public.orders;
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.courier_id is distinct from auth.uid() then raise exception 'SENIN_DEGIL'; end if;
  if o.picked_up_at is not null then raise exception 'TESLIM_ALINDI'; end if;
  update public.orders set courier_id = null, assigned_at = null where id = p_order_id;
end;
$$;
grant execute on function public.courier_release(uuid) to authenticated;

-- Marketten paketi aldı → "Yolda"
create or replace function public.courier_pickup(p_order_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare o public.orders;
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'SIPARIS_YOK'; end if;
  if o.courier_id is null then
    update public.orders set courier_id = auth.uid(), assigned_at = now() where id = p_order_id;
  elsif o.courier_id <> auth.uid() then
    raise exception 'BASKA_KURYEDE';
  end if;
  if o.status not in ('hazirlaniyor', 'yolda') then raise exception 'SIPARIS_UYGUN_DEGIL'; end if;
  update public.orders
     set status = 'yolda',
         dispatched_at = coalesce(dispatched_at, now()),
         picked_up_at = coalesce(picked_up_at, now()),
         delivery_issue = null, delivery_issue_at = null
   where id = p_order_id;
end;
$$;
grant execute on function public.courier_pickup(uuid) to authenticated;

-- Teslim etti: tahsilat yöntemi + tutar
create or replace function public.courier_deliver(p_order_id uuid, p_method text, p_amount numeric, p_note text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare o public.orders;
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  if p_method not in ('nakit', 'pos') then raise exception 'GECERSIZ_YONTEM'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'SIPARIS_YOK'; end if;
  if o.courier_id is distinct from auth.uid() then raise exception 'SENIN_DEGIL'; end if;
  if o.status = 'teslim_edildi' then return; end if;
  if o.status <> 'yolda' then raise exception 'ONCE_TESLIM_AL'; end if;
  if p_amount is null or p_amount < 0 or p_amount > o.total * 3 + 100 then raise exception 'GECERSIZ_TUTAR'; end if;
  update public.orders
     set status = 'teslim_edildi',
         payment_status = 'odendi',
         delivered_at = now(),
         collected_method = p_method,
         collected_amount = round(p_amount, 2),
         courier_note = nullif(left(trim(coalesce(p_note, '')), 300), ''),
         delivery_issue = null, delivery_issue_at = null
   where id = p_order_id;
end;
$$;
grant execute on function public.courier_deliver(uuid, text, numeric, text) to authenticated;

-- Teslim edilemedi: sipariş açık kalır, yönetici karar verir
create or replace function public.courier_report_issue(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare o public.orders;
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.courier_id is distinct from auth.uid() then raise exception 'SENIN_DEGIL'; end if;
  if o.status in ('teslim_edildi', 'iptal') then raise exception 'SIPARIS_KAPALI'; end if;
  update public.orders set delivery_issue = left(trim(p_reason), 300), delivery_issue_at = now() where id = p_order_id;
end;
$$;
grant execute on function public.courier_report_issue(uuid, text) to authenticated;

-- Yönetici: sorunu kapat (tekrar denenecek)
create or replace function public.admin_clear_issue(p_order_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  update public.orders set delivery_issue = null, delivery_issue_at = null where id = p_order_id;
end;
$$;
grant execute on function public.admin_clear_issue(uuid) to authenticated;

-- ------------------------------------------------------------------ hesaplaşma
-- Kuryenin hesaplaşılmamış teslimatlarını kapatır: nakit/POS toplamı + hak ediş (teslimat başı ücret)
create or replace function public.admin_settle_courier(p_courier_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint; v_n int; v_cash numeric; v_pos numeric; v_fee numeric;
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  select count(*), coalesce(sum(collected_amount) filter (where collected_method = 'nakit'), 0),
         coalesce(sum(collected_amount) filter (where collected_method = 'pos'), 0)
    into v_n, v_cash, v_pos
    from public.orders
   where courier_id = p_courier_id and status = 'teslim_edildi' and settlement_id is null and collected_method is not null;
  if v_n = 0 then raise exception 'HESAPLASACAK_YOK'; end if;
  select v_n * per_delivery_fee into v_fee from public.couriers where user_id = p_courier_id;
  insert into public.courier_settlements (courier_id, created_by, order_count, cash_amount, pos_amount, fee_amount, note)
  values (p_courier_id, auth.uid(), v_n, v_cash, v_pos, coalesce(v_fee, 0), nullif(left(trim(coalesce(p_note, '')), 300), ''))
  returning id into v_id;
  update public.orders set settlement_id = v_id
   where courier_id = p_courier_id and status = 'teslim_edildi' and settlement_id is null and collected_method is not null;
  return jsonb_build_object('id', v_id, 'orders', v_n, 'cash', v_cash, 'pos', v_pos, 'fee', coalesce(v_fee, 0));
end;
$$;
grant execute on function public.admin_settle_courier(uuid, text) to authenticated;

-- ------------------------------------------------------------------ bildirim
create or replace function public.courier_push_subscribe_me(p_endpoint text, p_p256dh text, p_auth text, p_device text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, role, device, user_id)
  values (p_endpoint, p_p256dh, p_auth, 'kurye', left(p_device, 200), auth.uid())
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, role = 'kurye', dead = false,
    device = excluded.device, user_id = auth.uid();
end;
$$;
grant execute on function public.courier_push_subscribe_me(text, text, text, text) to authenticated;

-- Belirli kuryenin cihazları (p_user_id) ya da null → mesaideki tüm kuryeler + eski gizli bağlantılı cihazlar
create or replace function public.push_targets_courier(p_secret text, p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare n public.notify_settings;
begin
  select * into n from public.notify_settings where id = 1;
  if p_secret is null or p_secret <> n.webhook_secret then raise exception 'YETKISIZ'; end if;
  return jsonb_build_object(
    'vapid_private', n.vapid_private,
    'subs', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s
       where s.role = 'kurye' and not s.dead
         and (case when p_user_id is not null then s.user_id = p_user_id
                   else s.user_id is null or exists (select 1 from public.couriers c where c.user_id = s.user_id and c.is_active and c.on_duty) end)
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.push_targets_courier(text, uuid) to anon, authenticated;
