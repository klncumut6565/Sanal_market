-- WhatsApp sipariş botu: müşteri bot numarasına yazar, yapay zekâ ürün bulur, sepeti kurar, onayla siparişi açar.
-- Tüm erişim sunucudan gizli anahtarla (notify_settings.webhook_secret = WHATSAPP_VERIFY_TOKEN); tablolar istemciye kapalı.
alter table public.notify_settings add column if not exists wa_bot_enabled boolean not null default true;

create table if not exists public.wa_bot_chats (
  phone       text primary key,          -- +905xxxxxxxxx
  name        text,
  contents    jsonb not null default '[]', -- yapay zekâ konuşma geçmişi (son mesajlar)
  cart        jsonb not null default '[]', -- [{product_id, name, qty, price}]
  customer    jsonb not null default '{}', -- ad, adres, ödeme, teslimat
  last_order  jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create table if not exists public.wa_bot_seen (
  wamid text primary key,
  at    timestamptz not null default now()
);
alter table public.wa_bot_chats enable row level security;
alter table public.wa_bot_seen enable row level security;
create policy wa_bot_chats_admin on public.wa_bot_chats for select using (public.is_admin());
revoke all on public.wa_bot_chats, public.wa_bot_seen from anon;

-- Mesajı al: tekrar gelen (aynı wamid) mesajda null döner; bot kapalıysa / bildirim numarasıysa {skip}.
create or replace function public.wa_bot_begin(p_secret text, p_phone text, p_wamid text, p_name text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare n public.notify_settings; c public.wa_bot_chats; ins int;
begin
  select * into n from public.notify_settings where id = 1;
  if p_secret is null or p_secret <> n.webhook_secret then raise exception 'YETKISIZ'; end if;
  insert into public.wa_bot_seen (wamid) values (p_wamid) on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 0 then return null; end if;
  if not n.wa_bot_enabled then return jsonb_build_object('skip', 'kapali'); end if;
  if p_phone in (coalesce(n.whatsapp_phone, '-'), coalesce(n.backup_phone, '-'), coalesce(n.courier_phone, '-')) then
    return jsonb_build_object('skip', 'isletme');
  end if;
  insert into public.wa_bot_chats (phone, name) values (p_phone, nullif(trim(p_name), ''))
  on conflict (phone) do update set name = coalesce(public.wa_bot_chats.name, excluded.name)
  returning * into c;
  -- 6 saattir konuşulmadıysa konuşmayı sıfırla (sepet ve adres kalır)
  if c.updated_at < now() - interval '6 hours' then
    update public.wa_bot_chats set contents = '[]' where phone = p_phone returning * into c;
  end if;
  return to_jsonb(c);
end;
$$;

create or replace function public.wa_bot_save(p_secret text, p_phone text, p_contents jsonb, p_cart jsonb, p_customer jsonb, p_last_order jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (select webhook_secret from public.notify_settings where id = 1) then raise exception 'YETKISIZ'; end if;
  update public.wa_bot_chats set
    contents = coalesce(p_contents, contents),
    cart = coalesce(p_cart, cart),
    customer = coalesce(p_customer, customer),
    last_order = coalesce(p_last_order, last_order),
    updated_at = now()
  where phone = p_phone;
end;
$$;

grant execute on function public.wa_bot_begin(text, text, text, text) to anon, authenticated;
grant execute on function public.wa_bot_save(text, text, jsonb, jsonb, jsonb, jsonb) to anon, authenticated;
