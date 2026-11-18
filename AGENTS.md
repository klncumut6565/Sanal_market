<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Proje kuralları — Sanal_market (Çorlu Sanal Market)

Claude Code, Codex ve diğer kod ajanları için. ECC (affaan-m/ECC, MIT) çalışma disiplininden uyarlandı. Yukarıdaki Next.js bloğu otomatik üretilir; DOKUNMA.
**EN ÖNEMLİ KURAL: ÇALIŞAN SİSTEMİ BOZMA.**

## Proje özeti
- Tek mağazalı online market (Yemeksepeti Market düzeni). Next.js 16 + React 19 + Tailwind 4 + Supabase + Vercel (ÜCRETSİZ plan, `fra1`).
- Canlı: https://sanalmarket.vercel.app. Route grupları: `(shop)` müşteri, `admin` yönetim, `kurye`.
- Önceki oturumlar: `docs/OTURUM_OZETI.md`. Kod haritası: `graphify-out/GRAPH_REPORT.md` (önce buna bak).

## Çalışma akışı (her değişiklikte)
1. **Araştır:** graphify → ilgili dosyalar → `docs/OTURUM_OZETI.md` ilgili bölüm. `node_modules/next/dist/docs/` (Next 16 farklı).
2. **Kanıtla:** Yavaşlık/hata için Supabase logları, `/api/durum`, build çıktısı. Varsayımla düzeltme yapma.
3. **Planla:** Değişecek ve DEĞİŞMEYECEK dosyalar; önbellek, sorgu ve maliyet etkisi.
4. **Onay:** Migration, RLS/grant, sipariş/ödeme akışı, cron, önbellek stratejisi ve WhatsApp/push değişikliklerinde push'tan ÖNCE kullanıcı onayı.
5. **İzole uygula:** En küçük diff. İlgisiz refactor yok.
6. **Doğrula:** `npm run lint` ve `npm run build`. Kırmızıysa DUR.
7. **Bağımsız incele:** Diff'i "başkası yazdı" gözüyle oku. Değişiklik tüm yollara uygulandı mı: misafir ve üye, mobil ve masaüstü, müşteri asistanı ve yönetim asistanı, online sipariş ve POS? SELECT kolonu, tip ve kullanım yeri uyumlu mu?
8. **Regresyon listesi:** aşağıdaki ilgili maddeler.
9. **Raporla:** lint/build sonucu + "canlı sitede doğrulandı / doğrulanmadı" ayrı yazılır.

## DOKUNULMAZLAR
- Veritabanı fonksiyonlarının iş kuralları: `place_order` (stok, min. tutar, saat, adres), `admin_set_order_status`, `admin_order_item_out`, iptal stok iadesi.
- Çalışma saati 10:00–01:00 (iş günü penceresi `lib/hours.ts`, İstanbul saati) ve SAAT_DISI reddi.
- Teslimat: yalnız Tekirdağ/Çorlu aktif.
- Bilerek anon'a kapalı tablolar (`customer_prefs`, `product_costs`, `order_item_costs`, `wa_bot_chats`, `wa_bot_seen`). Toplu "tüm tablolara grant" YAZMA.
- Sesli asistanlar: müşteri (yeşil/turuncu) ve yönetim (PEMBE-MOR küre, `VoiceOrb tema="yonetim"`); yalnızca Türkçe; `hide_window` gizler, kapatmaz.
- Güvenlik başlıkları (`next.config.ts`), cron `CRON_SECRET`, WhatsApp webhook imza doğrulaması.
- Gizli anahtarlar yalnız Vercel ortam değişkenlerinde; `NEXT_PUBLIC_` olarak service role ASLA.

## Supabase kuralları
- Migration: `supabase/migrations/YYYYMMDDHHMMSS_aciklama.sql`.
- Her YENİ tabloda aynı migration'da: RLS açık + yalnız gereken rollere grant + policy (`docs/SUPABASE_YENI_TABLO_KURALI.md`).
- Yeni SECURITY DEFINER fonksiyon: `search_path` sabit; anon'a açılacaksa nedenini yaz, içinde yetki denetimi olsun.
- Sorgularda `select('*')` yerine gereken kolonlar (`LIST_COLS` deseni); döngüde sorgu yok.
- Denetim için `supabase-guvenlik-maliyet-denetimi` skill'i.

## Performans ve maliyet (Vercel ücretsiz plan)
- `"use cache"` sunucu örneği belleğinde tutulur: istek-anı çizilen sayfada (searchParams, derlemede olmayan ürün sayfası) tüm katalogu çeken çağrı EKLEME. Düzen (layout) içinde ağır sorgu yok (`getCategoryCounts` deseni).
- Yeni revalidate / revalidateTag / cron eklerken çalışma sıklığını ve yazma maliyetini hesapla.
- Görseller WebP, ≤1 MB, `next/image`. Görsel optimizasyon kotasını şişirecek değişiklik yapma.
- Sesli asistan ve arama: `search_products` yavaş (~2,7 sn); her tuşta sorgu atma.

## Regresyon kontrol listesi
- [ ] Sepet → ödeme → sipariş takip akışı çalışıyor (misafir: `id + access_token`).
- [ ] Mağaza kapalıyken sepet/ödeme kilitli, geri sayım doğru.
- [ ] Yönetim: sipariş panosu, yeni sipariş zili, "Yok/Değiştir" akışı, ciro raporu (iş gününe göre).
- [ ] Barkod okuma (kamera + el okuyucu), POS ve kurye ekranları.
- [ ] SEO: `sitemap.ts`, `robots.ts`, meta, yapılandırılmış veri ("Çorlu Sanal Market"), doğrulama etiketleri bozulmadı.
- [ ] Mobilde (iPhone Safari) düzen ve sesli asistan küresi.
- [ ] Yeni tabloda grant unutulmadı (`permission denied for table` yok).

## Push ve rapor
- Push sonrası yalnız commit hash ve kısa özet. İndirme/ZIP linki paylaşılmaz.
- Büyük iş bitince veya bağlam dolmadan `docs/OTURUM_OZETI.md` sonuna tarihli bölüm eklenir: tamamlananlar, kararlar, açık işler, canlıda doğrulanacaklar.
- Aynı hata iki kez tekrarlandıysa kalıcı kuralı bu dosyaya ekle.
