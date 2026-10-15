import Link from "next/link";
import { getStoreSettings } from "@/lib/data/catalog";
import { Complaints, DeliveryTerms, LEGAL_UPDATED, LegalSection, SellerInfo, WithdrawalTerms } from "@/components/shop/LegalDoc";

export const metadata = { title: "Ön Bilgilendirme Formu" };

export default async function PreInfoPage() {
  const s = await getStoreSettings();
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-6 text-[15px] leading-relaxed">
      <header>
        <h1 className="text-2xl font-black">Ön Bilgilendirme Formu</h1>
        <p className="text-sm text-muted">Son güncelleme: {LEGAL_UPDATED}</p>
      </header>
      <p>
        Bu form, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, siparişinizi vermeden önce sizi bilgilendirmek
        amacıyla hazırlanmıştır. Siparişi vermeniz, bu bilgileri okuduğunuz ve ödeme yükümlülüğü doğuracağını bildiğiniz anlamına gelir.
      </p>
      <LegalSection n="1" title="Satıcı bilgileri">
        <SellerInfo s={s} />
      </LegalSection>
      <LegalSection n="2" title="Ürünler ve fiyat">
        <p>
          Sipariş ettiğiniz ürünlerin adı, birimi (ör. 1 kg, 500 g), adedi, birim fiyatı, teslimat ücreti ve <b>vergiler dahil toplam tutar</b>, siparişi
          onaylamadan hemen önce ödeme sayfasındaki &quot;Sipariş özeti&quot; bölümünde gösterilir. Bu özet, bu formun ayrılmaz parçasıdır. Sipariş sonrası
          bilgiler sipariş takip sayfasında ve Siparişlerim bölümünde saklanır.
        </p>
      </LegalSection>
      <LegalSection n="3" title="Teslimat ve ödeme">
        <DeliveryTerms s={s} />
      </LegalSection>
      <LegalSection n="4" title="Cayma hakkı">
        <WithdrawalTerms s={s} />
      </LegalSection>
      <LegalSection n="5" title="Şikâyet ve itiraz">
        <Complaints />
      </LegalSection>
      <p className="text-sm text-muted">
        Ayrıca bakınız: <Link href="/mesafeli-satis-sozlesmesi" className="font-semibold text-brand underline">Mesafeli Satış Sözleşmesi</Link> ·{" "}
        <Link href="/kvkk" className="font-semibold text-brand underline">KVKK Aydınlatma Metni</Link>
      </p>
    </article>
  );
}
