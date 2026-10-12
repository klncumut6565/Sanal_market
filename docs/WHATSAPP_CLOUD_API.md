# Anlık WhatsApp sipariş bildirimi — Meta WhatsApp Cloud API

CallMeBot ücretsizdir ama mesajları kuyruğa alır (5–10 dk gecikme olabilir).
Meta'nın resmi **WhatsApp Cloud API**'si mesajı 1–2 saniyede iletir.

- **Alıcı:** 0533 360 56 59 (WhatsApp Business uygulaması — telefonda kullanmaya devam edersin)
- **Gönderen:** Meta'nın verdiği ücretsiz **test numarası** (ya da sonradan eklenen ikinci bir işletme numarası)

> Önemli: Gönderen numara ile alıcı numara aynı olamaz. 0533'ü gönderen yaparsan
> WhatsApp Business uygulaması o numarada çalışmayı bırakabilir; bu yüzden 0533 **alıcı** kalır.

## 1. Meta uygulaması oluştur (≈5 dk)
1. https://developers.facebook.com → **Uygulamalarım → Uygulama oluştur**.
2. Kullanım amacı: **"Connect with customers through WhatsApp"** (WhatsApp ile müşterilere bağlan). Bir işletme portföyü (Business portfolio) seç/oluştur.
3. Sol menü **WhatsApp → API Setup (API Kurulumu)**:
   - **From (Gönderen)**: hazır test numarası görünür.
   - **Phone number ID** değerini kopyala → `WHATSAPP_PHONE_NUMBER_ID`
   - **To (Alıcı)** → *Manage phone number list* → **+90 533 360 56 59** ekle. Bu numaraya WhatsApp'tan gelen doğrulama kodunu gir.

## 2. Mesaj şablonu oluştur (onay genelde dakikalar sürer)
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
- **WhatsApp test** → mesaj birkaç saniyede gelir

Bu ayarlar varken CallMeBot kullanılmaz; ayarlar silinirse sistem otomatik CallMeBot'a döner.

## Ücret
Meta, şablon mesajlarını mesaj başına ücretlendirir ("Utility" kategorisi en düşük grup).
Güncel Türkiye fiyatı: https://developers.facebook.com/docs/whatsapp/pricing
Ödeme yöntemi eklenmeden de test numarasıyla doğrulanmış alıcılara gönderim yapılabilir.

## Sorun giderme (Ayarlar → "Son otomatik bildirim" satırı)
- `Template name does not exist in the translation` → şablon adı/dili yanlış ya da henüz onaylanmadı.
- `Recipient phone number not in allowed list` → 0533 numarası 1. adımda "To" listesine eklenip doğrulanmamış.
- `Authentication Error` / `expired` → token süresi dolmuş; 3. adımdaki kalıcı token'ı kullan.
