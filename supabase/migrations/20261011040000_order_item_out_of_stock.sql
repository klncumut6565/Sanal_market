-- Hazırlık sırasında rafta olmayan ürün: siparişten çıkar / başka ürünle değiştir
alter table public.order_items
  add column if not exists removed        boolean not null default false,
  add column if not exists removed_reason text,
  add column if not exists replaced_from  text;

create or replace function public.admin_order_item_out(
  p_item_id      uuid,
  p_replacement  uuid default null,
  p_qty          int  default null,
  p_mark_out     boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   public.order_items;
  v_order  public.orders;
  v_prod   public.products;
  v_set    public.store_settings;
  v_price  numeric(10,2);
  v_sub    numeric(10,2);
  v_fee    numeric(10,2);
begin
  if not public.is_admin() then
    raise exception 'YETKISIZ' using errcode = '42501';
  end if;

  select * into v_item from public.order_items where id = p_item_id;
  if v_item.id is null or v_item.removed then
    raise exception 'KALEM_YOK' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = v_item.order_id for update;
  if v_order.status not in ('alindi', 'hazirlaniyor') then
    raise exception 'SIPARIS_KILITLI' using errcode = 'P0001';
  end if;

  -- Rafta yok: sistemde de tükendi yap (başka müşteri sipariş edemesin)
  if p_mark_out and v_item.product_id is not null then
    update public.products set stock = 0 where id = v_item.product_id;
  end if;

  update public.order_items set removed = true, removed_reason = 'stokta_yok' where id = v_item.id;

  if p_replacement is not null then
    if p_qty is null or p_qty < 1 then
      raise exception 'GECERSIZ_ADET' using errcode = 'P0001';
    end if;
    update public.products p
       set stock = p.stock - p_qty
     where p.id = p_replacement and p.is_active and p.stock >= p_qty
    returning p.* into v_prod;
    if v_prod.id is null then
      raise exception 'STOK_YETERSIZ' using errcode = 'P0001';
    end if;
    v_price := coalesce(v_prod.sale_price, v_prod.price);
    insert into public.order_items (order_id, product_id, product_name, unit_label, unit_price, quantity, line_total, replaced_from)
    values (v_order.id, v_prod.id, v_prod.name, v_prod.unit_label, v_price, p_qty, v_price * p_qty, v_item.product_name);
  end if;

  select coalesce(sum(line_total), 0) into v_sub from public.order_items where order_id = v_order.id and not removed;
  if v_sub <= 0 then
    raise exception 'SIPARIS_BOS' using errcode = 'P0001';
  end if;
  select * into v_set from public.store_settings where id = 1;
  -- Teslimat ücreti müşteri aleyhine artmaz
  v_fee := least(v_order.delivery_fee, case when v_sub >= v_set.free_delivery_threshold then 0 else v_set.delivery_fee end);

  update public.orders set subtotal = v_sub, delivery_fee = v_fee, total = v_sub + v_fee where id = v_order.id;
end;
$$;

revoke all on function public.admin_order_item_out(uuid, uuid, int, boolean) from public, anon;
grant execute on function public.admin_order_item_out(uuid, uuid, int, boolean) to authenticated;

-- İptalde stok iadesi: çıkarılmış (rafta olmayan) kalemler iade edilmez
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
     where i.order_id = p_order_id and i.product_id = p.id and not i.removed;
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
