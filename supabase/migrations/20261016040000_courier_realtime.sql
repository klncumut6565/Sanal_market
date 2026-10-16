-- Kurye paneli ve yönetimdeki Kuryeler sayfası canlı güncellensin (Supabase Realtime).
-- Olaylar RLS'e tabidir: kurye yalnızca kendi kayıtlarının değişikliğini alır.
alter publication supabase_realtime add table public.orders, public.courier_settlements, public.couriers, public.pos_receipts;
