-- =====================================================================
-- Telefona uygulama bildirimi (Web Push)
--   push_subscriptions : yönetici ve kurye cihazları
--   notify_settings.vapid_private : push imza anahtarı (yalnızca sunucu, gizli anahtarla)
--   notify_settings.courier_token : kurye sayfası bağlantısı (/kurye?k=...)
-- =====================================================================
alter table public.notify_settings add column if not exists vapid_private text;
alter table public.notify_settings add column if not exists courier_token uuid not null default gen_random_uuid();

create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  p256dh      text not null,
  auth        text not null,
  role        text not null check (role in ('admin', 'kurye')),
  device      text,
  dead        boolean not null default false,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_admin on public.push_subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

-- Sunucu: gönderim hedefleri + imza anahtarı (gizli anahtarla)
create or replace function public.push_targets(p_secret text, p_role text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare n public.notify_settings;
begin
  select * into n from public.notify_settings where id = 1;
  if p_secret is null or p_secret <> n.webhook_secret then raise exception 'YETKISIZ'; end if;
  return jsonb_build_object(
    'vapid_private', n.vapid_private,
    'courier_token', n.courier_token,
    'subs', coalesce((select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth))
                        from public.push_subscriptions where role = p_role and not dead), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.push_targets(text, text) to anon, authenticated;

create or replace function public.push_mark(p_secret text, p_endpoint text, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (select webhook_secret from public.notify_settings where id = 1) then raise exception 'YETKISIZ'; end if;
  update public.push_subscriptions
     set dead = not p_ok, last_ok_at = case when p_ok then now() else last_ok_at end
   where endpoint = p_endpoint;
end;
$$;
grant execute on function public.push_mark(text, text, boolean) to anon, authenticated;

-- Kurye cihazı abone olur (kurye sayfasındaki gizli bağlantıyla)
create or replace function public.courier_push_subscribe(p_token uuid, p_endpoint text, p_p256dh text, p_auth text, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or p_token <> (select courier_token from public.notify_settings where id = 1) then raise exception 'YETKISIZ'; end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, role, device)
  values (p_endpoint, p_p256dh, p_auth, 'kurye', left(p_device, 200))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, role = 'kurye', dead = false, device = excluded.device;
end;
$$;
grant execute on function public.courier_push_subscribe(uuid, text, text, text, text) to anon, authenticated;

-- Kurye sayfası: yoldaki ve hazırlanan siparişler
create or replace function public.courier_orders(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_token is null or p_token <> (select courier_token from public.notify_settings where id = 1) then raise exception 'YETKISIZ'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'order_no', o.order_no, 'status', o.status, 'customer_name', o.customer_name, 'phone', o.phone,
      'address', o.address, 'address_note', o.address_note, 'note', o.note, 'payment_method', o.payment_method,
      'total', o.total, 'created_at', o.created_at,
      'items', (select string_agg(i.quantity || ' × ' || i.product_name || coalesce(' (' || i.unit_label || ')', ''), E'\n' order by i.product_name)
                  from public.order_items i where i.order_id = o.id and not coalesce(i.removed, false))
    ) order by (o.status = 'yolda') desc, o.created_at)
    from public.orders o where o.status in ('yolda', 'hazirlaniyor')
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.courier_orders(uuid) to anon, authenticated;
