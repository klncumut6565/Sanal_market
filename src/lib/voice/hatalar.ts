// src/lib/voice/hatalar.ts
//
// Canlı Konuşma hatalarını (tarayıcı/DOM, WebSocket, ağ, sunucu) kullanıcıya
// TÜRKÇE ve anlaşılır biçimde gösterir. Bilinmeyen hatalarda ham metin
// parantez içinde sonda korunur ki teşhis edilebilsin.

const MIKROFON_IZNI =
  "Mikrofon izni verilmedi veya engellendi. Tarayıcı adres çubuğundaki kilit simgesinden mikrofona izin ver. " +
  "İzin açıksa Windows'ta Ayarlar → Gizlilik → Mikrofon bölümünde tarayıcının mikrofona erişebildiğini kontrol et.";

function ham(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e ?? "");
}

export function hataTurkce(e: unknown): string {
  const mesaj = ham(e);
  const ad = e instanceof Error || (typeof e === "object" && e && "name" in e) ? String((e as { name?: string }).name ?? "") : "";
  const kucuk = mesaj.toLowerCase();

  // --- Mikrofon / medya (DOMException) ---
  if (ad === "NotAllowedError" || ad === "PermissionDeniedError" || kucuk.includes("not allowed by the user agent") || kucuk.includes("permission denied")) {
    return MIKROFON_IZNI;
  }
  if (kucuk.includes("audiosession")) {
    return "Mikrofon başka bir ses tarafından kullanılıyor. Sayfayı yenileyip tekrar dene; telefon görüşmesi veya müzik açıksa kapat.";
  }
  if (ad === "NotFoundError" || ad === "DevicesNotFoundError" || kucuk.includes("requested device not found")) {
    return "Mikrofon bulunamadı. Bir mikrofonun takılı ve açık olduğundan emin ol.";
  }
  if (ad === "NotReadableError" || ad === "TrackStartError" || kucuk.includes("could not start audio source")) {
    return "Mikrofona erişilemiyor; başka bir uygulama (Teams, Zoom vb.) kullanıyor olabilir. Onu kapatıp tekrar dene.";
  }
  if (ad === "OverconstrainedError") {
    return "Mikrofon istenen ses ayarlarını desteklemiyor. Başka bir mikrofon seçip tekrar dene.";
  }
  if (ad === "SecurityError" || kucuk.includes("only secure origins") || kucuk.includes("secure context")) {
    return "Mikrofon yalnızca güvenli (https) bağlantıda kullanılabilir.";
  }
  if (ad === "AbortError") {
    return "Mikrofon başlatılamadı (işlem iptal edildi). Tekrar dene.";
  }
  if (kucuk.includes("getusermedia") && kucuk.includes("undefined")) {
    return "Bu tarayıcı mikrofon erişimini desteklemiyor. Chrome veya Edge kullan.";
  }
  if (kucuk.includes("audioworklet") || kucuk.includes("addmodule")) {
    return "Ses işleme modülü yüklenemedi. Sayfayı yenileyip tekrar dene.";
  }

  // --- WebSocket kapanma kodları: "Bağlantı kapandı (1008): ..." ---
  const kod = /\((\d{4})\)/.exec(mesaj)?.[1];
  if (kod) {
    if (kod === "1008") {
      return `Sesli asistana bağlanılamadı (1008). Tekrar dene. (${mesaj})`;
    }
    if (kod === "1007") return `Sesli asistan şu an kullanılamıyor (1007). Biraz sonra tekrar dene. (${mesaj})`;
    if (kod === "1011" || kod === "1013") return `Canlı ses sunucusu geçici olarak yanıt vermiyor (${kod}). Biraz sonra tekrar dene.`;
    if (kod === "1006") return "Canlı bağlantı beklenmedik şekilde koptu. İnternet bağlantını kontrol edip tekrar dene.";
    return `Canlı bağlantı kapandı (${kod}). Tekrar dene. (${mesaj})`;
  }

  // --- Ağ / sunucu ---
  if (kucuk.includes("did not match the expected pattern") || kucuk.includes("unexpected token") || kucuk.includes("is not valid json") || kucuk.includes("unexpected end of json")) {
    return "Sunucu beklenen yanıtı vermedi (muhtemelen zaman aşımı veya geçici sunucu hatası). Soruyu tekrar dene.";
  }
  if (kucuk.includes("failed to fetch") || kucuk.includes("networkerror") || kucuk.includes("load failed")) {
    return "Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.";
  }
  if (kucuk.includes("websocket") && kucuk.includes("error")) {
    return "Canlı ses bağlantısı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.";
  }
  if (kucuk.includes("unauthorized") || kucuk.includes("401")) {
    return "Sesli asistan oturumu açılamadı. Sayfayı yenileyip tekrar dene.";
  }
  if (kucuk.includes("quota") || kucuk.includes("429") || kucuk.includes("rate limit")) {
    return "Sesli asistan şu an yoğun. Biraz bekleyip tekrar dene.";
  }

  // Zaten Türkçe olan (Türkçe karakter içeren) mesajları olduğu gibi bırak.
  if (/[çğıöşüÇĞİÖŞÜ]/.test(mesaj)) return mesaj;

  return mesaj ? `Beklenmeyen bir hata oluştu. (${mesaj})` : "Beklenmeyen bir hata oluştu.";
}
