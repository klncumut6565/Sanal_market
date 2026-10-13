-- =====================================================================
-- Mağaza içi satış ekranı (POS / kasa)
--   pos_sales       : fiş (nakit / kart / karışık), indirim, ödenen, para üstü, maliyet
--   pos_sale_items  : fiş kalemleri (ürün anlık adı/fiyatı/maliyeti; serbest kalem ürünsüz)
--   pos_complete_sale : fişi kaydeder, stoktan düşer (stok 0'ın altına inmez, eksik not edilir)
--   pos_void_sale     : fişi iptal eder, stoğu geri ekler
-- Yalnızca yöneticiler (is_admin).
-- =====================================================================
create table if not exists public.pos_sales (
  id            uuid primary key default gen_random_uuid(),
  sale_no       bigint generated always as identity (start with 1),
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  subtotal      numeric(12,2) not null,
  discount      numeric(12,2) not null default 0,
  total         numeric(12,2) not null,
  payment       text not null check (payment in ('nakit','kart','karisik')),
  cash_amount   numeric(12,2) not null default 0,
  card_amount   numeric(12,2) not null default 0,
  paid          numeric(12,2) not null default 0,
  change_due    numeric(12,2) not null default 0,
  cost_total    numeric(12,2),
  item_count    integer not null default 0,
  note          text,
  voided_at     timestamptz,
  voided_by     uuid references auth.users(id) on delete set null
);
create index if not exists pos_sales_created_idx on public.pos_sales (created_at desc);

create table if not exists public.pos_sale_items (
  id           bigint generated always as identity primary key,
  sale_id      uuid not null references public.pos_sales(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  barcode      text,
  unit_price   numeric(12,2) not null,
  quantity     numeric(12,3) not null check (quantity > 0),
  line_total   numeric(12,2) not null,
  cost_price   numeric(12,2),
  stock_short  integer not null default 0
);
create index if not exists pos_sale_items_sale_idx on public.pos_sale_items (sale_id);
create index if not exists pos_sale_items_product_idx on public.pos_sale_items (product_id);

alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;
create policy pos_sales_admin on public.pos_sales for select using ((select public.is_admin()));
create policy pos_sale_items_admin on public.pos_sale_items for select using ((select public.is_admin()));

create or replace function public.pos_complete_sale(
  p_items jsonb, p_payment text, p_cash numeric, p_card numeric, p_discount numeric, p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_no bigint;
  v_sub numeric := 0;
  v_cost numeric := 0;
  v_cost_known boolean := true;
  v_total numeric;
  v_paid numeric;
  v_count integer := 0;
  it jsonb;
  v_pid uuid;
  v_qty numeric;
  v_price numeric;
  v_name text;
  v_bc text;
  v_c numeric;
  v_stock integer;
  v_short integer;
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  if p_payment not in ('nakit','kart','karisik') then raise exception 'ODEME_GECERSIZ'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'SEPET_BOS'; end if;

  insert into public.pos_sales (created_by, subtotal, discount, total, payment, note)
  values (auth.uid(), 0, 0, 0, p_payment, nullif(trim(coalesce(p_note,'')), ''))
  returning id, sale_no into v_id, v_no;

  for it in select * from jsonb_array_elements(p_items) loop
    v_pid := nullif(it->>'product_id','')::uuid;
    v_qty := (it->>'qty')::numeric;
    v_price := round((it->>'price')::numeric, 2);
    if v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 then raise exception 'KALEM_GECERSIZ'; end if;
    v_name := coalesce(nullif(trim(it->>'name'),''), 'Ürün');
    v_bc := nullif(it->>'barcode','');
    v_c := null;
    v_short := 0;
    if v_pid is not null then
      select p.name, p.barcode, p.stock into v_name, v_bc, v_stock from public.products p where p.id = v_pid for update;
      if not found then raise exception 'URUN_YOK'; end if;
      select cost_price into v_c from public.product_costs where product_id = v_pid;
      v_short := greatest(0, ceil(v_qty)::int - v_stock);
      update public.products set stock = greatest(0, stock - ceil(v_qty)::int) where id = v_pid;
    end if;
    if v_c is null then v_cost_known := false; else v_cost := v_cost + v_c * v_qty; end if;
    insert into public.pos_sale_items (sale_id, product_id, product_name, barcode, unit_price, quantity, line_total, cost_price, stock_short)
    values (v_id, v_pid, v_name, v_bc, v_price, v_qty, round(v_price * v_qty, 2), v_c, v_short);
    v_sub := v_sub + round(v_price * v_qty, 2);
    v_count := v_count + ceil(v_qty)::int;
  end loop;

  v_total := greatest(0, v_sub - greatest(0, coalesce(p_discount, 0)));
  v_paid := coalesce(p_cash, 0) + coalesce(p_card, 0);
  if p_payment = 'kart' then v_paid := v_total; end if;
  if v_paid + 0.001 < v_total then raise exception 'ODEME_EKSIK'; end if;

  update public.pos_sales set
    subtotal = v_sub,
    discount = v_sub - v_total,
    total = v_total,
    cash_amount = case when p_payment = 'kart' then 0 else coalesce(p_cash, 0) end,
    card_amount = case when p_payment = 'kart' then v_total else coalesce(p_card, 0) end,
    paid = v_paid,
    change_due = greatest(0, v_paid - v_total),
    cost_total = case when v_cost_known then round(v_cost, 2) end,
    item_count = v_count
  where id = v_id;

  return jsonb_build_object('id', v_id, 'sale_no', v_no, 'total', v_total, 'paid', v_paid, 'change', greatest(0, v_paid - v_total));
end;
$$;
revoke all on function public.pos_complete_sale(jsonb, text, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.pos_complete_sale(jsonb, text, numeric, numeric, numeric, text) to authenticated;

create or replace function public.pos_void_sale(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  if not exists (select 1 from public.pos_sales where id = p_id and voided_at is null) then raise exception 'FIS_YOK'; end if;
  update public.pos_sales set voided_at = now(), voided_by = auth.uid() where id = p_id;
  for r in select product_id, quantity, stock_short from public.pos_sale_items where sale_id = p_id and product_id is not null loop
    update public.products set stock = stock + greatest(0, ceil(r.quantity)::int - r.stock_short) where id = r.product_id;
  end loop;
end;
$$;
revoke all on function public.pos_void_sale(uuid) from public, anon;
grant execute on function public.pos_void_sale(uuid) to authenticated;
