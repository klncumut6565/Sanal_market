-- Mesafeli satış sözleşmesi / ön bilgilendirme formu için satıcı bilgileri (yasal ünvan, vergi, MERSİS, e-posta).
alter table public.store_settings
  add column if not exists legal_name text,
  add column if not exists tax_office text,
  add column if not exists tax_no text,
  add column if not exists mersis_no text,
  add column if not exists contact_email text;
