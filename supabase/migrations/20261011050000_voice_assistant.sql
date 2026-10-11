-- Sesli asistan: aç/kapa ayarı + kötüye kullanım sınırı
alter table public.store_settings
  add column if not exists voice_enabled         boolean not null default true,
  add column if not exists voice_daily_limit     int     not null default 300 check (voice_daily_limit >= 0),
  add column if not exists voice_hourly_per_user int     not null default 8   check (voice_hourly_per_user >= 0);

create table if not exists public.voice_sessions (
  id         bigint generated always as identity primary key,
  client_key text not null,          -- IP'nin özeti (ham IP saklanmaz)
  created_at timestamptz not null default now()
);
create index if not exists voice_sessions_key_idx on public.voice_sessions (client_key, created_at desc);
create index if not exists voice_sessions_time_idx on public.voice_sessions (created_at desc);
alter table public.voice_sessions enable row level security;
create policy voice_sessions_admin_read on public.voice_sessions for select using (public.is_admin());

-- Oturum açılabilir mi? (açıksa kaydı da düşer) → 'ok' | 'kapali' | 'saatlik' | 'gunluk'
create or replace function public.voice_session_allow(p_client_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.store_settings;
  v_user int;
  v_all  int;
begin
  select * into s from public.store_settings where id = 1;
  if not s.voice_enabled then return 'kapali'; end if;
  if p_client_key is null or length(p_client_key) < 8 then return 'saatlik'; end if;
  select count(*) into v_user from public.voice_sessions where client_key = p_client_key and created_at > now() - interval '1 hour';
  if v_user >= s.voice_hourly_per_user then return 'saatlik'; end if;
  select count(*) into v_all from public.voice_sessions where created_at > now() - interval '1 day';
  if v_all >= s.voice_daily_limit then return 'gunluk'; end if;
  insert into public.voice_sessions (client_key) values (p_client_key);
  return 'ok';
end;
$$;

revoke all on function public.voice_session_allow(text) from public;
grant execute on function public.voice_session_allow(text) to anon, authenticated;
