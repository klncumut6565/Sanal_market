# Supabase: yeni tablo kuralı (30 Ekim 2026'dan itibaren)

Supabase 30 Ekim 2026'dan sonra `public` şemasında YENİ oluşturulan tablolara Data API (supabase-js / PostgREST) erişimini
otomatik vermiyor. Mevcut tablolar etkilenmez (hepsinde RLS açık; izinler olduğu gibi kalır).

## Her yeni tabloda — aynı migration içinde

```sql
create table public.ornek (...);
alter table public.ornek enable row level security;   -- her zaman

-- Yalnızca uygulamanın gerçekten eriştiği roller (gereksiz izin verme):
grant select on public.ornek to anon;                                   -- herkese açık okunacaksa
grant select, insert, update, delete on public.ornek to authenticated;  -- üye / yönetici erişiyorsa
grant select, insert, update, delete on public.ornek to service_role;   -- sunucu (gizli anahtar) erişiyorsa
-- + RLS politikaları (create policy …)
```

- Tabloya YALNIZCA `security definer` RPC'lerle erişiliyorsa (ör. `cache_flush`) grant gerekmez.
- Bilerek anon'dan kapatılmış tablolar var (`customer_prefs`, `product_costs`, `order_item_costs`, `wa_bot_chats`, `wa_bot_seen`):
  toplu "tüm tablolara grant" migration'ı YAZMA — bu kapatmaları geri açar.
- Grant unutulursa API `permission denied for table …` hatası verir; hata mesajındaki GRANT komutu eklenir.
