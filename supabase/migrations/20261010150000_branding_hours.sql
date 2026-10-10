-- Logo bilgileri: çalışma saatleri 10:00 - 01:00, teslimat aralıkları buna göre
alter table public.store_settings add column if not exists working_hours text default '10:00 - 01:00';

update public.store_settings set
  working_hours = '10:00 - 01:00',
  delivery_area_note = 'Motokurye servisi · Kapıda ödeme',
  delivery_slots = array[
    'En kısa sürede',
    '10:00 - 12:00',
    '12:00 - 14:00',
    '14:00 - 16:00',
    '16:00 - 18:00',
    '18:00 - 20:00',
    '20:00 - 22:00',
    '22:00 - 00:00',
    '00:00 - 01:00'
  ]
where id = 1;
