-- Kara liste: sorunlu müşteriler sipariş veremez (telefon ve/veya üyelik bazında)
create table if not exists public.customer_blacklist (
  phone      text primary key,           -- +905xxxxxxxxx biçiminde
  user_id    uuid references auth.users (id) on delete set null,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists customer_blacklist_user_idx on public.customer_blacklist (user_id);
alter table public.customer_blacklist enable row level security;
create policy customer_blacklist_admin on public.customer_blacklist
  for all using (public.is_admin()) with check (public.is_admin());

-- Sipariş eklenmeden önce kontrol (place_order dahil her yol). Hata tüm işlemi
-- (stok düşümü dahil) geri alır.
create or replace function public.block_blacklisted_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.customer_blacklist b
     where b.phone = new.phone or (new.user_id is not null and b.user_id = new.user_id)
  ) then
    raise exception 'MUSTERI_ENGELLI' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger orders_block_blacklisted
  before insert on public.orders
  for each row execute function public.block_blacklisted_order();
