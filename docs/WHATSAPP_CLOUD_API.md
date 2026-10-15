# Anlık WhatsApp sipariş bildirimi — Meta WhatsApp Cloud API

CallMeBot ücretsizdir ama mesajları kuyruğa alır (5–10 dk gecikme olabilir).
Meta'nın resmi **WhatsApp Cloud API**'si mesajı 1–2 saniyede iletir.

- **Alıcı:** 0533 360 56 59 (WhatsApp Business uygulaması — telefonda kullanmaya devam edersin)
- **Gönderen:** Meta'nın verdiği ücretsiz **test numarası** (ya da sonradan eklenen ikinci bir işletme numarası)

## 6. Webhook (teslim takibi + yedek) — ÖNEMLİ
Meta düz mesajı önce "kabul eder", 24 saat penceresi kapalıysa sonradan **sessizce düşürür**.
Webhook bunu bize bildirir; sistem de mesajı CallMeBot ile yedek numaraya gönderir. Ayrıca kimin
bot numarasına ne zaman yazdığını kaydeder (pencere kapalıysa Meta hiç denenmez).

1. Vercel → Environment Variables → `WHATSAPP_VERIFY_TOKEN` = (Supabase notify_settings.webhook_secret ile aynı değer) → Redeploy
2. developers.facebook.com → uygulama → **WhatsApp → Configuration (Yapılandırma)** → Webhook → **Edit**
   - Callback URL: `https://sanalmarket.vercel.app/api/whatsapp/webhook`
   - Verify token: 1. adımdaki değer → **Verify and save**
3. Aynı sayfada **Webhook fields → messages → Subscribe**
4. (İsteğe bağlı) `WHATSAPP_APP_SECRET` = App settings → Basic → App secret (imza doğrulaması)

Webhook kurulmadan önce sistem güvenli tarafta kalır: Meta'ya gönderdiği her bildirimi CallMeBot ile yedek numaraya da gönderir.

## Ücretsiz kullanım (varsayılan)
Meta, alıcı son **24 saat** içinde bot numarasına mesaj yazdıysa ("müşteri hizmeti penceresi")
düz metin mesajları **ücretsiz** iletir. Ücret yalnızca pencere kapalıyken gönderilen *şablon* mesajlarındadır.

Sistem bu yüzden şöyle çalışır:
1. Önce **ücretsiz düz metin** dener → pencere açıksa bildirim anında, ücretsiz gelir.
2. Pencere kapalıysa **ücretli şablon GÖNDERMEZ**; CallMeBot ile (ücretsiz, gecikmeli) gönderir.
3. Pencereyi açık tutmak için: **0533 360 56 59'dan bot numarasına her gün bir kez** WhatsApp'tan
   herhangi bir mesaj yaz (ör. sabah dükkânı açarken "açtık"). Pencere 24 saat açık kalır.

İleride ücretli anlık şablona geçmek istersen: 2. adımdaki şablonu oluştur ve Vercel'e
`WHATSAPP_USE_TEMPLATE=1` ekle.

> Önemli: Gönderen numara ile alıcı numara aynı olamaz. 0533'ü gönderen yaparsan
> WhatsApp Business uygulaması o numarada çalışmayı bırakabilir; bu yüzden 0533 **alıcı** kalır.

## 1. Meta uygulaması oluştur (≈5 dk)
1. https://developers.facebook.com → **Uygulamalarım → Uygulama oluştur**.
2. Kullanım amacı: **"Connect with customers through WhatsApp"** (WhatsApp ile müşterilere bağlan). Bir işletme portföyü (Business portfolio) seç/oluştur.
3. Sol menü **WhatsApp → API Setup (API Kurulumu)**:
   - **From (Gönderen)**: hazır test numarası görünür.
   - **Phone number ID** değerini kopyala → `WHATSAPP_PHONE_NUMBER_ID`
   - **To (Alıcı)** → *Manage phone number list* → **+90 533 360 56 59** ekle. Bu numaraya WhatsApp'tan gelen doğrulama kodunu gir.

## 2. (İSTEĞE BAĞLI — ücretli mod) Mesaj şablonu oluştur
Ücretsiz modda bu adım GEREKMEZ. Yalnızca `WHATSAPP_USE_TEMPLATE=1` kullanacaksan yap.
İşletmenin başlattığı mesajlar için Meta onaylı şablon zorunludur.

**WhatsApp Manager → Message templates (Mesaj şablonları) → Create template**
- Kategori: **Utility (Hizmet)**
- Ad: **yeni_siparis**
- Dil: **Turkish (tr)**
- Gövde (Body) — aynen yapıştır:

```
🛒 Yeni sipariş #{{1}} — {{2}}
Müşteri: {{3}}
Adres: {{4}}
Ürünler: {{5}}
Siparişi aç: {{6}}
Sanal Market
```

- Örnek değerler (Meta ister): `10005`, `₺450,00`, `Ahmet Yılmaz (+905…)`, `Esentepe Mah. …`, `2 × Süt · 1 × Ekmek`, `https://sanalmarket.vercel.app/admin`
- Gönder → durum **Active / Onaylandı** olana kadar bekle.

## 3. Kalıcı erişim anahtarı (token)
API Setup sayfasındaki geçici token 24 saatte biter. Kalıcı token için:
1. https://business.facebook.com → **Ayarlar → Kullanıcılar → Sistem kullanıcıları → Ekle** (rol: Yönetici).
2. **Varlık ata**: oluşturduğun uygulama + WhatsApp hesabı (tam yetki).
3. **Token oluştur** → uygulamayı seç → süre: **Hiçbir zaman sona ermez** → izinler:
   `whatsapp_business_messaging`, `whatsapp_business_management` → kopyala → `WHATSAPP_TOKEN`

## 4. Vercel'e ekle
Vercel → proje → **Settings → Environment Variables** (Production):

| Ad | Değer |
|---|---|
| `WHATSAPP_TOKEN` | 3. adımdaki kalıcı token |
| `WHATSAPP_PHONE_NUMBER_ID` | 1. adımdaki Phone number ID |
| `WHATSAPP_TEMPLATE` | `yeni_siparis` (isteğe bağlı, varsayılan bu) |
| `WHATSAPP_TEMPLATE_LANG` | `tr` (isteğe bağlı) |

Sonra **Deployments → son dağıtım → Redeploy**.

## 5. Panelden dene
Yönetim → **Ayarlar → Sipariş bildirimleri**:
- "Bildirim WhatsApp numarası": **+90 533 360 56 59** → Kaydet
- Kutunun altında **"✅ Meta WhatsApp API aktif"** yazmalı
- 0533'ten bot (test) numarasına WhatsApp'tan "merhaba" yaz (ücretsiz pencereyi açar)
- **WhatsApp test** → mesaj birkaç saniyede gelir
- Yedek (pencere kapalıyken) için CallMeBot'u da 0533'e bağla: 0533'ten CallMeBot numarasına
  *I allow callmebot to send me messages* yaz, gelen apikey'i Ayarlar'a gir.

Meta ayarları varken CallMeBot yalnızca pencere kapalıyken yedek olarak kullanılır; Meta ayarları silinirse sistem tamamen CallMeBot'a döner.

## 6. Webhook (teslim takibi + yedek) — ÖNEMLİ
Meta düz mesajı önce "kabul eder", 24 saat penceresi kapalıysa sonradan **sessizce düşürür**.
Webhook bunu bize bildirir; sistem de mesajı CallMeBot ile yedek numaraya gönderir. Ayrıca kimin
bot numarasına ne zaman yazdığını kaydeder (pencere kapalıysa Meta hiç denenmez).

1. Vercel → Environment Variables → `WHATSAPP_VERIFY_TOKEN` = (Supabase notify_settings.webhook_secret ile aynı değer) → Redeploy
2. developers.facebook.com → uygulama → **WhatsApp → Configuration (Yapılandırma)** → Webhook → **Edit**
   - Callback URL: `https://sanalmarket.vercel.app/api/whatsapp/webhook`
   - Verify token: 1. adımdaki değer → **Verify and save**
3. Aynı sayfada **Webhook fields → messages → Subscribe**
4. (İsteğe bağlı) `WHATSAPP_APP_SECRET` = App settings → Basic → App secret (imza doğrulaması)

Webhook kurulmadan önce sistem güvenli tarafta kalır: Meta'ya gönderdiği her bildirimi CallMeBot ile yedek numaraya da gönderir.

## Ücret
- Pencere açıkken düz metin: **ücretsiz**.
- Şablon mesajları ücretlidir (yalnızca `WHATSAPP_USE_TEMPLATE=1` ile kullanılır).
- Kaynak: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing

## Sorun giderme (Ayarlar → "Son otomatik bildirim" satırı)
- `24 saatlik ücretsiz pencere kapalı` → 0533'ten bot numarasına bir mesaj yaz.
- `Template name does not exist in the translation` → şablon adı/dili yanlış ya da henüz onaylanmadı.
- `Recipient phone number not in allowed list` → 0533 numarası 1. adımda "To" listesine eklenip doğrulanmamış.
- `Authentication Error` / `expired` → token süresi dolmuş; 3. adımdaki kalıcı token'ı kullan.

## Panelden kurulum (2026-10-15)
Yönetim → Ayarlar → **WhatsApp sipariş botu** → **Bağlantı kurulumu**:
1. **Durumu kontrol et**: anahtarlar, bot numarası, abonelik, gelen bildirim durumu.
2. **1) Aboneliği yap**: `POST /{WABA_ID}/subscribed_apps` (sunucu WHATSAPP_TOKEN ile yapar). WABA kimliği: `WHATSAPP_WABA_ID` (yoksa 1750497189284542).
3. **2) Webhook adresini kaydet**: `POST /{APP_ID}/subscriptions` (object=whatsapp_business_account, fields=messages). Vercel'de `WHATSAPP_APP_ID` + `WHATSAPP_APP_SECRET` gerekir; yoksa paneldeki "elle kurulum" adımları (Callback URL + Verify token kopyalanır).
4. Başka bir telefondan bot numarasına yaz → cevap gelmeli; "Meta'dan en az bir bildirim geldi" ✅ olur.
