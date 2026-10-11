import type { OrderStatus, PaymentMethod } from "./types";

const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
export const formatTL = (n: number | string) => tl.format(Number(n));

const dt = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});
export const formatDate = (s: string) => dt.format(new Date(s));

export const STATUS_LABEL: Record<OrderStatus, string> = {
  alindi: "Sipariş alındı",
  hazirlaniyor: "Hazırlanıyor",
  yolda: "Yolda",
  teslim_edildi: "Teslim edildi",
  iptal: "İptal edildi",
};

export const STATUS_FLOW: OrderStatus[] = ["alindi", "hazirlaniyor", "yolda", "teslim_edildi"];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  kapida_nakit: "Kapıda nakit",
  kapida_pos: "Kapıda kredi/banka kartı (POS)",
};

export const effectivePrice = (p: { price: number; sale_price: number | null }) =>
  Number(p.sale_price ?? p.price);

export const discountRate = (p: { price: number; sale_price: number | null }) =>
  p.sale_price == null ? 0 : Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100);

/** Veritabanı hata kodlarını kullanıcı mesajına çevirir. */
export function orderErrorMessage(raw: string): string {
  const [code, arg] = raw.split(":");
  switch (code) {
    case "MUSTERI_ENGELLI":
      return "Siparişin şu an alınamıyor. Lütfen marketimizle iletişime geç.";
    case "SOZLESME_ONAYI":
      return "Devam etmek için sözleşmeyi onaylayın.";
    case "GECERSIZ_ISTEK":
      return "İstek geçersiz. Sayfayı yenileyip tekrar dene.";
    case "MARKET_KAPALI":
      return "Market şu an sipariş almıyor.";
    case "SAAT_DISI":
      return `Çalışma saatlerimiz dışındasın. Siparişler ${arg ?? "10:00"}'da tekrar açılıyor.`;
    case "EKSIK_BILGI":
      return "Ad, telefon ve adres zorunludur.";
    case "GECERSIZ_ODEME":
      return "Geçersiz ödeme yöntemi.";
    case "GECERSIZ_SAAT":
      return "Lütfen geçerli bir teslimat saati seçin.";
    case "SEPET_BOS":
      return "Sepetiniz boş.";
    case "GECERSIZ_ADET":
      return "Geçersiz ürün adedi.";
    case "URUN_YOK":
      return "Sepetinizdeki bir ürün artık satışta değil.";
    case "STOK_YETERSIZ":
      return `${arg ?? "Bir ürün"} için yeterli stok kalmadı.`;
    case "LIMIT_ASILDI":
      return `${arg ?? "Bir ürün"} için sipariş başına adet sınırı aşıldı.`;
    case "BOLGE_DISI":
      return "Şu an yalnızca Çorlu'ya teslimat yapıyoruz.";
    case "MAHALLE_GECERSIZ":
      return "Seçtiğin mahalleye şu an teslimat yapmıyoruz. Lütfen başka bir mahalle seç.";
    case "SOKAK_GECERSIZ":
      return "Lütfen cadde / sokak seçin veya yazın.";
    case "KAPI_NO_EKSIK":
      return "Dış kapı numarasını girin.";
    case "MIN_TUTAR":
      return `Minimum sipariş tutarı ${formatTL(arg ?? 0)}.`;
    default:
      return "Sipariş oluşturulamadı. Lütfen tekrar deneyin.";
  }
}

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
export function slugify(s: string) {
  return s
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR_MAP[c] ?? c)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
