-- =====================================================================
-- Kod incelemesi düzeltmeleri:
--  1) Sipariş idempotency (client_order_id) — ağ kopması/tekrar basışta çift sipariş yok
--  2) Sözleşme onayının kalıcı kaydı (terms_accepted_at, terms_version)
--  3) Sipariş durumları yalnızca sırayla ilerler (alindi→hazirlaniyor→yolda→teslim_edildi) ya da iptal
--  4) Ürün değiştirmede sipariş başına adet sınırı
--  5) Sesli asistan oturum sınırı atomik (advisory lock)
-- =====================================================================

alter table public.orders
  add column if not exists client_order_id   uuid,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text;
create unique index if not exists orders_client_order_id_key on public.orders (client_order_id);

create or replace function public.place_order(p_items jsonb, p_customer jsonb)
returns table (order_id uuid, order_no bigint, access_token uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  s             public.store_settings;
  v_order       public.orders;
  v_subtotal    numeric(10,2) := 0;
  v_fee         numeric(10,2);
  v_line        record;
  v_prod        public.products;
  v_price       numeric(10,2);
  v_name        text  := nullif(trim(p_customer ->> 'name'), '');
  v_phone       text  := nullif(trim(p_customer ->> 'phone'), '');
  v_slot        text  := nullif(trim(p_customer ->> 'delivery_slot'), '');
  v_payment     text  := p_customer ->> 'payment_method';
  v_lines       jsonb := '[]'::jsonb;
  v_district    public.delivery_districts;
  v_nb          public.delivery_neighborhoods;
  v_street_id   int;
  v_street      text;
  v_door        text  := nullif(trim(p_customer ->> 'door_no'), '');
  v_inner       text  := nullif(trim(p_customer ->> 'inner_no'), '');
  v_building    text  := nullif(trim(p_customer ->> 'building'), '');
  v_address     text;
  v_client      uuid;
  v_existing    public.orders;
begin
  -- İdempotency: aynı istemci sipariş kimliğiyle tekrar gelirse mevcut siparişi döndür
  begin
    v_client := nullif(p_customer ->> 'client_order_id', '')::uuid;
  exception when others then
    raise exception 'GECERSIZ_ISTEK' using errcode = 'P0001';
  end;
  if v_client is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_client::text, 0));
    select * into v_existing from public.orders where client_order_id = v_client;
    if v_existing.id is not null then
      return query select v_existing.id, v_existing.order_no, v_existing.access_token;
      return;
    end if;
  end if;

  if coalesce((p_customer ->> 'accepted_terms')::boolean, false) is not true then
    raise exception 'SOZLESME_ONAYI' using errcode = 'P0001';
  end if;

  select * into s from public.store_settings where id = 1;
  if not s.is_open then
    raise exception 'MARKET_KAPALI' using errcode = 'P0001';
  end if;
  if not public.store_is_open_now(2) then
    raise exception 'SAAT_DISI:%', s.open_time using errcode = 'P0001';
  end if;

  if v_name is null or v_phone is null then
    raise exception 'EKSIK_BILGI' using errcode = 'P0001';
  end if;

  -- Adres doğrulama
  select * into v_district from public.delivery_districts
   where id = nullif(p_customer ->> 'district_id', '')::int;
  if v_district.id is null or not v_district.is_active then
    raise exception 'BOLGE_DISI' using errcode = 'P0001';
  end if;
  select * into v_nb from public.delivery_neighborhoods
   where id = nullif(p_customer ->> 'neighborhood_id', '')::int and district_id = v_district.id;
  if v_nb.id is null or not v_nb.is_active then
    raise exception 'MAHALLE_GECERSIZ' using errcode = 'P0001';
  end if;
  if nullif(p_customer ->> 'street_id', '') is not null then
    select id, name into v_street_id, v_street from public.delivery_streets
     where id = (p_customer ->> 'street_id')::int and neighborhood_id = v_nb.id and is_active;
    if v_street_id is null then
      raise exception 'SOKAK_GECERSIZ' using errcode = 'P0001';
    end if;
  else
    v_street := nullif(trim(p_customer ->> 'street_text'), '');
    if v_street is null or length(v_street) < 2 then
      raise exception 'SOKAK_GECERSIZ' using errcode = 'P0001';
    end if;
  end if;
  if v_door is null then
    raise exception 'KAPI_NO_EKSIK' using errcode = 'P0001';
  end if;

  v_address := v_nb.name || ' Mah. ' || v_street || ' No:' || v_door
               || coalesce(' D:' || v_inner, '')
               || coalesce(' (' || v_building || ')', '')
               || ', ' || v_district.name || '/Tekirdağ';

  if v_payment not in ('kapida_nakit', 'kapida_pos') then
    raise exception 'GECERSIZ_ODEME' using errcode = 'P0001';
  end if;
  if v_slot is null or not (v_slot = any (s.delivery_slots)) then
    raise exception 'GECERSIZ_SAAT' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'SEPET_BOS' using errcode = 'P0001';
  end if;

  for v_line in
    select (e ->> 'product_id')::uuid as product_id,
           sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_line.qty is null or v_line.qty < 1 then
      raise exception 'GECERSIZ_ADET' using errcode = 'P0001';
    end if;

    update public.products p
       set stock = p.stock - v_line.qty
     where p.id = v_line.product_id
       and p.is_active
       and p.stock >= v_line.qty
       and v_line.qty <= p.max_per_order
    returning p.* into v_prod;

    if not found then
      select * into v_prod from public.products where id = v_line.product_id;
      if v_prod.id is null or not v_prod.is_active then
        raise exception 'URUN_YOK' using errcode = 'P0001';
      elsif v_line.qty > v_prod.max_per_order then
        raise exception 'LIMIT_ASILDI:%', v_prod.name using errcode = 'P0001';
      else
        raise exception 'STOK_YETERSIZ:%', v_prod.name using errcode = 'P0001';
      end if;
    end if;

    v_price    := coalesce(v_prod.sale_price, v_prod.price);
    v_subtotal := v_subtotal + v_price * v_line.qty;
    v_lines    := v_lines || jsonb_build_object(
                    'product_id', v_prod.id,
                    'product_name', v_prod.name,
                    'unit_label', v_prod.unit_label,
                    'unit_price', v_price,
                    'quantity', v_line.qty
                  );
  end loop;

  if v_subtotal < s.min_order_amount then
    raise exception 'MIN_TUTAR:%', s.min_order_amount using errcode = 'P0001';
  end if;

  v_fee := case when v_subtotal >= s.free_delivery_threshold then 0 else s.delivery_fee end;

  insert into public.orders (
    user_id, customer_name, phone, address, address_note, delivery_slot,
    payment_method, note, subtotal, delivery_fee, total,
    addr_city, addr_district, addr_neighborhood, addr_street, addr_street_id,
    addr_door_no, addr_inner_no, addr_building,
    client_order_id, terms_accepted_at, terms_version
  ) values (
    auth.uid(), v_name, v_phone, v_address,
    nullif(trim(p_customer ->> 'address_note'), ''), v_slot,
    v_payment, nullif(trim(p_customer ->> 'note'), ''),
    v_subtotal, v_fee, v_subtotal + v_fee,
    'Tekirdağ', v_district.name, v_nb.name, v_street, v_street_id,
    v_door, v_inner, v_building,
    v_client, now(), nullif(left(trim(p_customer ->> 'terms_version'), 40), '')
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit_label, unit_price, quantity, line_total)
  select v_order.id,
         (l ->> 'product_id')::uuid,
         l ->> 'product_name',
         l ->> 'unit_label',
         (l ->> 'unit_price')::numeric,
         (l ->> 'quantity')::int,
         (l ->> 'unit_price')::numeric * (l ->> 'quantity')::int
  from jsonb_array_elements(v_lines) l;

  return query select v_order.id, v_order.order_no, v_order.access_token;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old  text;
  v_rank_old int;
  v_rank_new int;
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
  -- Çift tıklama: aynı duruma tekrar istek → sessizce yok say
  if v_old = p_status then
    return;
  end if;
  if v_old in ('iptal', 'teslim_edildi') then
    raise exception 'SIPARIS_KAPALI' using errcode = 'P0001';
  end if;

  if p_status <> 'iptal' then
    v_rank_old := array_position(array['alindi','hazirlaniyor','yolda','teslim_edildi'], v_old);
    v_rank_new := array_position(array['alindi','hazirlaniyor','yolda','teslim_edildi'], p_status);
    if v_rank_new <> v_rank_old + 1 then
      raise exception 'GECERSIZ_GECIS' using errcode = 'P0001';
    end if;
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

-- ---------------------------------------------------------------------
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
     where p.id = p_replacement and p.is_active and p.stock >= p_qty and p_qty <= p.max_per_order
    returning p.* into v_prod;
    if v_prod.id is null then
      select * into v_prod from public.products where id = p_replacement;
      if v_prod.id is not null and p_qty > v_prod.max_per_order then
        raise exception 'LIMIT_ASILDI:%', v_prod.name using errcode = 'P0001';
      end if;
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

-- ---------------------------------------------------------------------
create or replace function public.voice_session_allow(p_client_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.store_settings;
  v_user int;
  v_all  int;
begin
  select * into s from public.store_settings where id = 1;
  if not s.voice_enabled then return 'kapali'; end if;
  if p_client_key is null or length(p_client_key) < 8 then return 'saatlik'; end if;
  -- Eşzamanlı istekler sayacı aşamasın: kontrol+ekleme tek seferde
  perform pg_advisory_xact_lock(hashtextextended('voice_session_allow', 0));
  select count(*) into v_user from public.voice_sessions where client_key = p_client_key and created_at > now() - interval '1 hour';
  if v_user >= s.voice_hourly_per_user then return 'saatlik'; end if;
  select count(*) into v_all from public.voice_sessions where created_at > now() - interval '1 day';
  if v_all >= s.voice_daily_limit then return 'gunluk'; end if;
  insert into public.voice_sessions (client_key) values (p_client_key);
  return 'ok';
end;
$$;

revoke all on function public.voice_session_allow(text) from public;
grant execute on function public.voice_session_allow(text) to anon, authenticated;
