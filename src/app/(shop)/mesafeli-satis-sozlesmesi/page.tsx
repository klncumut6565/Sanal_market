import Link from "next/link";
import { getStoreSettings } from "@/lib/data/catalog";
import { Complaints, DeliveryTerms, LEGAL_UPDATED, LegalSection, SellerInfo, WithdrawalTerms } from "@/components/shop/LegalDoc";

export const metadata = { title: "Mesafeli Satış Sözleşmesi" };

export default async function DistanceSalesPage() {
  const s = await getStoreSettings();
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-6 text-[15px] leading-relaxed">
      <header>
        <h1 className="text-2xl font-black">Mesafeli Satış Sözleşmesi</h1>
        <p className="text-sm text-muted">Son güncelleme: {LEGAL_UPDATED}</p>
      </header>

      <LegalSection n="1" title="Taraflar">
        <p>
          <b>Satıcı:</b>
        </p>
        <SellerInfo s={s} />
        <p>
          <b>Alıcı:</b> Siparişi internet sitesi, sesli sipariş asistanı veya WhatsApp sipariş hattı üzerinden veren; ad soyadı, telefonu ve teslimat adresi
          siparişte belirtilen kişidir.
        </p>
      </LegalSection>

      <LegalSection n="2" title="Konu">
        <p>
          Bu sözleşme, Alıcının Satıcıya ait {s.store_name} internet sitesi ve sipariş kanalları üzerinden elektronik ortamda sipariş verdiği ürünlerin satışı
          ve teslimi ile ilgili olarak, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak
          ve yükümlülüklerini düzenler.
        </p>
      </LegalSection>

      <LegalSection n="3" title="Sözleşme konusu ürünler ve bedel">
        <p>
          Ürünlerin adı, birimi, adedi, birim fiyatı, teslimat ücreti, ödeme şekli ve vergiler dahil toplam bedeli, sipariş onayından önce gösterilen sipariş
          özetinde ve sipariş sonrası sipariş takip sayfasında yer alır; bu bilgiler sözleşmenin ayrılmaz parçasıdır.
        </p>
      </LegalSection>

      <LegalSection n="4" title="Teslimat ve ödeme">
        <DeliveryTerms s={s} />
      </LegalSection>

      <LegalSection n="5" title="Tarafların yükümlülükleri">
        <ul className="list-disc space-y-1 pl-5">
          <li>Satıcı, ürünleri sağlam, eksiksiz, siparişte belirtilen niteliklere uygun ve son kullanma tarihi geçmemiş olarak teslim eder.</li>
          <li>Alıcı, siparişte verdiği ad, telefon ve adres bilgilerinin doğru olduğunu kabul eder; hatalı bilgi nedeniyle teslim edilemeyen siparişlerden Satıcı sorumlu değildir.</li>
          <li>Alıcı adreste bulunamaz ve kendisine ulaşılamazsa sipariş iptal edilebilir; bu durumda bir ücret talep edilmez.</li>
          <li>Satıcı, stok veya mücbir sebep nedeniyle siparişi karşılayamazsa Alıcıyı derhâl bilgilendirir; kapıda ödeme yapıldığından Alıcıdan bir tahsilat yapılmaz.</li>
        </ul>
      </LegalSection>

      <LegalSection n="6" title="Cayma hakkı">
        <WithdrawalTerms s={s} />
      </LegalSection>

      <LegalSection n="7" title="Uyuşmazlıklar">
        <Complaints />
      </LegalSection>

      <LegalSection n="8" title="Yürürlük">
        <p>
          Alıcı, siparişi vermeden önce ödeme sayfasındaki onay kutusunu işaretleyerek (WhatsApp siparişlerinde sipariş özetine &quot;EVET&quot; yazarak) Ön
          Bilgilendirme Formunu ve bu sözleşmeyi okuduğunu ve kabul ettiğini beyan eder. Sözleşme, siparişin verilmesiyle kurulur; onay tarihi ve sürümü
          siparişle birlikte kaydedilir.
        </p>
      </LegalSection>

      <p className="text-sm text-muted">
        Ayrıca bakınız: <Link href="/on-bilgilendirme" className="font-semibold text-brand underline">Ön Bilgilendirme Formu</Link> ·{" "}
        <Link href="/kvkk" className="font-semibold text-brand underline">KVKK Aydınlatma Metni</Link>
      </p>
    </article>
  );
}
