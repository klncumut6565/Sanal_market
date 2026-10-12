-- =====================================================================
-- Yönetici yetkisi talepleri + yetki verme
-- "Yönetici girişi" ekranından giriş yapan yönetici olmayan kullanıcı talep oluşturur.
-- Yetkiyi YALNIZCA kurucu (sahip) hesap verir/kaldırır; kurucunun yetkisi kaldırılamaz.
-- =====================================================================
create table if not exists public.app_owner (
  id      boolean primary key default true check (id),
  user_id uuid not null references auth.users (id)
);
alter table public.app_owner enable row level security;
create policy app_owner_admin_read on public.app_owner for select using (public.is_admin());
insert into public.app_owner (user_id) values ('0fb948a0-47a9-41eb-a139-25fd0f588a09')
  on conflict (id) do nothing;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_owner where user_id = auth.uid());
$$;

create table if not exists public.admin_requests (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  status       text not null default 'bekliyor' check (status in ('bekliyor', 'onaylandi', 'reddedildi')),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz
);
alter table public.admin_requests enable row level security;
create policy admin_requests_admin_read on public.admin_requests for select using (public.is_admin());
create policy admin_requests_self_read on public.admin_requests for select using (user_id = (select auth.uid()));

-- Yönetici olmayan oturum sahibi talep oluşturur (reddedilmişse yeniden bekliyor'a alınır)
create or replace function public.request_admin_access()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'GIRIS_GEREKLI'; end if;
  if public.is_admin() then return 'admin'; end if;
  insert into public.admin_requests (user_id) values (auth.uid())
  on conflict (user_id) do update set status = 'bekliyor', requested_at = now(), decided_at = null;
  return 'bekliyor';
end;
$$;
revoke all on function public.request_admin_access() from public, anon;
grant execute on function public.request_admin_access() to authenticated;

-- Kurucu: yetki ver / kaldır / talebi reddet
create or replace function public.owner_set_admin(p_user_id uuid, p_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'YALNIZCA_KURUCU'; end if;
  if exists (select 1 from public.app_owner where user_id = p_user_id) and not p_admin then
    raise exception 'KURUCU_KORUNUR';
  end if;
  update public.profiles set role = case when p_admin then 'admin' else 'customer' end where id = p_user_id;
  if not found then raise exception 'KULLANICI_YOK'; end if;
  update public.admin_requests
     set status = case when p_admin then 'onaylandi' else 'reddedildi' end, decided_at = now()
   where user_id = p_user_id;
end;
$$;
revoke all on function public.owner_set_admin(uuid, boolean) from public, anon;
grant execute on function public.owner_set_admin(uuid, boolean) to authenticated;

-- Yönetim ekranı için: talepler ve yöneticiler e-postalarıyla (auth.users'a doğrudan erişim yok)
create or replace function public.admin_access_overview()
returns table (user_id uuid, email text, full_name text, phone text, role text, request_status text, requested_at timestamptz, is_owner boolean)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, p.full_name, p.phone, p.role, r.status, r.requested_at,
         exists (select 1 from public.app_owner o where o.user_id = u.id)
    from auth.users u
    join public.profiles p on p.id = u.id
    left join public.admin_requests r on r.user_id = u.id
   where public.is_admin() and (p.role = 'admin' or r.user_id is not null)
   order by (r.status = 'bekliyor') desc nulls last, r.requested_at desc nulls last, u.email;
$$;
revoke all on function public.admin_access_overview() from public, anon;
grant execute on function public.admin_access_overview() to authenticated;

-- E-postayla kullanıcı bul (kurucu doğrudan yetki verebilsin)
create or replace function public.owner_find_user(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id from auth.users u where public.is_owner() and lower(u.email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.owner_find_user(text) from public, anon;
grant execute on function public.owner_find_user(text) to authenticated;
