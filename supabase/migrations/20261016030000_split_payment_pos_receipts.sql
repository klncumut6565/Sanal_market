-- PARÇALI ÖDEME + POS FİŞİ FOTOĞRAFI
-- Teslimde tahsilat nakit ve POS olarak AYRI tutulur (cash_amount + pos_amount = collected_amount).
-- collected_method: ağırlıklı yöntem (geriye uyumluluk; parçalıysa büyük olan). Parçalı = ikisi de > 0.
-- POS kısmı varsa en az bir POS fişi fotoğrafı zorunlu; fişlerin tutarları girildiyse toplamı POS tutarına eşit olmalı.
-- Yönetici fişleri sipariş detayında görür, "Onayla" / "Sorunlu" işaretler.

alter table public.orders add column if not exists cash_amount numeric(12, 2);
alter table public.orders add column if not exists pos_amount numeric(12, 2);
update public.orders
   set cash_amount = case when collected_method = 'nakit' then collected_amount else 0 end,
       pos_amount  = case when collected_method = 'pos' then collected_amount else 0 end
 where collected_method is not null and cash_amount is null;

create table if not exists public.pos_receipts (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  courier_id uuid references public.couriers (user_id) on delete set null,
  path text not null unique,
  amount numeric(12, 2),
  created_at timestamptz not null default now(),
  review_status text not null default 'bekliyor' check (review_status in ('bekliyor', 'onaylandi', 'sorunlu')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz
);
create index if not exists pos_receipts_order_idx on public.pos_receipts (order_id);
create index if not exists pos_receipts_review_idx on public.pos_receipts (review_status, created_at desc);
alter table public.pos_receipts enable row level security;
create policy pos_receipts_read on public.pos_receipts for select using (public.is_admin() or courier_id = (select auth.uid()));

-- Gizli depo: kurye yalnızca kendi klasörüne (kullanıcı id'si) yükler; yönetici hepsini, kurye kendi yüklediğini okur
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pos-receipts', 'pos-receipts', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy pos_receipts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'pos-receipts' and public.is_courier() and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy pos_receipts_view on storage.objects for select to authenticated
  using (bucket_id = 'pos-receipts' and (public.is_admin() or (storage.foldername(name))[1] = (select auth.uid())::text));

-- Yeni teslim fonksiyonu: nakit + POS ayrı, fişler [{path, amount}]
create or replace function public.courier_deliver_split(p_order_id uuid, p_cash numeric, p_pos numeric, p_note text, p_receipts jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare o public.orders; v_cash numeric := round(coalesce(p_cash, 0), 2); v_pos numeric := round(coalesce(p_pos, 0), 2);
        v_n int; v_sum numeric; v_missing int; r jsonb;
begin
  if not public.is_courier() then raise exception 'YETKISIZ'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'SIPARIS_YOK'; end if;
  if o.courier_id is distinct from auth.uid() then raise exception 'SENIN_DEGIL'; end if;
  if o.status = 'teslim_edildi' then return; end if;
  if o.status <> 'yolda' then raise exception 'ONCE_TESLIM_AL'; end if;
  if v_cash < 0 or v_pos < 0 or v_cash + v_pos > o.total * 3 + 100 then raise exception 'GECERSIZ_TUTAR'; end if;
  if v_cash + v_pos = 0 and o.total > 0 then raise exception 'GECERSIZ_TUTAR'; end if;

  v_n := coalesce(jsonb_array_length(case when jsonb_typeof(p_receipts) = 'array' then p_receipts end), 0);
  if v_pos > 0 and v_n = 0 then raise exception 'POS_FISI_GEREKLI'; end if;
  if v_n > 10 then raise exception 'COK_FAZLA_FIS'; end if;
  -- fiş yolları kuryenin kendi klasöründe ve bu siparişe ait olmalı
  select count(*) filter (where not (x ->> 'path' like auth.uid()::text || '/' || p_order_id::text || '/%')),
         sum(nullif(x ->> 'amount', '')::numeric),
         count(*) filter (where nullif(x ->> 'amount', '') is null)
    into v_missing, v_sum, v_n
    from jsonb_array_elements(coalesce(case when jsonb_typeof(p_receipts) = 'array' then p_receipts end, '[]'::jsonb)) x;
  if v_missing > 0 then raise exception 'GECERSIZ_FIS'; end if;
  -- tutar girilmiş fişlerin toplamı POS tutarını aşamaz; hepsine tutar girildiyse tam eşit olmalı
  if v_sum is not null and (v_sum > v_pos + 0.009 or (v_n = 0 and abs(v_sum - v_pos) >= 0.01)) then raise exception 'FIS_TUTARI_UYUSMUYOR'; end if;

  update public.orders
     set status = 'teslim_edildi',
         payment_status = 'odendi',
         delivered_at = now(),
         cash_amount = v_cash,
         pos_amount = v_pos,
         collected_amount = v_cash + v_pos,
         collected_method = case when v_pos > v_cash then 'pos' else 'nakit' end,
         courier_note = nullif(left(trim(coalesce(p_note, '')), 300), ''),
         delivery_issue = null, delivery_issue_at = null
   where id = p_order_id;

  for r in select * from jsonb_array_elements(coalesce(case when jsonb_typeof(p_receipts) = 'array' then p_receipts end, '[]'::jsonb)) loop
    insert into public.pos_receipts (order_id, courier_id, path, amount)
    values (p_order_id, auth.uid(), r ->> 'path', round(nullif(r ->> 'amount', '')::numeric, 2))
    on conflict (path) do nothing;
  end loop;
end;
$$;
grant execute on function public.courier_deliver_split(uuid, numeric, numeric, text, jsonb) to authenticated;

-- Eski teslim fonksiyonu: tek yöntem → yenisine yönlendirir (POS ise fiş zorunluluğu uygulanır)
create or replace function public.courier_deliver(p_order_id uuid, p_method text, p_amount numeric, p_note text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_method not in ('nakit', 'pos') then raise exception 'GECERSIZ_YONTEM'; end if;
  perform public.courier_deliver_split(p_order_id,
    case when p_method = 'nakit' then p_amount else 0 end,
    case when p_method = 'pos' then p_amount else 0 end, p_note, '[]'::jsonb);
end;
$$;

-- Yönetici fiş kontrolü
create or replace function public.admin_review_receipt(p_id bigint, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  if p_status not in ('bekliyor', 'onaylandi', 'sorunlu') then raise exception 'GECERSIZ_DURUM'; end if;
  update public.pos_receipts
     set review_status = p_status, review_note = nullif(left(trim(coalesce(p_note, '')), 300), ''),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
end;
$$;
grant execute on function public.admin_review_receipt(bigint, text, text) to authenticated;

-- Hesaplaşma: nakit ve POS ayrı sütunlardan
create or replace function public.admin_settle_courier(p_courier_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint; v_n int; v_cash numeric; v_pos numeric; v_fee numeric;
begin
  if not public.is_admin() then raise exception 'YETKISIZ'; end if;
  select count(*), coalesce(sum(coalesce(cash_amount, 0)), 0), coalesce(sum(coalesce(pos_amount, 0)), 0)
    into v_n, v_cash, v_pos
    from public.orders
   where courier_id = p_courier_id and status = 'teslim_edildi' and settlement_id is null and collected_method is not null;
  if v_n = 0 then raise exception 'HESAPLASACAK_YOK'; end if;
  select v_n * per_delivery_fee into v_fee from public.couriers where user_id = p_courier_id;
  insert into public.courier_settlements (courier_id, created_by, order_count, cash_amount, pos_amount, fee_amount, note)
  values (p_courier_id, auth.uid(), v_n, v_cash, v_pos, coalesce(v_fee, 0), nullif(left(trim(coalesce(p_note, '')), 300), ''))
  returning id into v_id;
  update public.orders set settlement_id = v_id
   where courier_id = p_courier_id and status = 'teslim_edildi' and settlement_id is null and collected_method is not null;
  return jsonb_build_object('id', v_id, 'orders', v_n, 'cash', v_cash, 'pos', v_pos, 'fee', coalesce(v_fee, 0));
end;
$$;

-- Kurye geçmişi: nakit / POS ayrı + fiş sayısı (kişisel veri yok)
create or replace function public.courier_history2(p_from timestamptz, p_to timestamptz, p_unsettled boolean default false)
returns table (id uuid, order_no bigint, area text, payment_method text, total numeric, collected_method text, collected_amount numeric,
               cash_amount numeric, pos_amount numeric, receipts int, courier_note text, dispatched_at timestamptz, picked_up_at timestamptz,
               delivered_at timestamptz, settlement_id bigint)
language sql stable security definer set search_path to 'public' as $$
  select o.id, o.order_no, coalesce(nullif(o.addr_neighborhood, ''), 'Teslimat'), o.payment_method, o.total, o.collected_method, o.collected_amount,
         coalesce(o.cash_amount, case when o.collected_method = 'nakit' then o.collected_amount else 0 end),
         coalesce(o.pos_amount, case when o.collected_method = 'pos' then o.collected_amount else 0 end),
         (select count(*)::int from public.pos_receipts r where r.order_id = o.id),
         o.courier_note, o.dispatched_at, o.picked_up_at, o.delivered_at, o.settlement_id
    from public.orders o
   where public.is_courier() and o.courier_id = auth.uid() and o.status = 'teslim_edildi'
     and (case when p_unsettled then o.settlement_id is null
               else o.delivered_at >= p_from and o.delivered_at < p_to end)
   order by o.delivered_at desc
   limit 2000;
$$;
grant execute on function public.courier_history2(timestamptz, timestamptz, boolean) to authenticated;
