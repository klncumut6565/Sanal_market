-- Vitrin sıralaması: ürün başına satış adedi (son 90 gün; online + mağaza içi, iptaller hariç).
-- Yalnızca toplam döner (kişisel veri yok) → anonim okunabilir; vitrin haftalık önbellekte tutar.
create or replace function public.product_popularity()
returns table (product_id uuid, qty numeric)
language sql stable security definer
set search_path = public as $$
  with sold as (
    select oi.product_id, oi.quantity::numeric as q
    from order_items oi join orders o on o.id = oi.order_id
    where o.status <> 'iptal' and not coalesce(oi.removed, false) and o.created_at > now() - interval '90 days'
    union all
    select si.product_id, si.quantity::numeric
    from pos_sale_items si join pos_sales s on s.id = si.sale_id
    where s.voided_at is null and s.created_at > now() - interval '90 days'
  )
  select product_id, sum(q) from sold where product_id is not null group by product_id
$$;
grant execute on function public.product_popularity() to anon, authenticated;

-- Ana sayfa alt kategori sekmesi (tarayıcıdan, dokununca): o kategorinin ürünleri
-- stokta olan → görseli olan → en çok satan → yönetimdeki sıra. Görünürlük kuralı RLS ile aynı.
create or replace function public.category_top_products(p_cat uuid, p_limit int default 10)
returns setof public.products
language sql stable security definer
set search_path = public as $$
  with pop as (
    select oi.product_id, sum(oi.quantity)::numeric q
    from order_items oi join orders o on o.id = oi.order_id
    join products pp on pp.id = oi.product_id and pp.category_id = p_cat
    where o.status <> 'iptal' and not coalesce(oi.removed, false) and o.created_at > now() - interval '90 days'
    group by oi.product_id
    union all
    select si.product_id, sum(si.quantity)::numeric
    from pos_sale_items si join pos_sales s on s.id = si.sale_id
    join products pp on pp.id = si.product_id and pp.category_id = p_cat
    where s.voided_at is null and s.created_at > now() - interval '90 days'
    group by si.product_id
  ), t as (select product_id, sum(q) q from pop group by product_id)
  select p.* from products p
  join categories c on c.id = p.category_id and c.is_active and public.category_visible(c.visibility)
  left join t on t.product_id = p.id
  where p.category_id = p_cat and p.is_active
  order by (p.stock > 0) desc, (p.image_url is not null) desc, coalesce(t.q, 0) desc, p.sort_order, p.name, p.id
  limit least(greatest(coalesce(p_limit, 10), 1), 30)
$$;
grant execute on function public.category_top_products(uuid, int) to anon, authenticated;
