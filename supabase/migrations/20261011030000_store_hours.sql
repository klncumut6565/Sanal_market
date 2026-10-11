-- Çalışma saatleri (İstanbul saati). Kapanış açılıştan küçükse gece yarısını aşar (10:00 → 01:00).
alter table public.store_settings
  add column if not exists open_time  text not null default '10:00' check (open_time  ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  add column if not exists close_time text not null default '01:00' check (close_time ~ '^([01]\d|2[0-3]):[0-5]\d$');

update public.store_settings set open_time = '10:00', close_time = '01:00', working_hours = '10:00 - 01:00' where id = 1;

-- Şu an sipariş alınabilir mi? (kapanıştan sonra 2 dk tolerans: ödeme ekranındaki müşteri mağdur olmasın)
create or replace function public.store_is_open_now(p_grace_min int default 0)
returns boolean
language sql
stable
set search_path = public
as $$
  with s as (
    select is_open,
           split_part(open_time, ':', 1)::int * 60 + split_part(open_time, ':', 2)::int  as o,
           split_part(close_time, ':', 1)::int * 60 + split_part(close_time, ':', 2)::int as c
    from public.store_settings where id = 1
  ), n as (
    select extract(hour from (now() at time zone 'Europe/Istanbul'))::int * 60
         + extract(minute from (now() at time zone 'Europe/Istanbul'))::int as m
  )
  select s.is_open and case
    when s.o = s.c then true                                              -- 24 saat açık
    when s.o < s.c then n.m >= s.o and n.m < s.c + p_grace_min            -- aynı gün
    else n.m >= s.o or n.m < s.c + p_grace_min                            -- gece yarısını aşan
  end
  from s, n;
$$;

grant execute on function public.store_is_open_now(int) to anon, authenticated;

-- place_order: çalışma saatleri dışında sipariş reddedilir
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
begin
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
    addr_door_no, addr_inner_no, addr_building
  ) values (
    auth.uid(), v_name, v_phone, v_address,
    nullif(trim(p_customer ->> 'address_note'), ''), v_slot,
    v_payment, nullif(trim(p_customer ->> 'note'), ''),
    v_subtotal, v_fee, v_subtotal + v_fee,
    'Tekirdağ', v_district.name, v_nb.name, v_street, v_street_id,
    v_door, v_inner, v_building
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
