# Sanal Market

Tek marketli online market uygulaması — Yemeksepeti Market düzeninde müşteri sitesi + aynı uygulama içinde yönetim paneli.

**Teknoloji:** Next.js 16 (App Router, Cache Components) · Supabase (Postgres, Auth, Storage, RLS) · Tailwind CSS 4 · Zustand · Vercel

## Özellikler (v1)

**Müşteri sitesi**
- Solda kategori menüsü, ortada ürün ızgarası, sağda sabit sepet (masaüstü)
- Mobilde yatay kategori şeridi + altta sabit "Sepete git" çubuğu
- `+` butonu sepete eklenince `– 1 +` sayacına dönüşür
- Türkçe karakter duyarsız arama (`sut` → Süt, `cay` → Çay)
- İndirim rozetleri, tükendi göstergesi, ücretsiz teslimat ilerleme çubuğu, minimum sepet tutarı
- Üye olmadan sipariş (misafir) veya e-posta/şifre ile üyelik
- Ödeme: **Kapıda nakit** · **Kapıda kart (POS)** — online kart (iyzico) sonraki aşamada
- Teslimat saati seçimi, sipariş takip sayfası (20 sn'de bir otomatik yenilenir)

**Yönetim paneli (`/admin`)**
- Genel bakış: günlük sipariş/ciro, bekleyen sipariş, kritik stok
- Siparişler: durum sekmeleri, toplama listesi, tek tıkla sonraki duruma geçiş, iptalde otomatik stok iadesi
- Ürünler: ekleme/düzenleme, görsel yükleme (Supabase Storage), hızlı stok güncelleme, satışta/pasif
- Kategoriler ve market ayarları (teslimat ücreti, ücretsiz teslimat eşiği, min. sipariş, teslimat saatleri, açık/kapalı)

## Güvenlik kuralları (veritabanında uygulanır)
- Sipariş yalnızca `place_order` fonksiyonuyla oluşur: fiyat ve stok **sunucuda** yeniden hesaplanır, istemcinin gönderdiği fiyat kullanılmaz
- Stok düşümü atomik (`stock >= adet` koşullu UPDATE) — eşzamanlı siparişte eksiye düşmez
- Sipariş satırlarına sipariş anındaki fiyat yazılır
- Tüm tablolarda RLS; yönetici yetkisi `profiles.role = 'admin'` ile sunucu tarafında kontrol edilir, kullanıcı kendi rolünü değiştiremez
- Kapıda ödemelerde `payment_status = beklemede`, teslimde `odendi` olur

## Kurulum

### 1. Supabase
1. Yeni proje oluştur.
2. **SQL Editor**'de sırasıyla çalıştır:
   - `supabase/migrations/20261010000000_init.sql`
   - (isteğe bağlı örnek ürünler) `supabase/seed.sql`
3. **Authentication → URL Configuration**: Site URL = canlı adres; Redirect URL'lere `https://<alan-adı>/auth/confirm` ekle.

### 2. Yönetici hesabı
Siteden `/giris` → **Üye ol** ile kayıt ol, sonra SQL Editor'de:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'SENIN@EPOSTAN.com');
```

### 3. Ortam değişkenleri
`.env.example` → `.env.local` (yerel) ve Vercel → Project Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=
```

### 4. Çalıştırma
```bash
npm install
npm run dev
```

### 5. Vercel
Repo'yu Vercel'e import et, ortam değişkenlerini gir, deploy et.

## Klasör yapısı
```
src/
  app/
    (shop)/(browse)/     ana sayfa, kategori, arama, ürün detayı (3 kolonlu düzen)
    (shop)/sepet         mobil sepet
    (shop)/odeme         ödeme + placeOrder server action
    (shop)/siparis/[id]  sipariş takibi
    (shop)/siparislerim  hesabım / siparişlerim
    admin/               yönetim paneli + server actions
    giris/, auth/confirm giriş, kayıt, e-posta doğrulama
  components/shop|admin  arayüz bileşenleri
  lib/data               katalog (önbellekli) ve yetki katmanı
  lib/supabase           sunucu/istemci/proxy istemcileri
  store/cart.ts          sepet (Zustand, localStorage)
supabase/
  migrations/            şema, RLS, RPC fonksiyonları
  seed.sql               örnek katalog
```

## Yol haritası
- [ ] iyzico ile online kart ödemesi
- [ ] Kampanyalar (başlangıç/bitiş tarihli indirim)
- [ ] Müşteriler ekranı, raporlama
- [ ] Ön bilgilendirme formu / mesafeli satış sözleşmesi / KVKK sayfaları
- [ ] Sesli asistan
