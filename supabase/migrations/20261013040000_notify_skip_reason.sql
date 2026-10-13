-- "Yalnızca panel kapalıyken" açıkken sipariş bildirimi sessizce atlanıyordu (#10007).
-- 1) Ayar kapatıldı: WhatsApp her siparişte gider.
-- 2) Atlanırsa sebebi "Son otomatik bildirim" satırına yazılır.
update public.notify_settings set only_when_away = false where id = 1;

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
    update public.notify_settings
       set last_result = '#' || o.order_no || ' → WhatsApp/e-posta GÖNDERİLMEDİ: yönetim paneli açıktı ("Yalnızca panel kapalıyken" ayarı)',
           last_result_at = now()
     where id = 1;
    return jsonb_build_object('skip', 'panel_acik');
  end if;
  update public.orders set notified_at = now() where id = o.id;
  select string_agg(i.quantity || ' × ' || i.product_name || coalesce(' (' || i.unit_label || ')', ''), E'\n' order by i.product_name)
    into v_items from public.order_items i where i.order_id = o.id;
  return jsonb_build_object(
    'email', case when n.email_enabled then n.email end,
    'whatsapp_phone', case when n.whatsapp_enabled then n.whatsapp_phone end,
    'backup_phone', case when n.whatsapp_enabled then n.backup_phone end,
    'whatsapp_window_open', public.wa_window_open(n.whatsapp_phone),
    'callmebot_apikey', case when n.whatsapp_enabled then n.callmebot_apikey end,
    'order', jsonb_build_object(
      'id', o.id, 'order_no', o.order_no, 'customer_name', o.customer_name, 'phone', o.phone,
      'address', o.address, 'address_note', o.address_note, 'note', o.note, 'delivery_slot', o.delivery_slot,
      'payment_method', o.payment_method, 'total', o.total, 'created_at', o.created_at, 'items', v_items
    )
  );
end;
$$;
