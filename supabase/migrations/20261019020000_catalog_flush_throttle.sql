-- Vitrin (ana sayfa + kategori sayfaları) önbelleğini en fazla 30 dakikada bir yenilemek için zamanlayıcı.
-- Ürün düzenlemeleri ürün sayfasını anında yeniler; genel vitrin yenilemesi biriktirilir.
create table if not exists public.cache_flush (
  key text primary key,
  last_flush timestamptz not null default 'epoch',
  pending boolean not null default false
);
alter table public.cache_flush enable row level security;
insert into public.cache_flush(key) values ('catalog') on conflict do nothing;

-- p_mode: 'request' (değişiklik oldu: süre dolduysa hemen yenile, dolmadıysa beklemeye al)
--         'due'     (bekleyen var ve süre dolduysa yenile)
--         'force'   (hemen yenile)
create or replace function public.catalog_flush(p_mode text default 'request', p_minutes int default 30)
returns boolean
language plpgsql security definer
set search_path = public as $$
declare r public.cache_flush; due boolean;
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  select * into r from public.cache_flush where key = 'catalog' for update;
  due := r.last_flush < now() - make_interval(mins => greatest(p_minutes, 1));
  if p_mode = 'force' or (p_mode = 'request' and due) or (p_mode = 'due' and r.pending and due) then
    update public.cache_flush set last_flush = now(), pending = false where key = 'catalog';
    return true;
  end if;
  if p_mode = 'request' then
    update public.cache_flush set pending = true where key = 'catalog';
  end if;
  return false;
end;
$$;
revoke all on function public.catalog_flush(text, int) from public, anon;
grant execute on function public.catalog_flush(text, int) to authenticated;
