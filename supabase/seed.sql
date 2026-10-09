-- Örnek katalog (geliştirme/deneme için). Canlıda kendi ürünlerinizi admin panelinden girin.

insert into public.categories (name, slug, emoji, sort_order) values
  ('Meyve & Sebze',      'meyve-sebze',      '🍎', 1),
  ('Süt & Kahvaltılık',  'sut-kahvaltilik',  '🥛', 2),
  ('Fırından',           'firindan',         '🥖', 3),
  ('Et, Tavuk & Balık',  'et-tavuk-balik',   '🍗', 4),
  ('Temel Gıda',         'temel-gida',       '🍝', 5),
  ('Atıştırmalık',       'atistirmalik',     '🍫', 6),
  ('İçecek',             'icecek',           '🥤', 7),
  ('Temizlik',           'temizlik',         '🧽', 8),
  ('Kişisel Bakım',      'kisisel-bakim',    '🧴', 9)
on conflict (slug) do nothing;

with c as (select id, slug from public.categories)
insert into public.products (category_id, name, slug, unit_label, price, sale_price, stock, emoji, is_featured)
select c.id, v.name, v.slug, v.unit_label, v.price, v.sale_price, v.stock, v.emoji, v.featured
from (values
  ('meyve-sebze',     'Muz',                        'muz',                    '1 kg',     64.90, null::numeric, 40, '🍌', true),
  ('meyve-sebze',     'Domates',                    'domates',                '1 kg',     39.90, 32.90,        60, '🍅', true),
  ('meyve-sebze',     'Salatalık',                  'salatalik',              '1 kg',     34.90, null,         50, '🥒', false),
  ('meyve-sebze',     'Kırmızı Elma',               'kirmizi-elma',           '1 kg',     44.90, null,         45, '🍎', false),
  ('meyve-sebze',     'Patates',                    'patates',                '2 kg',     49.90, 42.90,        30, '🥔', false),
  ('sut-kahvaltilik', 'Tam Yağlı Süt',              'tam-yagli-sut',          '1 L',      42.50, null,         80, '🥛', true),
  ('sut-kahvaltilik', 'Beyaz Peynir',               'beyaz-peynir',           '500 g',   189.90, 169.90,       25, '🧀', true),
  ('sut-kahvaltilik', 'Yumurta',                    'yumurta-15li',           '15''li',  109.90, null,         40, '🥚', true),
  ('sut-kahvaltilik', 'Süzme Yoğurt',               'suzme-yogurt',           '1 kg',     89.90, null,         30, '🥣', false),
  ('sut-kahvaltilik', 'Siyah Zeytin',               'siyah-zeytin',           '500 g',   124.90, null,         20, '🫒', false),
  ('firindan',        'Ekmek',                      'ekmek',                  '250 g',    15.00, null,        100, '🍞', true),
  ('firindan',        'Simit',                      'simit',                  '1 adet',   17.50, null,         60, '🥯', false),
  ('et-tavuk-balik',  'Tavuk Göğüs',                'tavuk-gogus',            '1 kg',    249.90, 219.90,       20, '🍗', false),
  ('et-tavuk-balik',  'Dana Kıyma',                 'dana-kiyma',             '500 g',   324.90, null,         15, '🥩', false),
  ('temel-gida',      'Makarna',                    'makarna',                '500 g',    24.90, 19.90,        90, '🍝', true),
  ('temel-gida',      'Pirinç',                     'pirinc',                 '1 kg',     79.90, null,         40, '🍚', false),
  ('temel-gida',      'Ayçiçek Yağı',               'aycicek-yagi',           '2 L',     189.90, 174.90,       25, '🌻', false),
  ('temel-gida',      'Toz Şeker',                  'toz-seker',              '1 kg',     44.90, null,         50, '🧂', false),
  ('atistirmalik',    'Sütlü Çikolata',             'sutlu-cikolata',         '80 g',     34.90, 27.90,        70, '🍫', true),
  ('atistirmalik',    'Patates Cipsi',              'patates-cipsi',          '150 g',    44.90, null,         60, '🥔', false),
  ('icecek',          'Su',                         'su-5l',                  '5 L',      29.90, null,        100, '💧', true),
  ('icecek',          'Maden Suyu',                 'maden-suyu',             '6x200 ml', 44.90, null,         60, '🫧', false),
  ('icecek',          'Portakal Suyu',              'portakal-suyu',          '1 L',      54.90, 46.90,        35, '🍊', false),
  ('icecek',          'Çay',                        'cay',                    '1 kg',    289.90, null,         20, '🍵', false),
  ('temizlik',        'Bulaşık Deterjanı',          'bulasik-deterjani',      '750 ml',   69.90, 59.90,        30, '🧴', false),
  ('temizlik',        'Kağıt Havlu',                'kagit-havlu',            '6''lı',   119.90, null,         25, '🧻', false),
  ('kisisel-bakim',   'Şampuan',                    'sampuan',                '500 ml',  129.90, null,         20, '🧴', false),
  ('kisisel-bakim',   'Diş Macunu',                 'dis-macunu',             '75 ml',    59.90, 49.90,        30, '🪥', false)
) as v(cat, name, slug, unit_label, price, sale_price, stock, emoji, featured)
join c on c.slug = v.cat
on conflict (slug) do nothing;
