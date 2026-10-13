-- =====================================================================
-- Yedek bildirim numarası + kurye WhatsApp'ı
--   backup_phone   : Meta ile 0533'e gidemezse CallMeBot ile bu numaraya (0541) gönderilir
--   courier_phone  : "Hazır · Kuryeye ver" (yolda) seçilince sipariş mesajı kuryeye gider
--   courier_apikey : kuryenin kendi CallMeBot anahtarı (isteğe bağlı yedek kanal)
-- =====================================================================
alter table public.notify_settings add column if not exists backup_phone text;
alter table public.notify_settings add column if not exists courier_phone text;
alter table public.notify_settings add column if not exists courier_apikey text;
alter table public.notify_settings add column if not exists courier_last_result text;

alter table public.orders add column if not exists courier_notified_at timestamptz;

update public.notify_settings set backup_phone = '+905416735863' where id = 1 and backup_phone is null;

create or replace function public.claim_order_notification(p_order_id uuid, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  n public.notify_settings;
  v_items text;
begin
  select * into o from public.orders where id = p_order_id and access_token = p_token for update;
  if o.id is null or o.created_at < now() - interval '10 minutes' or o.notified_at is not null then
    return jsonb_build_object('skip', 'gecersiz');
  end if;
  select * into n from public.notify_settings where id = 1;
  if n.only_when_away and n.admin_last_seen is not null and n.admin_last_seen > now() - interval '2 minutes' then
    return jsonb_build_object('skip', 'panel_acik');
  end if;
  update public.orders set notified_at = now() where id = o.id;
  select string_agg(i.quantity || ' × ' || i.product_name || coalesce(' (' || i.unit_label || ')', ''), E'\n' order by i.product_name)
    into v_items from public.order_items i where i.order_id = o.id;
  return jsonb_build_object(
    'email', case when n.email_enabled then n.email end,
    'whatsapp_phone', case when n.whatsapp_enabled then n.whatsapp_phone end,
    'backup_phone', case when n.whatsapp_enabled then n.backup_phone end,
    'callmebot_apikey', case when n.whatsapp_enabled then n.callmebot_apikey end,
    'order', jsonb_build_object(
      'id', o.id, 'order_no', o.order_no, 'customer_name', o.customer_name, 'phone', o.phone,
      'address', o.address, 'address_note', o.address_note, 'note', o.note, 'delivery_slot', o.delivery_slot,
      'payment_method', o.payment_method, 'total', o.total, 'created_at', o.created_at, 'items', v_items
    )
  );
end;
$$;
