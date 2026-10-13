-- Mağaza modu: Otomatik (çalışma saatleri) / Açık (saat dışında da sipariş) / Kapalı
--   Kapalı  → is_open = false
--   Açık    → is_open = true, force_open = true (çalışma saati kontrolü atlanır)
--   Otomatik→ is_open = true, force_open = false
alter table public.store_settings add column if not exists force_open boolean not null default false;

create or replace function public.store_is_open_now(p_grace_min int default 0)
returns boolean
language sql
stable
set search_path = public
as $$
  with s as (
    select is_open, force_open,
           split_part(open_time, ':', 1)::int * 60 + split_part(open_time, ':', 2)::int  as o,
           split_part(close_time, ':', 1)::int * 60 + split_part(close_time, ':', 2)::int as c
    from public.store_settings where id = 1
  ), n as (
    select extract(hour from (now() at time zone 'Europe/Istanbul'))::int * 60
         + extract(minute from (now() at time zone 'Europe/Istanbul'))::int as m
  )
  select s.is_open and (s.force_open or case
    when s.o = s.c then true
    when s.o < s.c then n.m >= s.o and n.m < s.c + p_grace_min
    else n.m >= s.o or n.m < s.c + p_grace_min
  end)
  from s, n;
$$;
