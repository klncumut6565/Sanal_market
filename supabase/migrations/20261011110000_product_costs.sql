-- =====================================================================
-- Alış fiyatı (maliyet) ve kâr marjı
-- Maliyet AYRI tabloda: products herkese açık okunur, alış fiyatı yalnızca admin görür.
-- Siparişte o anki maliyet order_item_costs tablosuna yazılır (sonradan maliyet değişse de
-- geçmiş kâr raporu doğru kalır).
-- =====================================================================
create table if not exists public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost_price numeric(10,2) not null check (cost_price >= 0),
  updated_at timestamptz not null default now()
);
alter table public.product_costs enable row level security;
create policy product_costs_admin on public.product_costs
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.product_costs from anon;

-- Sipariş kalemi maliyeti de ayrı tabloda (order_items müşteriye kendi siparişi için açık)
create table if not exists public.order_item_costs (
  order_item_id uuid primary key references public.order_items (id) on delete cascade,
  unit_cost     numeric(10,2) not null
);
alter table public.order_item_costs enable row level security;
create policy order_item_costs_admin on public.order_item_costs
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.order_item_costs from anon;

-- Her yeni sipariş kalemi eklendiğinde o anki alış fiyatını kaydet
-- (place_order ve "rafta yok → başka ürün" değişimi dahil; fonksiyonlara dokunmadan)
create or replace function public.snapshot_order_item_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    insert into public.order_item_costs (order_item_id, unit_cost)
    select new.id, pc.cost_price from public.product_costs pc where pc.product_id = new.product_id
    on conflict (order_item_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.snapshot_order_item_cost() from public, anon, authenticated;

create trigger order_items_cost_snapshot
  after insert on public.order_items
  for each row execute function public.snapshot_order_item_cost();
