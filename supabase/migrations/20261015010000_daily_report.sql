-- Gün sonu raporu (WhatsApp): online ve mağaza (kasa) AYRI, kâr, kritik stok.
-- Zamanlanmış çağrı (Vercel Cron) gizli anahtarla (notify_settings.webhook_secret = WHATSAPP_VERIFY_TOKEN),
-- yönetim panelindeki "test gönder" ise yönetici oturumuyla çalışır.
alter table public.notify_settings
  add column if not exists daily_report_enabled boolean not null default true,
  add column if not exists daily_report_last_day date,
  add column if not exists daily_report_last_result text,
  add column if not exists daily_report_last_at timestamptz;

create or replace function public.daily_report_auth(p_secret text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or (p_secret is not null and p_secret <> '' and p_secret = (select webhook_secret from public.notify_settings where id = 1));
$$;
revoke all on function public.daily_report_auth(text) from public, anon, authenticated;

-- Aynı gün için raporu bir kez gönder: true dönerse gönderme hakkı alındı.
create or replace function public.daily_report_claim(p_secret text, p_day date)
returns boolean language plpgsql security definer set search_path = public
as $$
declare ok boolean;
begin
  if not public.daily_report_auth(p_secret) then raise exception 'YETKISIZ'; end if;
  update public.notify_settings
     set daily_report_last_day = p_day
   where id = 1 and daily_report_enabled and (daily_report_last_day is null or daily_report_last_day < p_day)
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

create or replace function public.daily_report_mark(p_secret text, p_result text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.daily_report_auth(p_secret) then raise exception 'YETKISIZ'; end if;
  update public.notify_settings set daily_report_last_result = left(p_result, 500), daily_report_last_at = now() where id = 1;
end;
$$;

create or replace function public.daily_report_data(p_secret text, p_start timestamptz, p_end timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare r jsonb;
begin
  if not public.daily_report_auth(p_secret) then raise exception 'YETKISIZ'; end if;
  with o as (
    select * from public.orders where created_at >= p_start and created_at < p_end
  ), oi as (
    select i.product_name, i.quantity, i.line_total, c.unit_cost
    from public.order_items i
    join o on o.id = i.order_id and o.status <> 'iptal'
    left join public.order_item_costs c on c.order_item_id = i.id
    where not i.removed
  ), ps as (
    select * from public.pos_sales where created_at >= p_start and created_at < p_end
  ), pi as (
    select i.product_name, i.quantity, i.line_total, i.cost_price
    from public.pos_sale_items i join ps on ps.id = i.sale_id and ps.voided_at is null
  )
  select jsonb_build_object(
    'online', (select jsonb_build_object(
        'count', count(*) filter (where status <> 'iptal'),
        'revenue', coalesce(sum(total) filter (where status <> 'iptal'), 0),
        'fee', coalesce(sum(delivery_fee) filter (where status <> 'iptal'), 0),
        'cash', coalesce(sum(total) filter (where status <> 'iptal' and payment_method = 'kapida_nakit'), 0),
        'card', coalesce(sum(total) filter (where status <> 'iptal' and payment_method = 'kapida_pos'), 0),
        'cancelled', count(*) filter (where status = 'iptal'),
        'open', count(*) filter (where status in ('alindi','hazirlaniyor','yolda'))
      ) from o),
    'online_items', (select jsonb_build_object(
        'sales', coalesce(sum(line_total), 0),
        'costed_sales', coalesce(sum(line_total) filter (where unit_cost is not null), 0),
        'cost', coalesce(sum(unit_cost * quantity) filter (where unit_cost is not null), 0)
      ) from oi),
    'online_top', (select coalesce(jsonb_agg(t), '[]') from (
        select product_name as name, sum(quantity) as qty, sum(line_total) as revenue from oi group by 1 order by 3 desc limit 3) t),
    'store', (select jsonb_build_object(
        'count', count(*) filter (where voided_at is null),
        'gross', coalesce(sum(subtotal) filter (where voided_at is null), 0),
        'discount', coalesce(sum(discount) filter (where voided_at is null), 0),
        'net', coalesce(sum(total) filter (where voided_at is null), 0),
        'cash', coalesce(sum(cash_amount - change_due) filter (where voided_at is null), 0),
        'card', coalesce(sum(card_amount) filter (where voided_at is null), 0),
        'voided', count(*) filter (where voided_at is not null)
      ) from ps),
    'store_items', (select jsonb_build_object(
        'sales', coalesce(sum(line_total), 0),
        'costed_sales', coalesce(sum(line_total) filter (where cost_price is not null), 0),
        'cost', coalesce(sum(cost_price * quantity) filter (where cost_price is not null), 0)
      ) from pi),
    'store_top', (select coalesce(jsonb_agg(t), '[]') from (
        select product_name as name, sum(quantity) as qty, sum(line_total) as revenue from pi group by 1 order by 3 desc limit 3) t),
    'stock', (select jsonb_build_object(
        'critical', count(*) filter (where stock > 0 and stock <= critical_stock),
        'out', count(*) filter (where stock <= 0),
        'list', (select coalesce(jsonb_agg(x), '[]') from (
            select name, stock from public.products where is_active and stock <= critical_stock order by stock, name limit 10) x)
      ) from public.products where is_active),
    'targets', (select jsonb_build_object('phone', whatsapp_phone, 'backup', backup_phone, 'apikey', callmebot_apikey, 'email', email, 'enabled', daily_report_enabled)
      from public.notify_settings where id = 1)
  ) into r;
  return r;
end;
$$;

grant execute on function public.daily_report_claim(text, date) to anon, authenticated;
grant execute on function public.daily_report_mark(text, text) to anon, authenticated;
grant execute on function public.daily_report_data(text, timestamptz, timestamptz) to anon, authenticated;
