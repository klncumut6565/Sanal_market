// src/lib/voice/halusinasyon.ts — TMGD Asistan (src/lib/ai/halusinasyon.ts) modülünden alındı.
//
// WHISPER HALÜSİNASYON FİLTRESİ (ortak modül)
//
// Whisper modelleri sessizlik veya anlaşılmayan ses aldığında, eğitim
// verisindeki YouTube altyazılarından öğrendikleri kalıpları UYDURUR:
// "İzlediğiniz için teşekkür ederim", "Altyazı M.K.", "Abone olmayı
// unutmayın" gibi. Kullanıcı bunları söylemez.
//
// Bu modül hem sunucuda (transkripsiyon sonrası) hem istemcide (Web Speech
// API yedek yolu) kullanılır — tek bir yerden yönetilsin diye ayrıldı.
// Daha önce filtre yalnızca sunucudaydı ve yedek yol filtresizdi.

/**
 * Türkçe metni sadeleştirir.
 *
 * KRİTİK: Büyük "İ" (U+0130) JavaScript'te toLowerCase() ile "i" + ayrı
 * bir birleşen nokta (U+0307) karakterine dönüşür; bu normal "i" ile
 * EŞLEŞMEZ. Bu yüzden /izlediğiniz/i gibi bir regex "İzlediğiniz..."
 * metnini yakalayamaz.
 */
export function trNormalize(metin: string): string {
  return metin
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/\u0307/g, "") // artık birleşen nokta kalmışsa temizle
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[.,!?;:]/g, " ") // noktalama eşleşmeyi bozmasın
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bilinen halüsinasyon kalıpları.
 * Kalıplar SADELEŞTİRİLMİŞ metne göre yazılmıştır (aksansız, küçük harf).
 */
const KALIPLAR: RegExp[] = [
  // YouTube kapanış kalıpları (en sık görülenler)
  /izlediginiz icin tesekkur/,
  /izledigin icin tesekkur/,
  /izlediginiz icin sagol/,
  /izleyip destek/,
  /videoyu izle/,
  /bir sonraki (video|bolum)/,
  /kanalima abone/,
  /abone olmayi unutmayin/,
  /abone ol(un)?( ve)? bildirim/,
  /begenmeyi unutmayin/,
  /gorusmek uzere/,
  /kanalimiza abone/,

  // Altyazı imzaları
  /^altyazi/,
  /altyazi\s*[:]?\s*m\s*k/,
  /altyazi (ve )?ceviri/,

  // İngilizce karşılıkları
  /thanks? for watching/,
  /please subscribe/,
  /subtitles? by/,
  /see you (in the )?next/,
  /don'?t forget to subscribe/,

  // Tek başına anlamsız kısa çıktılar
  /^(thank you|thanks|bye)$/,
  /^(altyazi|subtitle)s?$/,
];

/**
 * Metin bir Whisper halüsinasyonu mu?
 *
 * @param metin Transkripsiyon çıktısı
 */
export function halusinasyonMu(metin: string): boolean {
  const ham = (metin ?? "").trim();
  if (!ham) return true;
  if (ham.length < 3) return true; // çok kısa çıktılar genelde gürültü

  // YABANCI DİL UYDURMASI:
  // Whisper anlamsız sesi bazen İskandinav/İzlanda dillerine benzeyen
  // metinlere çeviriyor ("En svo neyðið um hata ljönsson" gibi). Türkçede
  // hiç kullanılmayan bu karakterler net bir işarettir.
  if (/[ðþæøåœ]/i.test(ham)) return true;

  // TEKRAR EDEN ANLAMSIZ HECE:
  // "Henni, henni." / "La la la" gibi çıktılar sessizlik/gürültü
  // halüsinasyonudur. Aynı kısa kelimenin üst üste tekrarı aranıyor.
  const kelimeler = trNormalize(ham).split(" ").filter(Boolean);
  if (kelimeler.length >= 2 && kelimeler.length <= 6) {
    const benzersiz = new Set(kelimeler);
    // Tüm kelimeler aynı (ya da tek kelimenin tekrarı) ve kısa
    if (benzersiz.size === 1 && kelimeler[0].length <= 8 && !/^(tamam|evet|hayir|olur|peki|tesekkurler|sagol)$/.test(kelimeler[0])) return true;
  }

  const sade = trNormalize(ham);
  if (!sade) return true;

  return KALIPLAR.some((k) => k.test(sade));
}


/**
 * YANKI TESPİTİ — asistanın kendi sesi mi geri geldi?
 *
 * Sesli görüşmede hoparlörden çıkan asistan sesi mikrofona sızabiliyor.
 * Whisper bunu yazıya döküyor ve asistan kendi cümlesini "kullanıcı sordu"
 * sanıp kendine cevap veriyor — kendi kendine konuşma döngüsü.
 *
 * Transkripsiyon genelde bozuk gelir ("Hoş geldiniz" → "Heldik"), bu yüzden
 * birebir karşılaştırma işe yaramaz. Bunun yerine ANLAMLI KELİME ÖRTÜŞMESİNE
 * bakılır: transkripsiyondaki uzun kelimelerin çoğu, asistanın az önce
 * söylediği metinde de geçiyorsa bu bir yankıdır.
 *
 * @param transkript Mikrofondan gelen metin
 * @param sonAsistanMetni Asistanın en son seslendirdiği metin
 */
export function yankiMi(transkript: string, sonAsistanMetni: string | null): boolean {
  if (!sonAsistanMetni) return false;

  const t = trNormalize(transkript);
  const a = trNormalize(sonAsistanMetni);
  if (!t || !a) return false;

  // Yankı transkripsiyonu bozuk gelir ("kuralları" → "kuraltık"), bu yüzden
  // tam kelime yerine KÖK (ilk 5 harf) karşılaştırılır.
  const kok = (k: string) => k.slice(0, 5);

  // Kısa kelimeler (ve, bir, için...) her metinde geçtiği için elenir
  const transkriptKokleri = t.split(" ").filter((k) => k.length >= 5).map(kok);
  if (transkriptKokleri.length < 3) return false; // çok kısa metinde karar verme

  const asistanKokleri = new Set(a.split(" ").filter((k) => k.length >= 5).map(kok));
  if (asistanKokleri.size === 0) return false;

  const ortak = transkriptKokleri.filter((k) => asistanKokleri.has(k)).length;
  const oran = ortak / transkriptKokleri.length;

  // Anlamlı kelime köklerinin %40'ından fazlası asistanın az önce söylediği
  // metinde geçiyorsa bu kullanıcının değil, asistanın kendi sesidir.
  return oran >= 0.4;
}

/**
 * SEPET ONAYI İÇİN KISA YANKI TESPİTİ — yankiMi en az 3 uzun kelime ister;
 * "Sepete eklensin mi?" gibi kısa soru yankısını yakalayamaz. Burada:
 * cevaptaki kelimelerin TAMAMI asistanın son cümlesinde geçiyorsa ve
 * (2+ kelime ya da soru eki "mi/mı/mu/mü" varsa) bu kullanıcının değil
 * asistanın kendi sesidir. "evet eklensin" → "evet" asistan metninde yok → yankı değil.
 */
export function kisaYankiMi(transkript: string, sonAsistanMetni: string | null): boolean {
  if (!sonAsistanMetni) return false;
  const t = trNormalize(transkript).split(" ").filter(Boolean);
  const a = new Set(trNormalize(sonAsistanMetni).split(" ").filter(Boolean));
  if (!t.length) return false;
  const hepsiAsistanda = t.every((k) => a.has(k));
  const soruEki = t.some((k) => /^m[iu]$/.test(k));
  return hepsiAsistanda && (t.length >= 2 || soruEki);
}
