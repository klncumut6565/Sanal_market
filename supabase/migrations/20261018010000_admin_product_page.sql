-- Yönetim › Ürünler & stok: filtreleme, sıralama ve sayfalama veritabanında yapılır.
-- Önceden her açılışta / filtrede / güncellemeden sonra tüm ürünler (~2300) + tüm alış fiyatları
-- sunucuya indirilip orada süzülüyordu (≈1 MB). Artık yalnızca gösterilen sayfa (100 satır) + özet döner (~50 KB).
-- security definer: RLS satır başına is_admin() çağırıp sorguyu ~850 ms yavaşlatıyordu; fonksiyon başta is_admin() denetler.

-- JS tarafındaki fold() ile aynı: Türkçe harf ve büyük/küçük farkı yok, harf/rakam/% dışı → boşluk
create or replace function public.tr_fold(s text) returns text
language sql immutable parallel safe as $$
  select btrim(regexp_replace(
    translate(lower(translate(coalesce(s, ''), 'İIÇĞÖŞÜÂÎÛ', 'iıçğöşüâîû')), 'çğıöşüâîû', 'cgiosuaiu'),
    '[^a-z0-9%]+', ' ', 'g'))
$$;

create or replace function public.admin_product_page(
  p_q text default '',
  p_cats uuid[] default null,
  p_stok text default '',
  p_marj text default '',
  p_sira text default '',
  p_page int default 1,
  p_size int default 100,
  p_want_ids boolean default false
) returns jsonb
language plpgsql stable security definer
set search_path = public as $$
declare
  v_raw text := btrim(coalesce(p_q, ''));
  v_q text := public.tr_fold(btrim(coalesce(p_q, '')));
  v_words text[];
  v_bc text := regexp_replace(btrim(coalesce(p_q, '')), '\s', '', 'g');
  v_size int := least(greatest(coalesce(p_size, 100), 1), 500);
  v_stok text := coalesce(p_stok, '');
  v_marj text := coalesce(p_marj, '');
  v_sira text := coalesce(p_sira, '');
  v_res jsonb;
begin
  if not public.is_admin() then
    raise exception 'YETKISIZ';
  end if;
  v_words := case when v_q = '' then '{}'::text[] else string_to_array(v_q, ' ') end;

  with base as (
    select p.id, p.name, p.barcode, p.unit_label, p.price, p.sale_price, p.stock, p.critical_stock,
           p.image_url, p.emoji, p.is_active, p.category_id, p.info_updated_at,
           c.cost_price as cost,
           public.tr_fold(p.name) as fname,
           coalesce(p.sale_price, p.price) as eff
    from products p
    left join product_costs c on c.product_id = p.id
  ), keyed as (
    select b.*,
      regexp_replace(b.fname, '[^a-z0-9]', '', 'g') as nkey,
      ltrim(upper(regexp_replace(coalesce(b.barcode, ''), '[^0-9A-Za-z]', '', 'g')), '0') as bkey,
      case when b.cost is not null and b.eff > 0
        then round(round((b.eff - b.cost) * 100) / 100 / b.eff * 1000) / 10 end as mpct
    from base b
  ), allp as (
    select k.*,
      case when length(k.nkey) >= 3 then count(*) over (partition by k.nkey) - 1 else 0 end as dup_n,
      case when k.bkey <> '' then count(*) over (partition by k.bkey) - 1 else 0 end as dup_b
    from keyed k
  ), f as (
    select * from allp x
    where (v_raw = ''
           or not exists (select 1 from unnest(v_words) w where position(w in x.fname) = 0)
           or (v_bc <> '' and position(v_bc in coalesce(x.barcode, '')) > 0))
      and (p_cats is null or x.category_id = any (p_cats))
      and (v_stok <> 'kritik' or x.stock <= x.critical_stock)
      and (v_stok <> 'mukerrer' or x.dup_n > 0 or x.dup_b > 0)
      and (v_stok <> 'barkodsuz' or btrim(coalesce(x.barcode, '')) = '')
      and (v_stok <> 'gorselsiz' or x.image_url is null)
      and (v_marj <> 'dusuk' or (x.mpct is not null and x.mpct < 10))
      and (v_marj <> 'girilmemis' or x.cost is null)
  ), o as (
    select f.*, row_number() over (order by
        case when v_sira = 'fiyat-artan' then f.eff end asc,
        case when v_sira = 'fiyat-azalan' then f.eff end desc,
        case when v_sira = 'ad-za' then f.name end collate "tr-TR-x-icu" desc,
        case when v_sira = 'eski' then coalesce(f.info_updated_at::text, '') end asc,
        case when v_sira = 'yeni' then coalesce(f.info_updated_at::text, '') end desc,
        case when v_sira = '' and v_stok = 'mukerrer' then f.nkey end asc,
        case when v_sira = '' and v_stok = 'mukerrer' then f.bkey end asc,
        case when v_sira = '' and v_marj = 'dusuk' then f.mpct end asc,
        case when v_sira = '' and v_q <> '' then
          case when f.fname = v_q or f.barcode = v_raw then 0
               when f.fname like v_q || '%' then 1
               when position(' ' || v_q in ' ' || f.fname) > 0 then 2
               else 3 end end asc,
        f.name collate "tr-TR-x-icu" asc,
        f.id asc) as rn
    from f
  ), t as (
    select count(*)::int as total from f
  ), pg as (
    select t.total, least(greatest(coalesce(p_page, 1), 1), greatest(1, ceil(t.total::numeric / v_size)::int)) as page from t
  )
  select jsonb_build_object(
    'total', pg.total,
    'page', pg.page,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'barcode', o.barcode, 'unit_label', o.unit_label,
        'price', o.price, 'sale_price', o.sale_price, 'stock', o.stock, 'critical_stock', o.critical_stock,
        'image_url', o.image_url, 'emoji', o.emoji, 'is_active', o.is_active, 'category_id', o.category_id,
        'info_updated_at', o.info_updated_at, 'cost', o.cost, 'dup_n', o.dup_n, 'dup_b', o.dup_b) order by o.rn)
      from o where o.rn > (pg.page - 1) * v_size and o.rn <= pg.page * v_size), '[]'::jsonb),
    'ids', case when p_want_ids and pg.total <= 3000
      then (select coalesce(jsonb_agg(o.id order by o.rn), '[]'::jsonb) from o) end,
    'cat_counts', (select coalesce(jsonb_object_agg(s.category_id, s.n), '{}'::jsonb)
                   from (select category_id, count(*) n from allp where category_id is not null group by category_id) s),
    'dup_groups', (select count(distinct nkey) from allp where dup_n > 0 or dup_b > 0),
    'with_cost', (select count(*) from allp where is_active and cost is not null),
    'avg_margin', (select avg(coalesce(mpct, 0)) from allp where is_active and cost is not null)
  ) into v_res
  from pg;

  return v_res;
end;
$$;

revoke all on function public.admin_product_page(text, uuid[], text, text, text, int, int, boolean) from public, anon;
grant execute on function public.admin_product_page(text, uuid[], text, text, text, int, int, boolean) to authenticated;
