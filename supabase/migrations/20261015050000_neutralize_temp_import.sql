-- Excel içe aktarmada kullanılan geçici public._imp fonksiyonu etkisizleştirildi (gövde yalnızca hata verir,
-- yalnızca veritabanı sahibi çağırabilir). Tamamen silmek için Supabase SQL editöründe:
--   drop function if exists public._imp(jsonb);
create or replace function public._imp(p jsonb) returns text language plpgsql set search_path = public as $$
begin
  raise exception 'Bu geçici içe aktarma fonksiyonu devre dışı bırakıldı (2026-10-15).';
end;
$$;
revoke all on function public._imp(jsonb) from public, anon, authenticated, service_role;
