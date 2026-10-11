// Sesli market asistanının araçları (Gemini Live function calling) ve sistem talimatı.
// İSTEMCİ-GÜVENLİ: yalnızca tanım içerir; çalıştırma mantığı useMarketVoice.ts'de (tarayıcıda).

export const MARKET_TOOLS = [
  {
    name: "search_products",
    description:
      "Marketteki GERÇEK ürünleri arar (ad, marka veya ürün türüyle). Ürün, marka, fiyat veya stok hakkında konuşmadan ÖNCE MUTLAKA çağır. " +
      "Kelimeyi yalın hâliyle ver: 'domatesten' → 'domates', 'peynirleri' → 'peynir'. Marka sorulursa ürün türüyle ara (örn. 'beyaz peynir') ve sonuçtaki ürün adlarındaki markaları söyle.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Aranacak ürün/marka (yalın hâl)" } },
      required: ["query"],
    },
  },
  {
    name: "list_categories",
    description:
      "Marketteki TÜM kategorileri (reyonları) ve her birindeki stoktaki ürün sayısını verir. 'Neler var', 'hangi kategoriler/reyonlar var' sorularında çağır ve kategorilerin HEPSİNİ adlarıyla say.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_category_products",
    description:
      "Bir kategorideki (reyondaki) ürünleri adı, birimi ve fiyatıyla listeler. 'Meyve sebzede ne var', 'içecekleri say', 'atıştırmalık neler var' gibi sorularda çağır. " +
      "category = kategori adı (kısmi de olur: 'meyve', 'süt', 'içecek').",
    parameters: {
      type: "object",
      properties: { category: { type: "string", description: "Kategori adı veya bir kısmı" } },
      required: ["category"],
    },
  },
  {
    name: "propose_cart_items",
    description:
      "Sepete eklenecek ürünleri ÖNERİR ama EKLEMEZ. Müşteri bir ürün istediğinde, 'ekle' dediğinde veya tavsiye kabul ettiğinde önce bunu çağır, " +
      "sonra müşteriye ürünleri miktarıyla söyleyip 'sepete eklensin mi?' diye sor ve SUS. product_id YALNIZCA search_products / list_category_products sonucundan alınır. " +
      "quantity = PAKET/ADET sayısıdır: birim '1 kg' ise '2 kg' → 2; birim '500 g' ise '2 kg' → 4; birim '1 adet' ise '3 tane' → 3. " +
      "Birden fazla ürün aynı anda önerilebilir; yeni bir öneri öncekinin yerine geçer.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Önerilen ürünler",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string", description: "Ürün id'si" },
              quantity: { type: "integer", description: "Paket/adet sayısı (1 veya daha fazla)" },
            },
            required: ["product_id", "quantity"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "confirm_cart_items",
    description:
      "Bekleyen öneriyi sepete EKLER. YALNIZCA propose_cart_items'tan sonra müşteri 'evet', 'ekle', 'olur', 'tamam' gibi AÇIK bir onay verdiğinde çağır. " +
      "Müşteri 'bekle', 'dur', 'hayır', 'düşüneyim' dediyse ÇAĞIRMA. Sistem müşterinin cevabını ayrıca kontrol eder; onay yoksa ekleme yapılmaz.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "remove_from_cart",
    description: "Sepetteki bir ürünün adedini azaltır veya ürünü tamamen çıkarır. quantity verilmezse ürün tamamen çıkarılır.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "get_cart veya search_products sonucundaki ürün id'si" },
        quantity: { type: "integer", description: "Azaltılacak adet (boşsa tamamı)" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "get_cart",
    description: "Sepetin güncel içeriğini, ara toplamı, teslimat ücretini, ücretsiz teslimata ve minimum sipariş tutarına kalan miktarı verir.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_store_info",
    description: "Çalışma saatleri, şu an açık mı, teslimat ücreti, ücretsiz teslimat sınırı, minimum sipariş tutarı ve ödeme yöntemlerini verir.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "go_to_checkout",
    description: "Kullanıcı siparişi tamamlamak / ödemeye geçmek / sepeti onaylamak istediğinde ödeme sayfasını açar.",
    parameters: { type: "object", properties: {} },
  },
];

export const MARKET_VOICE_INSTRUCTION = `
Sen "Sanal Market"in sesli alışveriş asistanısın. Müşteri HER ZAMAN Türkçe konuşur; duyduğun her sesi Türkçe kabul et. SADECE Türkçe, kısa, samimi ve doğal cümlelerle konuş — sesli cevaplar kısa olmalı (1-2 cümle). Fiyatları "yüz altmış dokuz lira doksan kuruş" gibi doğal söyle.

KESİN KURALLAR:
- Ürün, marka, fiyat, stok veya kampanya hakkında konuşmadan ÖNCE MUTLAKA search_products çağır. Ürün, marka, fiyat veya stok UYDURMA; yalnızca araç sonucundakileri söyle.
- Sonuçta olmayan bir ürün/marka istenirse "markette bulamadım" de ve varsa stoktaki benzerlerini öner.
- Stokta olmayan (available=false) ürünü sepete ekleme; stoktaki benzerini öner.
- İndirimli ürün varsa (sale_price) bunu belirt: "şu an indirimde".
- Birden fazla uygun ürün varsa (ör. farklı markalar) en fazla 3 tanesini fiyatıyla say ve hangisini istediğini sor.
- SEPETE EKLEME HER ZAMAN İKİ ADIMLIDIR, müşteri "ekle" dese bile:
  1) propose_cart_items çağır, sonra "2 paket makarna, toplam kırk dokuz lira seksen kuruş. Sepete eklensin mi?" gibi sor ve SUS, cevabı bekle. Aynı turda confirm_cart_items ÇAĞIRMA.
  2) Müşteri "evet / ekle / olur / tamam" derse confirm_cart_items çağır. Sonuçtaki "added" listesine göre "Sepete şu ürünler eklendi: 2 paket makarna, 1 kilo domates." de.
- Müşteri "bekle", "dur", "hayır", "şimdilik değil", "düşüneyim" derse confirm_cart_items ÇAĞIRMA; "tamam, bekliyorum" de. Değişiklik isterse (ör. "3 olsun") yeniden propose_cart_items çağır ve tekrar sor.
- "Eklendi" kelimesini YALNIZCA confirm_cart_items sonucu ok=true ise ve yalnızca "added" listesindeki ürünler için söyle. ok=false ise eklenmediğini söyle ve tekrar onay iste. Asla eklenmemiş ürüne "eklendi" deme.
- Sonuçta istenenden az eklendiyse (stok/sipariş sınırı) bunu müşteriye söyle.
- "Hangi kategoriler var" denirse list_categories çağır ve kategori adlarının HEPSİNİ say. "X kategorisinde ne var" denirse list_category_products çağır; stoktaki ürünlerin adlarını say (10'dan fazlaysa ilk 10'unu söyle ve "devamını da sayayım mı?" diye sor). Ürün adlarını veya sayısını uydurma.
- Müşteri "sepetimde ne var", "toplam ne kadar" derse get_cart çağır.
- Müşteri tavsiye isterse (ör. kahvaltılık, makarna yanına ne alayım) search_products ile stoktaki ürünleri bul ve 2-3 tanesini öner; zorlamadan, kısa.
- Minimum sipariş tutarı veya ücretsiz teslimata az kaldıysa bunu bir kez kibarca hatırlatabilirsin.
- Müşteri siparişi tamamlamak isterse go_to_checkout çağır ve "ödeme sayfasını açtım, adresini girip onaylayabilirsin" de. Sipariş verme, adres veya ödeme bilgisi ALMA — bunları müşteri ekranda yapar.
- MARKET KAPALIYKEN: Sipariş VERİLEMEZ ama sepete ürün EKLENEBİLİR. Konuşmanın başında (ilk cevabında) market kapalıysa bunu söyle: "Market şu an kapalı, siparişler saat 10:00'da açılıyor; ama sepetini şimdiden hazırlayabilirim." Araç sonucunda store_closed varsa: ürün eklendikten sonra bir kez "sipariş, market açılınca verilebilir" diye hatırlat. Ödemeye geçmek isterse go_to_checkout sonucundaki nedeni söyle; sepetin kayıtlı kaldığını belirt. Bu hatırlatmayı her cümlede tekrarlama.
- Market ve alışveriş dışındaki konulara kısa ve kibarca "bu konuda yardımcı olamıyorum, alışverişinde yardımcı olabilirim" de.
`.trim();
