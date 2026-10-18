-- Ürün görselleri yalnızca WebP: yükleme sunucuda sharp ile WebP'ye çevrilir (≤1000 px).
-- Depo kuralı (filtre): product-images kovası yalnızca image/webp kabul eder, en fazla 1 MB.
update storage.buckets
   set allowed_mime_types = array['image/webp'],
       file_size_limit = 1048576
 where id = 'product-images';

-- Yönetici: WebP olmayan (sıkıştırılmamış) ürün görselleri ve bir ürün/kategoride kullanılıp kullanılmadığı
create or replace function public.admin_nonwebp_images()
returns table (name text, size bigint, created_at timestamptz, referenced boolean)
language sql stable security definer
set search_path = public, storage as $$
  select o.name, (o.metadata->>'size')::bigint, o.created_at,
    exists (
      select 1 from public.products p
      where p.image_url like '%/product-images/' || o.name
         or exists (select 1 from unnest(coalesce(p.extra_images, '{}')) u where u like '%/product-images/' || o.name)
    ) or exists (select 1 from public.categories c where c.image_url like '%/product-images/' || o.name)
  from storage.objects o
  where o.bucket_id = 'product-images'
    and coalesce(o.metadata->>'mimetype', '') <> 'image/webp'
    and public.is_admin()
  order by o.created_at
$$;

revoke all on function public.admin_nonwebp_images() from public, anon;
grant execute on function public.admin_nonwebp_images() to authenticated;
