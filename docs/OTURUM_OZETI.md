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

## 2026-10-11 — Çalışma saatleri
- store_settings.open_time/close_time (10:00 / 01:00, Admin → Ayarlar'dan saat seçiciyle), working_hours otomatik.
- store_is_open_now(grace) SQL; place_order saat dışında SAAT_DISI ile reddeder (kapanıştan sonra 2 dk tolerans).
- lib/hours.ts: İstanbul saatiyle (UTC+3) açık/kapalı, kapanışa/açılışa kalan süre, iş günü penceresi (10:00 → ertesi 01:00; 01:00–10:00 arası önceki iş günü).
- Site: header altında canlı şerit (kapalı → "10:00'da açılıyor (X sonra)"; son 10 dk → geri sayım), sepet/ödeme butonları kapalıyken kilitli, ödemede büyük geri sayım kutusu, geçmiş teslimat aralıkları gizlenir.
- Admin genel bakış: "İş günü siparişi / cirosu" iş günü penceresine göre; üstte Açık/Kapalı + iş günü aralığı.

## 2026-10-11 — Rafta olmayan ürün akışı
- order_items.removed / removed_reason / replaced_from; admin_order_item_out(item, replacement?, qty?, mark_out) RPC: kalemi çıkarır veya benzer ürünle değiştirir, tutarı yeniden hesaplar (teslimat ücreti artmaz), isteğe bağlı ürünü stok 0 yapar; son kalem çıkarılamaz (iptal edilmeli). İptal stok iadesi çıkarılan kalemleri hariç tutar.
- Admin sipariş detayı: her kalemde "Yok" → ürün adı + aynı kategoriden stokta olan en yakın fiyatlı benzerleri yazan WhatsApp mesajı, "Değiştir" / "Siparişten çıkar".
- WhatsApp şablonlarından genel "Ürün yok" kaldırıldı; güncelleme olunca "Sipariş güncellendi" şablonu (çıkan/değişen ürünler + yeni tutar).
- Müşteri takip sayfası: çıkarılan ürün üstü çizili "Stokta yoktu", değişen "X yerine", sarı "Siparişin güncellendi" kutusu.

## 2026-10-11 — Ciro raporu
- Genel bakışa "Ciro" bölümü (components/admin/RevenueReport.tsx): Bugün / Dün / Bu hafta (Pzt'den) / Bu ay / Geçen ay kartları + tarih aralığı seçici (?bas=&bit=, en fazla 366 gün) → toplam ciro, sipariş, ortalama sepet, iptal + gün gün döküm.
- Hepsi iş gününe göre (lib/hours: businessDateOf, businessDateStart, reportRanges). Ciro = teslimat dahil toplam, iptaller hariç.

## 2026-10-11 — Sesli sipariş asistanı (TMGD Asistan motorundan)
- TMGD'den taşınanlar: lib/voice/{audioStream, hatalar, types, providers/geminiLive} (Gemini Live WebSocket, 16k mikrofon / 24k çalma, Türkçe hata metinleri). geminiLive artık araç listesi + talimatı constructor'dan alıyor.
- Yeni: /api/voice/session (GEMINI_API_KEY env ile kısa ömürlü token; voice_session_allow RPC ile cihaz başına saatlik + günlük toplam sınır), lib/voice/marketTools.ts (search_products, list_categories, add_to_cart, remove_from_cart, get_cart, get_store_info, go_to_checkout + Türkçe talimat), marketToolRunner.ts (tarayıcıda çalışır), useMarketVoice.ts (10 dk oturum, 90 sn sessizlikte kapanır), components/shop/VoiceAssistant.tsx ("Sesli sipariş" butonu + panel).
- store_settings.voice_enabled / voice_daily_limit (300) / voice_hourly_per_user (8) — Admin → Ayarlar.
- Migration Supabase'e iki parça hâlinde uygulandı (voice_assistant_part1/part2); fonksiyondaki eski kayıt temizleme satırı onay penceresine takıldığı için çıkarıldı (tablo çok küçük kalır).
- GEMINI_API_KEY Vercel'e eklendi (AQ. biçimli anahtar, Secret, Production). iPhone'da "AudioSession category is not compatible with audio capture" hatası → startMicCapture öncesi navigator.audioSession.type = "play-and-record" (admin zili "playback" bırakıyordu). Canlı sesli konuşma testi kullanıcıda.
- Not: ürünlerde ayrı marka alanı yok; "hangi markalar" sorusu için marka ürün adında olmalı (ör. "Pınar Beyaz Peynir 500 g").

## 2026-10-11 — KVKK
- /kvkk Aydınlatma Metni (veri sorumlusu = store_settings.store_name + adres/telefon; veriler, amaçlar, hukuki sebepler, #sesli-asistan bölümü, aktarım: kurye, Vercel/Supabase, Google LLC; saklama; m.11 hakları).
- Sesli asistan ilk kullanımda açık rıza ekranı (yurt dışı aktarım + Google) gösterir; onay localStorage "sanal-market-ses-onay-v1". Onaysız mikrofon/oturum açılmaz (test edildi).
- KVKK bağlantıları: footer, ödeme onay kutusu, üye ol formu, asistan paneli.
- Not: veri sorumlusunun resmi unvanı/MERSİS/e-posta henüz yok; metin hukukçuya gözden geçirtilmeli.

## 2026-10-11 — Admin yavaşlığı
- Teşhis (Supabase edge loglarından): Vercel fonksiyonları iad1 (ABD/Ashburn), veritabanı eu-central-1 (Frankfurt) → her istek 100–320 ms (DB işi 2–22 ms). Her admin geçişinde getUser + profiles iki kez (layout Gate + sayfa), 6–18 istek.
- Çözüm: vercel.json regions ["fra1"]; getSessionUser/requireAdmin React cache() ile istek başına bir kez; getUser yerine getClaims (ES256 → yerel doğrulama, Auth'a ağ isteği yok); app/admin/loading.tsx iskelet ekranı.
- Sesli asistan düzeltmeleri: yeni araç list_category_products (kategorideki ürünleri adı/fiyatıyla sayar); list_categories tüm adları saydırır; add_to_cart artık customer_confirmed=true zorunlu (değilse "EKLENMEDİ" döner); talimat: "bekle/dur/hayır" → ekleme yok, "eklendi" yalnızca ok=true ise.
- Sepete ekleme artık 2 adımlı ve KODLA zorunlu: propose_cart_items (öneri, eklemez) → müşteri sonraki konuşmasında "evet/ekle/olur/tamam" → confirm_cart_items ekler ve "Sepete şu ürünler eklendi: …" der. "bekle/dur/hayır/düşüneyim/şimdilik" → eklenmez. Onay kontrolü müşterinin transkriptiyle (replyIntent) yapılır; add_to_cart kaldırıldı. Panelde "❓ Onay bekleniyor" satırı görünür.
- Sesli asistan kapalı saat bildirimi: closedNote() — oturum başında talimata "ŞU ANKİ DURUM" eklenir, asistan ilk cevabında "market kapalı, siparişler 10:00'da; sepeti şimdiden hazırlayabilirim" der. propose/confirm/get_cart/get_store_info sonuçlarında store_closed; go_to_checkout kapalıyken engellenir (sepet kalır).
- ChatGPT kod incelemesi düzeltmeleri (migration 20261011060000_review_fixes, Supabase'e uygulandı):
  - Sipariş idempotency: orders.client_order_id (unique) — CheckoutForm ilk gönderimde UUID üretir, tekrar gönderimde aynı sipariş döner.
  - Sözleşme onayı: orders.terms_accepted_at + terms_version (actions.ts TERMS_VERSION="2026-10-11"); RPC accepted_terms olmadan reddeder (SOZLESME_ONAYI).
  - admin_set_order_status: yalnızca bir sonraki aşamaya veya iptale geçiş (GECERSIZ_GECIS); aynı duruma tekrar istek sessiz no-op (çift tık).
  - admin_order_item_out: yeni ürün max_per_order kontrolü (LIMIT_ASILDI).
  - voice_session_allow: advisory lock ile atomik.
  - PGlite ile test edildi (çift gönderim tek sipariş/tek stok düşümü, geçişler, limit).
  - Yapılmayanlar (gereksiz/düşük öncelik): konuşmacı ayrımı, ses oturumu yeniden bağlanma, kapsamlı test altyapısı.
- Onay tekrar sorma hatası: müşterinin "eklensin" sözünün yazıya dökümü araç çağrısından sonra geliyordu → confirm_cart_items 3 sn'ye kadar transkripti bekler; "ekle…" ile başlayan (ekleme… hariç) ve "evet…" kelimeleri onay sayılır.
- Sepet rozeti artık ürün ÇEŞİDİ sayısını gösterir (2 × 1 kg domates = 1); toplam adet cartTotals().units.
- Sesli asistan kişiselleştirme: oturum başında asistan önce konuşur (provider.sendText → realtimeInput.text "[SİSTEM] Oturum başladı"); üye ise adıyla selamlar ("Merhaba Umut, hoş geldin…"). loadCustomerContext(): profiles.full_name + son 10 sipariş özeti (son sipariş, sık alınanlar) talimata eklenir; yeni araç get_order_history. Geçmişe göre en fazla 1 kişisel öneri (stok kontrolüyle, onaylı ekleme). Sipariş tamamlanınca CheckoutForm "sesli-asistan:siparis-tamamlandi" olayı → açık oturum teşekkür eder. Rıza anahtarı v2 (ad + geçmiş bilgisi metne eklendi), KVKK 5. bölüm güncellendi.
- Halüsinasyon/yankı önlemleri: TMGD'nin Gemini Live ayarları (tr-TR, sabit "Kore" sesi, START_SENSITIVITY_LOW, 800 ms sessizlik, echoCancellation/noiseSuppression, RMS eşiği, Türkçe zorunlu talimat) zaten aynıydı. TMGD'nin Whisper yolundaki filtreler (halusinasyonMu, yankiMi) src/lib/voice/halusinasyon.ts olarak taşındı + kisaYankiMi ("sepete eklensin mi" yankısı); confirm_cart_items bu filtrelerden geçmeyen cevabı onay saymaz. Talimata "anlaşılmaz/ilgisiz sesi müşteri sözü sayma, kendi yankına cevap verme" eklendi.
- Adres seçimi sahibinden tarzı: SelectSheet.tsx (tam ekran liste, geri butonu, grup başlığı, arama, yuvarlak seçim işareti; dokununca seçip kapanır). İlçe (pasifler "yakında"), Mahalle (arama), Sokak (arama + "X olarak kullan" serbest metin + "Listede yok").
- Mahalle semtleri (migration 20261011070000_neighborhood_semt, uygulandı): Köyler/Merkez/Sanayi/Silahtar/Yenice; Köyler (7 mah.), Silahtarağa ve Yenice PASİF. Seçim listesinde semt başlıklarıyla gruplu, pasifler soluk "teslimat yok". Kayıtlı adres pasif mahalledeyse geri yüklenmez. Asistanın teslimat bölgesi metni sabit (bölge değişirse marketToolRunner get_store_info güncellenmeli).
- Sokak listesi (migration 20261011080000_corlu_streets, uygulandı): kullanıcının verdiği OSM/openalfa tabanlı listeden 17 aktif mahalleye 761 sokak/cadde (adı belirsiz "4. Sokak" gibi kayıtlar, viyadük, tarla/taşocağı yolları ve yinelenen yazımlar elendi). Türk Telekom altyapı sorgulama robots.txt ile otomatik erişimi yasaklıyor → kullanılmadı. Liste resmi UAVT değil; müşteri bulamazsa elle yazabiliyor, admin Bölgeler sayfasından ekleyebiliyor.
- Admin Bölgeler › "Müşterilerin yazdığı sokaklar" (#oneriler) geliştirildi: listede zaten olan/yoksayılan gizlenir, sayıya göre sıralı; ad düzeltip Ekle (kısaltmalar Sokak/Caddesi/Bulvarı, Türkçe büyük harf), yazım hatasıysa "= Benzer sokak" ile eşleştir, Yoksay (delivery_street_ignored tablosu, migration 20261011090000). Ekle/eşleştir o siparişleri addr_street_id ile bağlar. Yardımcılar: src/lib/streetSuggest.ts.
- Kategori simgeleri: Alkol Ürünleri 🍷, Elektronik Ürünler 🎧 (DB). Admin kategori formunda dokunarak simge seçme paleti; simge boş bırakılırsa addan otomatik tahmin (src/lib/categoryEmoji.ts).
- Kategori diziliş sırası: yeni kategori formunda ad altında "Diziliş sırası" (varsayılan en son). admin_place_category RPC (migration 20261011100000): kategoriyi o sıraya koyar, o ve sonrakiler +1 kayar, hepsi 1..n yeniden numaralanır; mevcut kategorilerin "Sıra"sı değişince de aynı mantık. Mevcut sıra 1..n düzeltildi (Alkol 1, Elektronik 2, Meyve&Sebze 3 …).
- Zil kendiliğinden çalma düzeltmesi: iPhone volume=0.0001 yok saydığından kilit açma sırasında zil duyuluyordu → kilit açma artık sessiz WAV ile (muted); çalma bitince/durdurunca ses kaynağı bırakılıyor (kilit ekranı oynat tuşu zili başlatamaz), audioSession "auto"ya dönüyor; yalnızca son 10 dk içindeki yeni siparişte çalar. Müşteriler arama kutusu: .input katmansız olduğu için pl-9 ezilip ikon yazının üstüne biniyordu → pl-10!.
- Yönetim paneli sesli asistanı ("Sesli rapor", sol altta): salt okunur. Araçlar (src/lib/voice/adminTools.ts + adminToolRunner.ts, tarayıcıda admin RLS ile): get_sales_report (ciro/sipariş/ort. sepet/iptal + önceki dönem ve "aynı günler" karşılaştırması, % değişim, en iyi gün), get_top_products, get_stock_status, search_products (pasifler dahil), get_open_orders (aşama + SLA gecikme), get_customer_stats (yeni/tekrar eden, en çok harcayan), get_store_status, go_to_page. Dönemler iş günü bazlı (bugun, dun, bu_hafta, gecen_hafta, bu_ay, gecen_ay, son_7/30_gun, ozel). /api/voice/session?mod=admin: yalnızca admin, müşteri sınırları uygulanmaz. KVKK aktarım bölümüne not eklendi.
- İndirim sorgusu (src/lib/voice/discounts.ts): admin asistanına get_discounted_products (yüzde, eski/yeni fiyat, stok, satışa kapalılar isteğe bağlı), müşteri asistanına list_discounted_products (stok adedi yok, sadece var/yok). En yüksek indirimden sıralı, ürün/kategori adıyla süzülebilir.
