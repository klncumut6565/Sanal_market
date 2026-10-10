-- Sipariş aşama zamanları + aşama hedef süreleri (SLA)
alter table public.orders
  add column if not exists preparing_at  timestamptz,
  add column if not exists dispatched_at timestamptz,
  add column if not exists delivered_at  timestamptz,
  add column if not exists cancelled_at  timestamptz;

alter table public.store_settings
  add column if not exists sla_accept_min   int not null default 2  check (sla_accept_min > 0),
  add column if not exists sla_prepare_min  int not null default 7  check (sla_prepare_min > 0),
  add column if not exists sla_delivery_min int not null default 20 check (sla_delivery_min > 0);

create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_admin() then
    raise exception 'YETKISIZ' using errcode = '42501';
  end if;
  if p_status not in ('alindi', 'hazirlaniyor', 'yolda', 'teslim_edildi', 'iptal') then
    raise exception 'GECERSIZ_DURUM' using errcode = 'P0001';
  end if;

  select status into v_old from public.orders where id = p_order_id for update;
  if v_old is null then
    raise exception 'SIPARIS_YOK' using errcode = 'P0001';
  end if;
  if v_old in ('iptal', 'teslim_edildi') then
    raise exception 'SIPARIS_KAPALI' using errcode = 'P0001';
  end if;

  if p_status = 'iptal' then
    update public.products p
       set stock = p.stock + i.quantity
      from public.order_items i
     where i.order_id = p_order_id and i.product_id = p.id;
  end if;

  update public.orders
     set status = p_status,
         payment_status = case when p_status = 'teslim_edildi' then 'odendi' else payment_status end,
         preparing_at  = case when p_status = 'hazirlaniyor'  then coalesce(preparing_at, now()) else preparing_at end,
         dispatched_at = case when p_status = 'yolda'         then coalesce(dispatched_at, now()) else dispatched_at end,
         delivered_at  = case when p_status = 'teslim_edildi' then coalesce(delivered_at, now()) else delivered_at end,
         cancelled_at  = case when p_status = 'iptal'         then now() else cancelled_at end
   where id = p_order_id;
end;
$$;

revoke all on function public.admin_set_order_status(uuid, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;
