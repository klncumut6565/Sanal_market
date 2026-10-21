-- Kurye havuzu gizliliği + mesai şartı
-- 1) Kurye doğrudan (Data API) yalnızca KENDİSİNE atanmış açık siparişleri okur. Atanmamış (havuz) siparişler
--    courier_pool() ile kişisel veri olmadan gelir: ad, telefon, açık adres, adres notu, müşteri notu YOK;
--    yalnızca mahalle/ilçe, teslimat zamanı, ödeme türü, tutar ve ürünler. Üstlenince tam bilgi açılır.
-- 2) Mesai dışındaki kurye havuzdan sipariş üstlenemez (yöneticinin atadığı siparişi teslim alabilir).

alter policy orders_courier_read on public.orders
  using (public.is_courier() and status = any (array['hazirlaniyor', 'yolda']) and courier_id = (select auth.uid()));

alter policy order_items_courier_read on public.order_items
  using (public.is_courier() and exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.status = any (array['hazirlaniyor', 'yolda'])
      and o.courier_id = (select auth.uid())
  ));

create or replace function public.courier_pool()
returns jsonb
language sql stable security definer
set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'order_no', o.order_no, 'status', o.status,
    'addr_neighborhood', o.addr_neighborhood, 'addr_district', o.addr_district, 'addr_city', o.addr_city,
    'delivery_slot', o.delivery_slot, 'payment_method', o.payment_method,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'total', o.total,
    'created_at', o.created_at, 'dispatched_at', o.dispatched_at,
    'order_items', coalesce((select jsonb_agg(jsonb_build_object('quantity', i.quantity, 'product_name', i.product_name, 'unit_label', i.unit_label, 'removed', i.removed))
                             from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  ) order by o.created_at), '[]'::jsonb)
  from public.orders o
  where public.is_courier()
    and o.courier_id is null
    and o.status in ('hazirlaniyor', 'yolda')
$$;
revoke all on function public.courier_pool() from public, anon;
grant execute on function public.courier_pool() to authenticated;

create or replace function public.courier_claim(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
declare o public.orders;
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'SIPARIS_YOK'; end if;
  if o.courier_id = auth.uid() then return; end if;
  if o.courier_id is not null then raise exception 'BASKA_KURYEDE'; end if;
  if not exists (select 1 from public.couriers where user_id = auth.uid() and on_duty) then raise exception 'MESAI_KAPALI'; end if;
  if o.status not in ('hazirlaniyor', 'yolda') then raise exception 'SIPARIS_UYGUN_DEGIL'; end if;
  update public.orders set courier_id = auth.uid(), assigned_at = now() where id = p_order_id;
end;
$$;

create or replace function public.courier_pickup(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
declare o public.orders;
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'SIPARIS_YOK'; end if;
  if o.courier_id is null then
    -- Havuzdan doğrudan teslim alma = üstlenme → mesai şartı
    if not exists (select 1 from public.couriers where user_id = auth.uid() and on_duty) then raise exception 'MESAI_KAPALI'; end if;
    update public.orders set courier_id = auth.uid(), assigned_at = now() where id = p_order_id;
  elsif o.courier_id <> auth.uid() then
    raise exception 'BASKA_KURYEDE';
  end if;
  if o.status not in ('hazirlaniyor', 'yolda') then raise exception 'SIPARIS_UYGUN_DEGIL'; end if;
  update public.orders
     set status = 'yolda',
         dispatched_at = coalesce(dispatched_at, now()),
         picked_up_at = coalesce(picked_up_at, now()),
         delivery_issue = null, delivery_issue_at = null
   where id = p_order_id;
end;
$$;
