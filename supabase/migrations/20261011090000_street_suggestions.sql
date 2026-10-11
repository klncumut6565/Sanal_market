-- Müşterilerin elle yazdığı sokak önerileri: admin "yoksay" dediklerini hatırla
create table if not exists public.delivery_street_ignored (
  neighborhood_id int  not null references public.delivery_neighborhoods (id) on delete cascade,
  name_key        text not null,  -- küçük harf, boşlukları sadeleştirilmiş ad
  created_at      timestamptz not null default now(),
  primary key (neighborhood_id, name_key)
);
alter table public.delivery_street_ignored enable row level security;
create policy dsi_admin on public.delivery_street_ignored
  for all using (public.is_admin()) with check (public.is_admin());
