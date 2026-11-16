# Graph Report - sanal_market  (2026-11-16)

## Corpus Check
- 290 files · ~168,060 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .example 1, (none) 1, .ico 1)

## Summary
- 1446 nodes · 4352 edges · 67 communities (59 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 95 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4236e4e9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- adminToolRunner.ts
- notify.ts
- react
- next
- Oturum özeti — 2026-10-10
- format.ts
- PhotoMatcher.tsx
- marketToolRunner.ts
- admin/layout.tsx
- PosScreen.tsx
- useMarketVoice
- createClient
- admin/actions.ts
- CourierApp.tsx
- siparisler/[id]/page.tsx
- lucide-react
- displayPhone
- FavoritesClient.tsx
- CheckoutForm.tsx
- VoiceAssistant.tsx
- package.json
- (browse)/layout.tsx
- getStoreSettings
- requireAdmin
- formatTL
- CartContents.tsx
- useAdminVoice.ts
- kategori/[slug]/page.tsx
- (browse)/page.tsx
- QuickBarcode.tsx
- waLink
- seo.ts
- useMarketVoice.ts
- giris/actions.ts
- VoiceOrb.tsx
- compilerOptions
- dependencies
- kurye/actions.ts
- catalog.ts
- client.ts
- waSetup.ts
- OrderCard.tsx
- CourierBoard.tsx
- urun/[slug]/page.tsx
- Sheets.tsx
- RealtimeProvider
- Anlık WhatsApp sipariş bildirimi — Meta WhatsApp Cloud API
- BarcodeScanner.tsx
- LegalDoc.tsx
- audioStream.ts
- Kurulum
- CourierMap.tsx
- ProductImage
- sifre-yenile/page.tsx
- CategoryIcon.tsx
- kategori_dagit.py
- Supabase e-posta ayarları (Sanal Market)
- eslint.config.mjs
- scripts
- saveProduct
- STTProvider
- vercel.json
- Supabase: yeni tablo kuralı (30 Ekim 2026'dan itibaren)
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `requireAdmin` - 108 edges
2. `next` - 96 edges
3. `react` - 91 edges
4. `lucide-react` - 77 edges
5. `formatTL()` - 75 edges
6. `createClient()` - 47 edges
7. `Oturum özeti — 2026-10-10` - 46 edges
8. `createClient()` - 36 edges
9. `CourierApp()` - 35 edges
10. `useMarketVoice()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `2026-10-18 — Kurye paneli veri tasarrufu + toplu satışa aç / pasif yap` --references--> `setProductsActive()`  [INFERRED]
  docs/OTURUM_OZETI.md → src/app/admin/actions.ts
- `2026-10-23 — Yeni tasarım, 1. aşama (yeşil/turkuaz marka + robot asistan)` --references--> `robotStateOf()`  [INFERRED]
  docs/OTURUM_OZETI.md → src/components/shop/Robot.tsx
- `2026-10-23 — Yeni tasarım, 2. aşama (örnek görsele göre ana sayfa)` --references--> `topCounts()`  [INFERRED]
  docs/OTURUM_OZETI.md → src/lib/categoryTree.ts
- `2026-10-19 — Vercel ISR yazımı %100 (ücretsiz plan, Pro'ya geçilmeyecek) → hedefli önbellek yenileme` --references--> `getCategories()`  [INFERRED]
  docs/OTURUM_OZETI.md → src/lib/data/catalog.ts
- `2026-10-21 — Sesli asistan: veda ve sonrası kısık ses (iPhone)` --references--> `resetAudioSession()`  [INFERRED]
  docs/OTURUM_OZETI.md → src/lib/voice/audioStream.ts

## Import Cycles
- None detected.

## Communities (67 total, 8 thin omitted)

### Community 0 - "adminToolRunner.ts"
Cohesion: 0.06
Nodes (72): range(), addTop(), bump(), Day, fmtDay(), Kanal, metadata, one() (+64 more)

### Community 1 - "notify.ts"
Cohesion: 0.05
Nodes (74): server-only, testNotify(), GET(), Change, GET(), maxDuration, POST(), secret() (+66 more)

### Community 2 - "react"
Cohesion: 0.06
Nodes (60): 2026-10-19 (öğlen) — ISR yazımı: Vercel rota dökümüne göre ikinci tur, 2026-10-19 — Ürün görselleri: sunucuda WebP + depo filtresi + toplu sıkıştırma, 2026-10-21 — ChatGPT site incelemesindeki geçerli bulgular düzeltildi, react, deleteCategory(), deleteProduct(), deleteProductById(), deleteProductsByIds() (+52 more)

### Community 3 - "next"
Cohesion: 0.09
Nodes (31): nextConfig, next, json(), POST(), sha256(), GET(), signOut(), ApplyForm() (+23 more)

### Community 4 - "Oturum özeti — 2026-10-10"
Cohesion: 0.05
Nodes (39): 2026-10-10 (akşam) — Logo ve marka, 2026-10-10 — Barkod, ayarlar, 2026-10-10 — Sipariş zili + WhatsApp, 2026-10-10 — Vercel yayını, 2026-10-11 — Admin yavaşlığı, 2026-10-11 — Ciro raporu, 2026-10-11 — KVKK, 2026-10-11 — Rafta olmayan ürün akışı (+31 more)

### Community 5 - "format.ts"
Cohesion: 0.09
Nodes (30): saveAdminPush(), testPush(), AdminHome(), metadata, COLUMN_STYLE, COLUMNS, metadata, OrdersPage() (+22 more)

### Community 6 - "PhotoMatcher.tsx"
Cohesion: 0.11
Nodes (32): attachProductImage(), catalog(), identifyPhoto(), IdentifyResult, Row, searchForPhoto(), metadata, PhotoMatchPage() (+24 more)

### Community 7 - "marketToolRunner.ts"
Cohesion: 0.11
Nodes (33): BudgetOption, BudgetPick, BudgetSlot, pickBudgetBasket(), halusinasyonMu(), KALIPLAR, kisaYankiMi(), trNormalize() (+25 more)

### Community 8 - "admin/layout.tsx"
Cohesion: 0.09
Nodes (28): flushCatalogAction(), AdminLayout(), Gate(), instant, metadata, AdminNav(), groups, Item (+20 more)

### Community 9 - "PosScreen.tsx"
Cohesion: 0.14
Nodes (30): dayStr(), PosHistory(), Stat(), PosReceipt(), ReceiptData, Row(), beep(), BILLS (+22 more)

### Community 10 - "useMarketVoice"
Cohesion: 0.14
Nodes (5): AudioPlaybackQueue, resetAudioSession(), GeminiLiveProvider, useAdminVoice(), useMarketVoice()

### Community 11 - "createClient"
Cohesion: 0.12
Nodes (26): metadata, QuickAddPage(), metadata, NewProductPage(), C, CategoryOptionList(), Dup, DuplicateHint() (+18 more)

### Community 12 - "admin/actions.ts"
Cohesion: 0.12
Nodes (26): addStreets(), addSuggestedStreet(), deleteStreet(), ignoreSuggestedStreet(), ITEM_ERR, likeEsc(), linkTypedOrders(), mapSuggestedStreet() (+18 more)

### Community 13 - "CourierApp.tsx"
Cohesion: 0.13
Nodes (27): setDuty(), alertNewTask(), CourierApp(), toggleDuty(), Info(), LocationBar(), Money(), Period (+19 more)

### Community 14 - "siparisler/[id]/page.tsx"
Cohesion: 0.17
Nodes (23): orderItemOut(), AdminOrderPage(), metadata, Alt, OrderItems(), Props, unit(), NextStepForm() (+15 more)

### Community 15 - "lucide-react"
Cohesion: 0.12
Nodes (22): lucide-react, ActionState, numOrNull(), saveNotifySettings(), saveSettings(), sendDailyReportNow(), setDailyReportEnabled(), setStoreMode() (+14 more)

### Community 16 - "displayPhone"
Cohesion: 0.15
Nodes (21): addToBlacklist(), removeFromBlacklist(), toggleVerified(), CustomersPage(), metadata, TickButton(), CustomerPage(), metadata (+13 more)

### Community 17 - "FavoritesClient.tsx"
Cohesion: 0.14
Nodes (19): FavoritesClient(), FavoritesPage(), metadata, BOTTOM_NAV_HIDDEN, BottomNav(), FavoriteButton(), Sb, shopCategories() (+11 more)

### Community 18 - "CheckoutForm.tsx"
Cohesion: 0.16
Nodes (21): placeOrder(), Card(), CheckoutForm(), Field(), loadSaved(), PayOption(), CheckoutPage(), metadata (+13 more)

### Community 19 - "VoiceAssistant.tsx"
Cohesion: 0.13
Nodes (19): ADMIN_VOICE_OPEN_EVENT, AdminVoiceAssistant(), AdminVoiceCard(), CH_STATUS, ChangeCard(), EXAMPLES, OpenAdminVoiceButton(), STATUS (+11 more)

### Community 20 - "package.json"
Cohesion: 0.12
Nodes (22): devDependencies, supabase@^2.120.0, tailwindcss@^4, @tailwindcss/turbopack@^4, @types/leaflet@^1.9.22, @types/node@^20, @types/react@^19, @types/react-dom@^19 (+14 more)

### Community 21 - "(browse)/layout.tsx"
Cohesion: 0.22
Nodes (20): BrowseLayout(), Counts, MemberNav(), AllCategoryTiles(), HomeStrip(), CategoryIcon(), CategoryChips(), CategorySidebar() (+12 more)

### Community 22 - "getStoreSettings"
Cohesion: 0.18
Nodes (16): KvkkPage(), metadata, Section(), Footer(), ShopLayout(), Voice(), WhatsApp(), CartPage() (+8 more)

### Community 23 - "requireAdmin"
Cohesion: 0.23
Nodes (19): ownerGrantByEmail(), ownerSetAdmin(), roleMsg(), assignCourier(), back(), clearIssue(), decideCourier(), em() (+11 more)

### Community 24 - "formatTL"
Cohesion: 0.19
Nodes (18): avgMin(), CouriersPage(), metadata, O, part(), PERIODS, Row, Stat() (+10 more)

### Community 25 - "CartContents.tsx"
Cohesion: 0.25
Nodes (17): CartPageClient(), CartButton(), CartLines(), CartPanel(), EmptyCart(), FreeDeliveryBar(), MobileCartBar(), Props (+9 more)

### Community 26 - "useAdminVoice.ts"
Cohesion: 0.13
Nodes (16): ADMIN_TOOLS, ADMIN_VOICE_INSTRUCTION, PERIOD, ToolCallHandler, LiveMetrics, RealtimeSessionResponse, TranscriptEvent, TranscriptSpeaker (+8 more)

### Community 27 - "kategori/[slug]/page.tsx"
Cohesion: 0.18
Nodes (18): 2026-10-18 — Vitrin: alt kategori satırları (en çok tercih edilen önce), metadata, Props, Results(), SearchPage(), CategoryContent(), CategoryPage(), generateMetadata() (+10 more)

### Community 28 - "(browse)/page.tsx"
Cohesion: 0.21
Nodes (17): 2026-10-23 — Ana sayfa ürün sırası: görselli + en çok tercih edilen önce, CategorySection(), CategoryTiles(), HomePage(), MemberSections(), metadata, Prods, Section() (+9 more)

### Community 29 - "QuickBarcode.tsx"
Cohesion: 0.16
Nodes (16): 2026-10-18 — Barkod eşleşmesi (baştaki 0 farkı), BarcodeProduct, findByBarcode(), quickPriceUpdate(), BarcodePage(), metadata, AdminScanListener(), Form (+8 more)

### Community 30 - "waLink"
Cohesion: 0.21
Nodes (16): saveCourierSettings(), setOrderStatus(), testCourier(), CourierLink(), CourierSettingsForm(), BOT_NUMBER_DISPLAY, BOT_WA_LINK, COURIER_REMINDER (+8 more)

### Community 31 - "seo.ts"
Cohesion: 0.16
Nodes (12): GET(), metadata, viewport, AI_CRAWLERS, sitemap(), abs(), CITY, isPublicCategory() (+4 more)

### Community 32 - "useMarketVoice.ts"
Cohesion: 0.13
Nodes (16): ham(), hataTurkce(), CartProposal, MARKET_TOOLS, MARKET_VOICE_INSTRUCTION, ASIST_VEDA, GIZLE, icerir() (+8 more)

### Community 33 - "giris/actions.ts"
Cohesion: 0.24
Nodes (14): AuthState, requestPasswordReset(), safeNext(), signIn(), signUp(), siteOrigin(), updatePassword(), AuthForm() (+6 more)

### Community 34 - "VoiceOrb.tsx"
Cohesion: 0.16
Nodes (15): ETIKET, Halka, Kivilcim, OrbTema, PALET_MARKET, PALET_YONETIM, PALETLER, Parcacik (+7 more)

### Community 35 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 36 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @fontsource-variable/nunito-sans@^5.3.0, leaflet@^1.9.4, lucide-react@^1.54.0, next@16.4.3, react@19.3.0, react-dom@19.3.0, server-only@^0.0.1 (+10 more)

### Community 37 - "kurye/actions.ts"
Cohesion: 0.24
Nodes (16): applyCourier(), ApplyState, claimOrder(), CourierResult, deliverOrder(), ERR, isId(), msg() (+8 more)

### Community 38 - "catalog.ts"
Cohesion: 0.25
Nodes (16): 2026-10-24 — Site geç açılıyor: teşhis + düzeltme, generateStaticParams(), DEFAULT_SETTINGS, getCategoryCounts(), getCategoryProducts(), getProductBySlug(), getProductPage(), getProducts() (+8 more)

### Community 39 - "client.ts"
Cohesion: 0.23
Nodes (8): @supabase/ssr, @supabase/supabase-js, hasSupabase, SUPABASE_KEY, SUPABASE_URL, updateSession(), config, proxy()

### Community 40 - "waSetup.ts"
Cohesion: 0.24
Nodes (14): waSetupAction(), CopyField(), Ok(), WaSetupPanel(), graph(), phoneId(), SITE, token() (+6 more)

### Community 41 - "OrderCard.tsx"
Cohesion: 0.23
Nodes (11): OrderCard(), Props, since(), ISSUE_REASONS, vehicleLabel(), AddrParts, clean(), mapQuery() (+3 more)

### Community 42 - "CourierBoard.tsx"
Cohesion: 0.22
Nodes (12): CourierBoard(), maps(), O, pay(), tl(), b64ToU8(), noop(), PushSetup() (+4 more)

### Community 43 - "urun/[slug]/page.tsx"
Cohesion: 0.30
Nodes (11): generateMetadata(), ProductContent(), ProductPage(), Props, AddToCart(), Price(), ProductCard(), discountRate() (+3 more)

### Community 44 - "Sheets.tsx"
Cohesion: 0.20
Nodes (10): DeliverSheet(), confirm(), onCash(), IssueSheet(), Mode, parse(), Receipt, ReceiptOut (+2 more)

### Community 46 - "Anlık WhatsApp sipariş bildirimi — Meta WhatsApp Cloud API"
Cohesion: 0.15
Nodes (12): 1. Meta uygulaması oluştur (≈5 dk), 2. (İSTEĞE BAĞLI — ücretli mod) Mesaj şablonu oluştur, 3. Kalıcı erişim anahtarı (token), 4. Vercel'e ekle, 5. Panelden dene, 6. Webhook (teslim takibi + yedek) — ÖNEMLİ, 6. Webhook (teslim takibi + yedek) — ÖNEMLİ, Anlık WhatsApp sipariş bildirimi — Meta WhatsApp Cloud API (+4 more)

### Community 47 - "BarcodeScanner.tsx"
Cohesion: 0.24
Nodes (9): @zxing/browser@^0.2.1, @zxing/library@^0.23.0, @zxing/browser, @zxing/library, BarcodeScanner(), beep(), Props, beep() (+1 more)

### Community 48 - "LegalDoc.tsx"
Cohesion: 0.44
Nodes (10): DistanceSalesPage(), metadata, metadata, PreInfoPage(), Complaints(), DeliveryTerms(), LEGAL_UPDATED, LegalSection() (+2 more)

### Community 49 - "audioStream.ts"
Cohesion: 0.24
Nodes (9): 2026-10-20 — Sesli asistan: yanlış söze girme (kesinti) önlemleri, BARGE_IN_MS, createNoiseGate(), GateStats, MicCapture, PcmResampler, prepareAudioSessionForCapture(), startMicCapture() (+1 more)

### Community 50 - "Kurulum"
Cohesion: 0.17
Nodes (11): 1. Supabase, 2. Yönetici hesabı, 3. Ortam değişkenleri, 4. Çalıştırma, 5. Vercel, Güvenlik kuralları (veritabanında uygulanır), Klasör yapısı, Kurulum (+3 more)

### Community 51 - "CourierMap.tsx"
Cohesion: 0.31
Nodes (7): leaflet, ago(), C, CORLU, CourierMap(), esc(), Live

### Community 52 - "ProductImage"
Cohesion: 0.42
Nodes (6): bigSrc(), ProductGallery(), T, Viewer(), ProductImage(), VoiceProducts()

### Community 53 - "sifre-yenile/page.tsx"
Cohesion: 0.43
Nodes (6): Body(), metadata, ResetPasswordPage(), noop(), parseHash(), RecoveryLink()

### Community 54 - "CategoryIcon.tsx"
Cohesion: 0.39
Nodes (6): Cat, CategoryArt(), CategoryCardBody(), art3d(), AVAILABLE, codeOf()

### Community 56 - "Supabase e-posta ayarları (Sanal Market)"
Cohesion: 0.33
Nodes (5): 1. URL ayarları — Authentication → URL Configuration, 2. Şifre yenileme şablonu — Authentication → Emails → Reset Password, 3. Üyelik doğrulama şablonu — Authentication → Emails → Confirm signup (isteğe bağlı), 4. Gerçek e-posta gönderimi (SMTP) — Resend (ücretsiz 3.000/ay), Supabase e-posta ayarları (Sanal Market)

### Community 57 - "eslint.config.mjs"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^9, eslint-config-next@16.4.3, eslint, eslint-config-next

### Community 58 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

### Community 59 - "saveProduct"
Cohesion: 0.50
Nodes (5): cleanBarcode(), parseExtraImages(), quickAddProducts(), saveProduct(), slugify()

### Community 61 - "vercel.json"
Cohesion: 0.50
Nodes (3): crons, regions, $schema

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `adminToolRunner.ts`, `notify.ts`, `react`, `format.ts`, `PhotoMatcher.tsx`, `admin/layout.tsx`, `createClient`, `admin/actions.ts`, `CourierApp.tsx`, `siparisler/[id]/page.tsx`, `lucide-react`, `displayPhone`, `FavoritesClient.tsx`, `CheckoutForm.tsx`, `VoiceAssistant.tsx`, `package.json`, `(browse)/layout.tsx`, `getStoreSettings`, `requireAdmin`, `formatTL`, `CartContents.tsx`, `useAdminVoice.ts`, `kategori/[slug]/page.tsx`, `(browse)/page.tsx`, `QuickBarcode.tsx`, `seo.ts`, `useMarketVoice.ts`, `giris/actions.ts`, `dependencies`, `kurye/actions.ts`, `catalog.ts`, `client.ts`, `urun/[slug]/page.tsx`, `LegalDoc.tsx`, `ProductImage`, `sifre-yenile/page.tsx`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **Should `adminToolRunner.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05671466353217749 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `adminToolRunner.ts`, `next`, `format.ts`, `PhotoMatcher.tsx`, `admin/layout.tsx`, `PosScreen.tsx`, `createClient`, `admin/actions.ts`, `CourierApp.tsx`, `siparisler/[id]/page.tsx`, `lucide-react`, `displayPhone`, `FavoritesClient.tsx`, `CheckoutForm.tsx`, `VoiceAssistant.tsx`, `package.json`, `(browse)/layout.tsx`, `getStoreSettings`, `formatTL`, `CartContents.tsx`, `useAdminVoice.ts`, `kategori/[slug]/page.tsx`, `(browse)/page.tsx`, `QuickBarcode.tsx`, `waLink`, `useMarketVoice.ts`, `giris/actions.ts`, `VoiceOrb.tsx`, `dependencies`, `kurye/actions.ts`, `catalog.ts`, `waSetup.ts`, `OrderCard.tsx`, `CourierBoard.tsx`, `urun/[slug]/page.tsx`, `Sheets.tsx`, `BarcodeScanner.tsx`, `CourierMap.tsx`, `ProductImage`, `sifre-yenile/page.tsx`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Should `notify.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.050888286660644384 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `react`, `next`, `format.ts`, `PhotoMatcher.tsx`, `admin/layout.tsx`, `PosScreen.tsx`, `createClient`, `admin/actions.ts`, `CourierApp.tsx`, `siparisler/[id]/page.tsx`, `displayPhone`, `FavoritesClient.tsx`, `CheckoutForm.tsx`, `VoiceAssistant.tsx`, `package.json`, `(browse)/layout.tsx`, `getStoreSettings`, `requireAdmin`, `formatTL`, `CartContents.tsx`, `(browse)/page.tsx`, `QuickBarcode.tsx`, `waLink`, `giris/actions.ts`, `VoiceOrb.tsx`, `dependencies`, `waSetup.ts`, `OrderCard.tsx`, `CourierBoard.tsx`, `urun/[slug]/page.tsx`, `Sheets.tsx`, `BarcodeScanner.tsx`, `ProductImage`, `sifre-yenile/page.tsx`, `CategoryIcon.tsx`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.05527805527805528 - nodes in this community are weakly interconnected._
- **Should `next` be split into smaller, more focused modules?**
  _Cohesion score 0.09158186864014801 - nodes in this community are weakly interconnected._