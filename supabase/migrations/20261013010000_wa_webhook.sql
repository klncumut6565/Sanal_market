-- =====================================================================
-- WhatsApp (Meta) webhook: 24 saatlik pencere takibi + teslim edilemeyen mesajda yedek
--   wa_contacts : numaranın bot numarasına en son yazdığı an (pencere = son 24 saat)
--   wa_outbox   : Meta ile gönderilen mesajlar; webhook "failed" derse CallMeBot yedeği
-- Webhook route'u RLS'i aşmak için gizli anahtarla (notify_settings.webhook_secret) RPC çağırır.
-- =====================================================================
alter table public.notify_settings add column if not exists webhook_secret text;
alter table public.notify_settings add column if not exists webhook_seen_at timestamptz;

create table if not exists public.wa_contacts (
  phone           text primary key,          -- yalnızca rakam: 905xxxxxxxxx
  last_inbound_at timestamptz not null
);
alter table public.wa_contacts enable row level security;
create policy wa_contacts_admin on public.wa_contacts for select using (public.is_admin());

create table if not exists public.wa_outbox (
  wamid           text primary key,
  to_phone        text not null,
  body            text not null,
  fallback_phone  text,
  fallback_apikey text,
  status          text not null default 'sent',
  error           text,
  fallback_sent   boolean not null default false,
  created_at      timestamptz not null default now()
);
alter table public.wa_outbox enable row level security;
create policy wa_outbox_admin on public.wa_outbox for select using (public.is_admin());

-- Pencere açık mı? null = bilinmiyor (webhook henüz hiç veri göndermedi)
create or replace function public.wa_window_open(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select webhook_seen_at from public.notify_settings where id = 1) is null then null
    else exists (
      select 1 from public.wa_contacts
       where phone = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
         and last_inbound_at > now() - interval '23 hours 50 minutes'
    )
  end;
$$;
grant execute on function public.wa_window_open(text) to anon, authenticated;

-- Gönderilen Meta mesajını kaydet (sunucu, gizli anahtarla)
create or replace function public.wa_outbox_add(p_secret text, p_wamid text, p_to text, p_body text, p_fallback_phone text, p_fallback_apikey text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (select webhook_secret from public.notify_settings where id = 1) then
    raise exception 'YETKISIZ';
  end if;
  insert into public.wa_outbox (wamid, to_phone, body, fallback_phone, fallback_apikey)
  values (p_wamid, regexp_replace(p_to, '\D', '', 'g'), left(p_body, 4000), p_fallback_phone, p_fallback_apikey)
  on conflict (wamid) do nothing;
end;
$$;
grant execute on function public.wa_outbox_add(text, text, text, text, text, text) to anon, authenticated;

-- Webhook verisini işle: gelen mesajlar → pencere; başarısız durumlar → yedek gönderilecek kayıtlar
create or replace function public.wa_ingest(p_secret text, p_inbound text[], p_failed jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out jsonb := '[]'::jsonb;
  r record;
begin
  if p_secret is null or p_secret <> (select webhook_secret from public.notify_settings where id = 1) then
    raise exception 'YETKISIZ';
  end if;
  update public.notify_settings set webhook_seen_at = now() where id = 1;
  insert into public.wa_contacts (phone, last_inbound_at)
  select regexp_replace(x, '\D', '', 'g'), now() from unnest(coalesce(p_inbound, '{}')) x
  on conflict (phone) do update set last_inbound_at = excluded.last_inbound_at;

  for r in
    select o.*, f->>'error' as err
      from jsonb_array_elements(coalesce(p_failed, '[]'::jsonb)) f
      join public.wa_outbox o on o.wamid = f->>'id'
     where not o.fallback_sent
       for update of o
  loop
    update public.wa_outbox set status = 'failed', error = left(r.err, 300), fallback_sent = (r.fallback_phone is not null and r.fallback_apikey is not null)
     where wamid = r.wamid;
    if r.fallback_phone is not null and r.fallback_apikey is not null then
      v_out := v_out || jsonb_build_object('phone', r.fallback_phone, 'apikey', r.fallback_apikey, 'body', r.body, 'error', r.err);
    end if;
  end loop;
  return v_out;
end;
$$;
grant execute on function public.wa_ingest(text, text[], jsonb) to anon, authenticated;

-- Bildirim yükü: asıl numaranın 24 saat penceresi açık mı
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
