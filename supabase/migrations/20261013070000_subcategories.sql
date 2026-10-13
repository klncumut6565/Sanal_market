-- Alt kategoriler: categories.parent_id (en fazla 2 seviye).
-- Alt kategori görünürlük / 22-06 yasağı / aktiflik ayarlarını üst kategoriden devralır
-- (tetikleyici kopyalar), böylece mevcut tüm görünürlük kuralları aynen çalışır.
alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
create index if not exists categories_parent_idx on public.categories (parent_id);

create or replace function public.categories_inherit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare p public.categories;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then raise exception 'KENDI_ALTI_OLAMAZ'; end if;
    select * into p from public.categories where id = new.parent_id;
    if p.id is null then raise exception 'UST_KATEGORI_YOK'; end if;
    if p.parent_id is not null then raise exception 'IKI_SEVIYE'; end if;
    if exists (select 1 from public.categories where parent_id = new.id) then raise exception 'ALTI_OLAN_ALT_OLAMAZ'; end if;
    new.visibility := p.visibility;
    new.night_ban := p.night_ban;
    if not p.is_active then new.is_active := false; end if;
  end if;
  return new;
end;
$$;
create trigger categories_inherit_trg before insert or update on public.categories
  for each row execute function public.categories_inherit();

create or replace function public.categories_propagate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is null and (new.visibility is distinct from old.visibility or new.night_ban is distinct from old.night_ban or (old.is_active and not new.is_active)) then
    update public.categories c
       set visibility = new.visibility,
           night_ban = new.night_ban,
           is_active = case when new.is_active then c.is_active else false end
     where c.parent_id = new.id;
  end if;
  return null;
end;
$$;
create trigger categories_propagate_trg after update on public.categories
  for each row execute function public.categories_propagate();

-- Sıralama artık kardeşler arasında (aynı üst kategori altında)
create or replace function public.admin_place_category(p_id uuid, p_pos integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_pos int;
  v_parent uuid;
begin
  if not public.is_admin() then
    raise exception 'YETKISIZ' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('categories_order', 0));
  select parent_id into v_parent from public.categories where id = p_id;

  select coalesce(array_agg(id order by sort_order, name), '{}') into v_ids
    from public.categories where id <> p_id and parent_id is not distinct from v_parent;

  v_pos := greatest(1, least(coalesce(p_pos, cardinality(v_ids) + 1), cardinality(v_ids) + 1));
  v_ids := v_ids[1:v_pos - 1] || p_id || v_ids[v_pos:];

  update public.categories c
     set sort_order = o.n
    from unnest(v_ids) with ordinality as o(id, n)
   where c.id = o.id and c.sort_order is distinct from o.n;
end;
$$;
