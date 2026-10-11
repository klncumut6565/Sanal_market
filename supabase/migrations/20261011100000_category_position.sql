-- Kategoriyi istenen sıraya yerleştir: o sıradaki ve sonrasındakiler bir kayar.
-- Tüm kategoriler 1..n olarak yeniden numaralanır (boşluk/çakışma kalmaz).
create or replace function public.admin_place_category(p_id uuid, p_pos int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_pos int;
begin
  if not public.is_admin() then
    raise exception 'YETKISIZ' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('categories_order', 0));

  select coalesce(array_agg(id order by sort_order, name), '{}') into v_ids
    from public.categories where id <> p_id;

  v_pos := greatest(1, least(coalesce(p_pos, cardinality(v_ids) + 1), cardinality(v_ids) + 1));
  v_ids := v_ids[1:v_pos - 1] || p_id || v_ids[v_pos:];

  update public.categories c
     set sort_order = o.n
    from unnest(v_ids) with ordinality as o(id, n)
   where c.id = o.id and c.sort_order is distinct from o.n;
end;
$$;

revoke all on function public.admin_place_category(uuid, int) from public, anon;
grant execute on function public.admin_place_category(uuid, int) to authenticated;

-- Mevcut sıralamayı 1..n olarak düzelt (aynı numaralı kategoriler vardı)
update public.categories c
   set sort_order = o.n
  from (select id, row_number() over (order by sort_order, name) as n from public.categories) o
 where c.id = o.id;
