-- Yönetim paneli kapalıyken yeni siparişi e-posta + WhatsApp ile bildirme.
-- Hedefler ve anahtarlar herkese açık store_settings'te DEĞİL, yalnızca admin tablosunda.
create table if not exists public.notify_settings (
  id               int primary key default 1 check (id = 1),
  email            text,
  whatsapp_phone   text,             -- bildirimin gideceği numara (+905…)
  callmebot_apikey text,             -- CallMeBot WhatsApp anahtarı
  email_enabled    boolean not null default true,
  whatsapp_enabled boolean not null default true,
  only_when_away   boolean not null default true,  -- yalnızca panel kapalıyken
  admin_last_seen  timestamptz
);
insert into public.notify_settings (id) values (1) on conflict (id) do nothing;
alter table public.notify_settings enable row level security;
create policy notify_settings_admin on public.notify_settings
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.orders add column if not exists notified_at timestamptz;

-- Panel açıkken düzenli "buradayım" sinyali
create or replace function public.admin_heartbeat()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'YETKISIZ' using errcode = '42501';
  end if;
  update public.notify_settings set admin_last_seen = now() where id = 1;
end;
$$;
revoke all on function public.admin_heartbeat() from public, anon;
grant execute on function public.admin_heartbeat() to authenticated;

-- Sipariş verildikten hemen sonra sunucu çağırır: sipariş jetonu doğruysa ve sipariş
-- yeni ise (10 dk) bildirim hedeflerini döndürür ve siparişi "bildirildi" işaretler
-- (aynı sipariş iki kez bildirilmez). Panel açıksa (son 2 dk sinyal) ve
-- only_when_away ise "skip" döner.
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
    'callmebot_apikey', case when n.whatsapp_enabled then n.callmebot_apikey end,
    'order', jsonb_build_object(
      'id', o.id, 'order_no', o.order_no, 'customer_name', o.customer_name, 'phone', o.phone,
      'address', o.address, 'address_note', o.address_note, 'note', o.note, 'delivery_slot', o.delivery_slot,
      'payment_method', o.payment_method, 'total', o.total, 'created_at', o.created_at, 'items', v_items
    )
  );
end;
$$;
revoke all on function public.claim_order_notification(uuid, uuid) from public;
grant execute on function public.claim_order_notification(uuid, uuid) to anon, authenticated;
