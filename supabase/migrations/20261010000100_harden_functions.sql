-- Supabase güvenlik danışmanı uyarıları için sertleştirme
alter function public.f_norm(text) set search_path = public, extensions;
alter function public.touch_updated_at() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.admin_set_order_status(uuid, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;
-- Bilinçli olarak herkese açık: place_order, get_order_public (token kontrollü), is_admin (RLS içinde gerekli)
