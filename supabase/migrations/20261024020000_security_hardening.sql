-- Güvenlik sıkılaştırması (Supabase güvenlik danışmanı, 2026-10-24).
-- Aşağıdaki SECURITY DEFINER fonksiyonların hepsi zaten içeride is_admin()/kurye/auth.uid() denetler;
-- giriş yapmamış (anon) ziyaretçinin bunları çağırmasına hiç gerek yok → yetki kaldırılır (derinlemesine savunma).
do $$
declare f text;
begin
  foreach f in array array[
    'admin_assign_courier(uuid, uuid)', 'admin_auto_assign(uuid)', 'admin_clear_issue(uuid)',
    'admin_courier_decide(uuid, boolean, numeric)', 'admin_courier_overview()',
    'admin_courier_update(uuid, numeric, text, text, text, boolean)', 'admin_review_receipt(bigint, text, text)',
    'admin_settle_courier(uuid, text)', 'courier_claim(uuid)', 'courier_deliver(uuid, text, numeric, text)',
    'courier_deliver_split(uuid, numeric, numeric, text, jsonb)',
    'courier_history(timestamptz, timestamptz, boolean)', 'courier_history2(timestamptz, timestamptz, boolean)',
    'courier_pickup(uuid)', 'courier_push_subscribe_me(text, text, text, text)', 'courier_release(uuid)',
    'courier_report_issue(uuid, text)', 'courier_set_duty(boolean)',
    'courier_update_location(double precision, double precision, real, real, real)',
    'request_courier_access(text, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Tetikleyici fonksiyonları doğrudan çağrılmaz (tetikleyici yine çalışır).
revoke execute on function public.categories_inherit() from public, anon, authenticated;
revoke execute on function public.categories_propagate() from public, anon, authenticated;

-- search_path sabitlenir (fonksiyon arama yolu ele geçirilemesin)
alter function public.tr_fold(text) set search_path = public;
alter function public.norm_barcode(text) set search_path = public;

-- WhatsApp 24 saat penceresi: önceden herkes bir numaranın markete son 24 saatte yazıp yazmadığını sorgulayabiliyordu.
-- Artık yalnızca sunucu (webhook gizli anahtarıyla) sorgular.
-- Eski tek parametreli sürüm silinmedi, yalnızca yetkisi kaldırıldı
revoke execute on function public.wa_window_open(text) from public, anon, authenticated;
create or replace function public.wa_window_open(p_phone text, p_secret text)
returns boolean
language plpgsql stable security definer
set search_path = public as $$
declare n public.notify_settings;
begin
  select * into n from public.notify_settings where id = 1;
  if p_secret is null or p_secret <> n.webhook_secret then raise exception 'YETKISIZ'; end if;
  if n.webhook_seen_at is null then return null; end if;
  return exists (
    select 1 from public.wa_contacts
     where phone = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
       and last_inbound_at > now() - interval '23 hours 50 minutes');
end;
$$;
revoke execute on function public.wa_window_open(text, text) from public;
grant execute on function public.wa_window_open(text, text) to anon, authenticated;
