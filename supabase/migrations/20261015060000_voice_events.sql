-- Sesli asistan teşhis kaydı: bağlantı kopması (kod/gerekçe), yeniden bağlanma, süre/sessizlik kapanışı,
-- reddedilen yanlış "kapat" çağrıları. Kişisel veri yok (konuşma metni yazılmaz; yalnızca olay türü ve kısa ayrıntı).
create table if not exists public.voice_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  mode text not null,          -- musteri | admin
  kind text not null,          -- kopma | yeniden_baglandi | yeniden_baglanamadi | sure_doldu | sessizlik | hata | kapat_reddedildi | goaway | bitti
  detail text,
  seconds int
);
create index if not exists voice_events_created_idx on public.voice_events (created_at desc);
alter table public.voice_events enable row level security;
create policy voice_events_admin_read on public.voice_events for select using (public.is_admin());

create or replace function public.voice_log_event(p_mode text, p_kind text, p_detail text, p_seconds int)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- kötüye kullanım sınırı: saatte en fazla 600 kayıt
  if (select count(*) from public.voice_events where created_at > now() - interval '1 hour') >= 600 then return; end if;
  insert into public.voice_events (mode, kind, detail, seconds)
  values (left(coalesce(p_mode, '?'), 10), left(coalesce(p_kind, '?'), 30), left(p_detail, 300), least(greatest(coalesce(p_seconds, 0), 0), 100000));
end;
$$;
revoke all on function public.voice_log_event(text, text, text, int) from public;
grant execute on function public.voice_log_event(text, text, text, int) to anon, authenticated;
