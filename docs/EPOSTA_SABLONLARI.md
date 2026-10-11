# Supabase e-posta ayarları (Sanal Market)

## 1. URL ayarları — Authentication → URL Configuration
- **Site URL:** `https://sanalmarket.vercel.app`
- **Redirect URLs:** `https://sanalmarket.vercel.app/**`

## 2. Şifre yenileme şablonu — Authentication → Emails → Reset Password

**Subject:**
```
Sanal Market şifre yenileme
```

**Body (Source):**
```html
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
  <h2 style="color:#e8732a">Sanal Market</h2>
  <p>Merhaba,</p>
  <p>Hesabın için şifre yenileme isteği aldık. Yeni şifreni belirlemek için aşağıdaki butona dokun:</p>
  <p style="text-align:center;margin:28px 0">
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/sifre-yenile"
       style="background:#e8732a;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:bold">
      Şifremi yenile
    </a>
  </p>
  <p style="font-size:13px;color:#666">Bağlantı 1 saat geçerlidir ve bir kez kullanılabilir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.</p>
  <p style="font-size:13px;color:#666">Sanal Market · İhtiyacın Kapında!</p>
</div>
```
(token_hash biçimi, bağlantı hangi tarayıcıda açılırsa açılsın çalışır.)

## 3. Üyelik doğrulama şablonu — Authentication → Emails → Confirm signup (isteğe bağlı)
**Subject:** `Sanal Market üyeliğini doğrula`
Bağlantı: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

## 4. Gerçek e-posta gönderimi (SMTP) — Resend (ücretsiz 3.000/ay)
1. resend.com → üye ol → **API Keys → Create** (anahtarı kopyala).
2. Kendi alan adın varsa **Domains → Add** ile doğrula (yoksa test için `onboarding@resend.dev` yalnızca kendi adresine gönderir).
3. Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   - Host `smtp.resend.com`, Port `465`, Username `resend`, Password = API anahtarı
   - Sender email `bildirim@alanadin.com`, Sender name `Sanal Market`
4. Supabase'in yerleşik servisi saatte yalnızca birkaç e-posta gönderir; SMTP bağlanınca bu sınır kalkar.
