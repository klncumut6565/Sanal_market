-- Çorlu mahalleleri semtlere göre gruplanır (sahibinden düzeni);
-- teslimat yapılmayan mahalleler pasif.
alter table public.delivery_neighborhoods add column if not exists semt text;

update public.delivery_neighborhoods n
   set semt = m.semt
  from (values
    ('Deregündüzlü','Köyler'),('Maksutlu','Köyler'),('Önerler','Köyler'),('Sarılar','Köyler'),
    ('Seymen','Köyler'),('Şahpaz','Köyler'),('Türkgücü','Köyler'),
    ('Alipaşa','Merkez'),('Cumhuriyet','Merkez'),('Havuzlar','Merkez'),('Hürriyet','Merkez'),('Rumeli','Merkez'),
    ('Çobançeşme','Sanayi'),('Hıdırağa','Sanayi'),('Muhittin','Sanayi'),('Reşadiye','Sanayi'),('Şeyhsinan','Sanayi'),('Zafer','Sanayi'),
    ('Cemaliye','Silahtar'),('Esentepe','Silahtar'),('Hatip','Silahtar'),('Kazımiye','Silahtar'),
    ('Kemalettin','Silahtar'),('Nusratiye','Silahtar'),('Silahtarağa','Silahtar'),
    ('Yenice','Yenice')
  ) as m(name, semt),
  public.delivery_districts d
 where n.district_id = d.id and d.name = 'Çorlu' and n.name = m.name;

-- Teslimat yapılmayan bölgeler: Köyler semti, Silahtarağa, Yenice
update public.delivery_neighborhoods n
   set is_active = false
  from public.delivery_districts d
 where n.district_id = d.id and d.name = 'Çorlu'
   and (n.semt = 'Köyler' or n.name in ('Silahtarağa', 'Yenice'));
