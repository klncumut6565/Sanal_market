-- Müşteri tercih hafızası: sesli asistan üye müşterinin kalıcı tercihlerini not eder
-- ("süt hep 1 L tam yağlı", "ekmek tam buğday"). Müşteri kendi notlarını görür ve siler (Siparişlerim).
create table if not exists public.customer_prefs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  note       text not null check (length(note) between 2 and 200),
  created_at timestamptz not null default now()
);
create index if not exists customer_prefs_user_idx on public.customer_prefs (user_id, created_at);
alter table public.customer_prefs enable row level security;
create policy customer_prefs_own_select on public.customer_prefs for select using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy customer_prefs_own_insert on public.customer_prefs for insert with check (user_id = (select auth.uid()));
create policy customer_prefs_own_delete on public.customer_prefs for delete using (user_id = (select auth.uid()));
revoke all on public.customer_prefs from anon;
grant select, insert, delete on public.customer_prefs to authenticated;
