-- Supabase Advisor önerileri (güvenlik + performans)

-- Tetikleyici fonksiyonları API üzerinden çağrılamasın
revoke execute on function public.block_blacklisted_order() from public, anon, authenticated;
revoke execute on function public.snapshot_order_item_cost() from public, anon, authenticated;

-- RLS: auth.uid() her satırda değil sorgu başına bir kez hesaplansın
alter policy profiles_select on public.profiles using ((id = (select auth.uid())) or public.is_admin());
alter policy profiles_update on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy orders_read on public.orders using ((user_id = (select auth.uid())) or public.is_admin());
alter policy order_items_read on public.order_items using (
  public.is_admin() or exists (
    select 1 from public.orders o where o.id = order_items.order_id and o.user_id = (select auth.uid())
  )
);

-- Yabancı anahtarlara indeks
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists orders_addr_street_idx on public.orders (addr_street_id);
