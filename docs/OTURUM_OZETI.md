# Oturum özeti — 2026-10-10

## Tamamlanan
- Next.js 16 + Supabase + Tailwind 4 iskeleti kuruldu (boş repoya ilk commit).
- Veritabanı: kategoriler, ürünler, market ayarları, siparişler, sipariş kalemleri, profiller; RLS; `place_order`, `get_order_public`, `admin_set_order_status`, `search_products` fonksiyonları; ürün görselleri için Storage bucket.
- Müşteri sitesi (Yemeksepeti Market düzeni): ana sayfa, kategori, arama, ürün detayı, sepet, ödeme, sipariş takibi, siparişlerim, giriş/kayıt.
- Yönetim paneli: genel bakış, siparişler (+detay/durum), ürünler (+görsel yükleme, hızlı stok), kategoriler, ayarlar.
- SQL fonksiyonları PGlite üzerinde test edildi (stok düşümü, limit, min. tutar, ödeme/saat doğrulama, iptalde stok iadesi, yetki).
- Uçtan uca tarayıcı testi: sepete ekleme → ödeme (kapıda POS) → sipariş takip sayfası çalışıyor.

## Kararlar
- Tek market, tek katalog; Redux yerine Zustand; route group yapısı `(shop)` / `admin`.
- Ödeme: kapıda nakit + kapıda POS. iyzico sonra.
- Misafir sipariş açık; takip `id + access_token` ile.
- Font: Nunito Sans (self-hosted, @fontsource).
- Sesli asistan ertelendi.

## Açık işler / sonraki adımlar
1. ✅ Supabase projesi (Sanal_market, ref enyrrmnpwfdmfxrjurlv) kuruldu: migration + seed (9 kategori, 28 ürün) + güvenlik sertleştirmesi uygulandı. Kalan: admin rolü ataması (kullanıcı üye olduktan sonra).
2. Vercel'e bağlama ve ortam değişkenleri.
3. Arayüzün kullanıcı isteğine göre ince ayarı (renk, logo, banner, kart düzeni).
4. Yasal sayfalar (mesafeli satış, ön bilgilendirme, KVKK).
5. iyzico entegrasyonu → kampanyalar → raporlama → sesli asistan.

## 2026-10-10 (akşam) — Logo ve marka
- Kullanıcının logosu eklendi: public/logo.png (tam logo), public/logo-mark.png (kurye işareti), src/app/icon.png + apple-icon.png.
- Renkler logoya göre turuncu (#f26a12) + koyu lacivert-siyah (#151c23).
- Header: logo + "SanalMarket" yazısı + çalışma saatleri rozeti. Ana sayfa banner: "İhtiyacın Kapında!", motokurye, kapıda nakit/kart, 10:00 - 01:00.
- store_settings.working_hours alanı eklendi (admin → Ayarlar'dan değişir); teslimat aralıkları 10:00 - 01:00'e göre güncellendi (Supabase'e uygulandı).
- Vercel girişi 2FA kilidinde; kullanıcı hesabı kurtaracak. Sonra: import + 2 env + deploy, Supabase Auth URL ayarı, admin rolü.

## 2026-10-10 — Sipariş zili + WhatsApp
- Yönetim panelinde yeni sipariş zili (components/admin/NewOrderAlarm.tsx): 8 sn'de bir kontrol, yeni siparişte 20 sn "ding-dong", turuncu banner, sekme başlığı, tarayıcı bildirimi, sustur butonu. Ses için panelde bir kez dokunmak gerekiyor (tarayıcı kuralı). Test edildi: ~20.4 sn çalıp duruyor.
- Sipariş detayında WhatsApp butonları (hazır şablonlar + serbest mesaj) — wa.me bağlantısı, admin cihazındaki WhatsApp hesabından gönderilir. lib/whatsapp.ts numarayı 90 formatına çevirir.
- store_settings.whatsapp_phone eklendi (Supabase'e uygulandı); doluysa müşteri sipariş sayfasında "WhatsApp'tan bize yaz" butonu çıkar.
- Not: WhatsApp gerçek, SMS/arama ile doğrulanmış numara ister; kişisel numarayı gizlemek için ayrı hat (ikinci SIM / sanal numara) + WhatsApp Business önerildi.

## 2026-10-10 — Vercel yayını
- Site: https://sanalmarket.vercel.app (Vercel projesi: sanal_market).
- /api/durum teşhisi: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY Vercel'de tanımsızdı → giriş/üyelik ve katalog çalışmıyordu.
- Çözüm: src/lib/supabase/env.ts içine proje URL + publishable key yedek değer olarak eklendi (herkese açık değerler).
- Giriş/üyelik hataları Türkçeleştirildi (lib/auth-errors.ts), Türkçe hata sayfaları (app/error.tsx, global-error.tsx).
- Açık: Supabase Auth → "Confirm email" kapatılmalı (varsayılan SMTP müşterilere e-posta göndermez); Site URL = https://sanalmarket.vercel.app; admin rolü ataması.

## 2026-10-10 — Barkod, ayarlar
- Admin: klncumut65@gmail.com (Umut Kılınç) → role=admin.
- Ayarlar (Supabase'e yazıldı): whatsapp_phone=+905416735863 (DENEME, gerçek numarayla değişecek), delivery_fee=130 TL.
- products.barcode (unique) eklendi. /admin/barkod: kamerayla (zxing, iOS Safari dahil) veya el okuyucuyla barkod → fiyat/indirim/stok hızlı güncelle; bulunamazsa "Yeni ürün olarak ekle" (barkod dolu gelir). Ürün formunda barkod alanı + "Okut" butonu; ürün listesinde barkodla arama.
- Kamera okuma sahte kamera ile test edildi (EAN-13 doğru okundu). Gerçek telefonla test kullanıcıda.
- Telefon alanı: +90 sabit önek, 541 673 58 63 biçimi (components/PhoneInput.tsx, lib/phone.ts), +905xxxxxxxxx olarak saklanır.

## 2026-10-11 — Sipariş akışı + süre göstergesi
- orders: preparing_at / dispatched_at / delivered_at / cancelled_at; admin_set_order_status bunları doldurur (Supabase'e uygulandı).
- store_settings: sla_accept_min=2, sla_prepare_min=7, sla_delivery_min=20 (Admin → Ayarlar'dan değişir).
- /admin/siparisler "Açık siparişler (pano)": 3 sütun (Yeni / Hazırlanıyor / Kurye yolda), her kartta canlı süre çubuğu (yeşil→kırmızı) ve tek tık sonraki adım butonu (Onayla · Hazırlamaya başla → Hazır · Kuryeye ver → Teslim edildi) + onaylı İptal.
- Sipariş detayında adım çizelgesi (1-2-3-4) + büyük süre çubuğu + sonraki adım butonu; teslimde toplam süre.

## 2026-10-11 — Yapılandırılmış teslimat adresi
- Tablolar: delivery_districts (Tekirdağ 11 ilçe, yalnızca Çorlu aktif), delivery_neighborhoods (Çorlu 26 mahalle — atlasbig + hangisemt ile doğrulandı), delivery_streets (BOŞ — admin dolduracak).
- orders.addr_* alanları; place_order artık ilçe/mahalle/sokak(id veya yazı)/dış kapı zorunlu, iç kapı + apartman/site isteğe bağlı; address metni otomatik oluşur.
- Ödeme: AddressPicker (İl Tekirdağ sabit, ilçe listesi Çorlu dışı pasif "yakında", mahalle → sokak, "Listede yok" ile yazma; sokağı olmayan mahallede doğrudan yazı kutusu). Son adres cihazda hatırlanır.
- Admin → Teslimat bölgeleri: ilçe aç/kapa, mahalle aç/kapa, mahalleye toplu sokak ekleme (her satıra bir), müşterilerin yazdığı sokakları tek tıkla listeye ekleme.
- AÇIK İŞ: Çorlu sokak listeleri (kaynak bulunamadı; kullanıcı/belediye listesi gerekli).
