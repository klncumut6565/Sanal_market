alter table public.notify_settings add column if not exists last_result text, add column if not exists last_result_at timestamptz;

-- Sunucu, bildirim gönderiminin sonucunu buraya yazar (yalnızca az önce bildirilen sipariş için)
create or replace function public.record_notification_result(p_order_id uuid, p_token uuid, p_result text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.orders
     where id = p_order_id and access_token = p_token and notified_at > now() - interval '10 minutes'
  ) then
    update public.notify_settings set last_result = left(p_result, 500), last_result_at = now() where id = 1;
  end if;
end;
$$;
revoke all on function public.record_notification_result(uuid, uuid, text) from public;
grant execute on function public.record_notification_result(uuid, uuid, text) to anon, authenticated;
