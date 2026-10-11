// Yönetim paneli sesli asistanı: SALT-OKUNUR raporlama araçları + talimat.
// Sipariş almaz, hiçbir veriyi değiştirmez (yalnızca sayfa açabilir).

const PERIOD = {
  type: "string",
  enum: ["bugun", "dun", "bu_hafta", "gecen_hafta", "bu_ay", "gecen_ay", "son_7_gun", "son_30_gun", "ozel"],
  description:
    "Dönem. bugun/dun = iş günü (10:00→01:00). bu_hafta Pazartesi'den bugüne. 'ozel' için start/end (YYYY-AA-GG) ver.",
};

export const ADMIN_TOOLS = [
  {
    name: "get_sales_report",
    description:
      "Ciro raporu: toplam ciro, sipariş sayısı, ortalama sepet, iptal sayısı ve ÖNCEKİ dönemle karşılaştırma (yüzde değişim). " +
      "'Bu haftaki ciro', 'geçen haftaya göre yüzde kaç', 'dün ne kadar sattık', 'bu ay nasıl gidiyor' sorularında kullan.",
    parameters: {
      type: "object",
      properties: {
        period: PERIOD,
        start: { type: "string", description: "ozel dönem başlangıcı YYYY-AA-GG" },
        end: { type: "string", description: "ozel dönem bitişi YYYY-AA-GG (dahil)" },
      },
      required: ["period"],
    },
  },
  {
    name: "get_top_products",
    description: "Seçilen dönemde en çok satan ürünler (adet ve ciroya göre). 'En çok ne sattık', 'çok satanlar' sorularında kullan.",
    parameters: {
      type: "object",
      properties: { period: PERIOD, start: { type: "string" }, end: { type: "string" }, limit: { type: "integer", description: "Kaç ürün (varsayılan 5)" } },
      required: ["period"],
    },
  },
  {
    name: "get_stock_status",
    description: "Stok durumu: tükenen ürünler, kritik seviyedeki ürünler (adlarıyla), toplam aktif ürün. 'Stoklarımız ne durumda', 'neler bitti' sorularında kullan.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "search_products",
    description: "Bir ürünün fiyatını, indirimini, stoğunu ve satışta olup olmadığını bulur. 'Domates stoğu kaç', 'beyaz peynir fiyatı ne' gibi.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Ürün adı (yalın hâl)" } }, required: ["query"] },
  },
  {
    name: "get_open_orders",
    description: "Şu an açık (alındı / hazırlanıyor / yolda) siparişler: aşamalara göre sayı, en uzun bekleyen, hedef süreyi aşanlar.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_customer_stats",
    description: "Müşteri istatistikleri: dönemde sipariş veren müşteri sayısı, yeni müşteriler, en çok harcayan müşteriler.",
    parameters: { type: "object", properties: { period: PERIOD, start: { type: "string" }, end: { type: "string" } }, required: ["period"] },
  },
  {
    name: "get_store_status",
    description: "Market ayarları: şu an açık mı, çalışma saatleri, teslimat ücreti, ücretsiz teslimat ve minimum sipariş tutarı.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_discounted_products",
    description:
      "İndirimdeki ürünler: hangi üründe yüzde kaç indirim var, normal ve indirimli fiyat, stok durumu. En yüksek indirimden başlayarak sıralı. " +
      "'Hangi ürünlerde indirim var', 'en büyük indirim hangisi', 'süt ürünlerinde indirim var mı' sorularında kullan.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "İsteğe bağlı: ürün veya kategori adıyla süz (ör. 'peynir', 'içecek')" },
        include_inactive: { type: "boolean", description: "Satışa kapalı ürünler de dahil edilsin mi (varsayılan hayır)" },
      },
    },
  },
  {
    name: "go_to_page",
    description: "Yönetim panelinde bir sayfayı açar.",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: ["genel_bakis", "siparisler", "urunler", "kritik_stok", "barkod", "kategoriler", "musteriler", "bolgeler", "ayarlar"],
        },
      },
      required: ["page"],
    },
  },
];

export const ADMIN_VOICE_INSTRUCTION = `
Sen "Sanal Market"in YÖNETİM PANELİ sesli asistanısın; marketin sahibi/yöneticisiyle konuşuyorsun. Görevin SİPARİŞ ALMAK DEĞİL: işletmenin durumu hakkında bilgi vermek (ciro, karşılaştırma, stok, siparişler, müşteriler). SADECE Türkçe, kısa ve net konuş (1-3 cümle); önce sonucu söyle.
GÜRÜLTÜ VE YANKI: Anlaşılmaz, yabancı dilde gibi ya da ilgisiz kalıp sesleri ("izlediğiniz için teşekkürler") soru sayma; "Tekrar eder misin?" de. Kendi cümlenin yankısına cevap verme.

KESİN KURALLAR:
- Sayı, tutar, yüzde, ürün veya müşteri hakkında konuşmadan ÖNCE MUTLAKA ilgili aracı çağır. ASLA tahmin etme, uydurma, yuvarlama yapma; araç sonucundaki değeri aynen söyle.
- Tutarları doğal söyle: "on iki bin dört yüz elli lira". Yüzdeyi "yüzde 18 daha iyi" / "yüzde 7 daha düşük" diye söyle.
- Karşılaştırmada araç "compare_to_date" (aynı gün sayısına göre) verdiyse onu kullan ve bunu belirt: "geçen haftanın aynı günlerine göre". İstenirse önceki dönemin tamamını da söyle.
- Önceki dönemde hiç satış yoksa yüzde verme; "geçen hafta satış yoktu" de.
- İndirim sorularında get_discounted_products çağır; ürün adını, yüzdeyi ve fiyatları söyle ("Beyaz peynirde yüzde 11 indirim var, 189,90'dan 169,90 liraya"). Çoksa en yüksek 5'ini say, toplam sayıyı belirt; stokta olmayan indirimli ürün varsa ayrıca uyar.
- Stok sorularında önce tükenenleri, sonra kritik olanları ADLARIYLA say (en fazla 5; fazlası varsa "ve X ürün daha" de).
- Veri değiştiremezsin: fiyat/stok güncelleme, sipariş iptali, ürün ekleme isterse "bunu ilgili sayfadan yapabilirsin, açayım mı?" de ve isterse go_to_page çağır.
- Sipariş alma veya sepete ekleme isteğine "bu asistan yönetim içindir; sipariş mağaza ekranından verilir" de.
- Kısa bir yorum yapabilirsin (ör. "cumartesi en yoğun gün olmuş") ama yalnızca araç verisine dayanarak.
- "[SİSTEM]" ile başlayan mesajlar uygulamadan gelir; oturum başında kısa selam ver: "Merhaba, işletmenle ilgili ne öğrenmek istersin? Ciro, stok, siparişler…"
`.trim();
