-- Vitrin: alt kategorileri müşterilerin en çok tercih ettiği sıraya dizmek için kategori başına satış adedi
-- (son 90 gün; online siparişler + mağaza içi satışlar, iptal edilenler hariç). Yalnızca toplam döner,
-- kişisel veri yok → anonim okunabilir. Vitrin bunu günlük önbellekte tutar.
create or replace function public.category_popularity()
returns table (category_id uuid, qty numeric)
language sql stable security definer
set search_path = public as $$
  with sold as (
    select oi.product_id, oi.quantity::numeric as q
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.status <> 'iptal' and not coalesce(oi.removed, false)
      and o.created_at > now() - interval '90 days'
    union all
    select si.product_id, si.quantity::numeric
    from pos_sale_items si
    join pos_sales s on s.id = si.sale_id
    where s.voided_at is null and s.created_at > now() - interval '90 days'
  )
  select p.category_id, sum(sold.q) as qty
  from sold join products p on p.id = sold.product_id
  where p.category_id is not null
  group by p.category_id
$$;

grant execute on function public.category_popularity() to anon, authenticated;
