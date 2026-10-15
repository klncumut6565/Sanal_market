import type { StoreSettings } from "@/lib/types";
import { formatTL } from "@/lib/format";
import { displayPhone } from "@/lib/phone";

export const LEGAL_UPDATED = "15 Ekim 2026";

export function LegalSection({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-extrabold">
        {n}. {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const missing = <span className="rounded bg-amber-100 px-1 text-amber-800">[ayarlardan girilecek]</span>;

/** Satıcı bilgileri tablosu (Yönetim → Ayarlar → Yasal satıcı bilgileri). */
export function SellerInfo({ s }: { s: StoreSettings }) {
  const rows: [string, React.ReactNode][] = [
    ["Ünvan", s.legal_name || missing],
    ["İşletme adı", s.store_name],
    ["Adres", s.address || missing],
    ["Telefon", s.phone ? displayPhone(s.phone) : s.whatsapp_phone ? displayPhone(s.whatsapp_phone) : missing],
    ["E-posta", s.contact_email || missing],
    ["Vergi dairesi / no", s.tax_office || s.tax_no ? `${s.tax_office ?? ""} ${s.tax_no ?? ""}`.trim() : missing],
  ];
  if (s.mersis_no) rows.push(["MERSİS no", s.mersis_no]);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-bg p-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DeliveryTerms({ s }: { s: StoreSettings }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>
        Teslimat, {s.delivery_area_note || "Çorlu (Tekirdağ) içindeki teslimat bölgelerine"} motokuryeyle, siparişte seçilen teslimat saatinde yapılır. Teslimat
        süresi hiçbir durumda sipariş tarihinden itibaren 30 günü aşamaz.
      </li>
      <li>
        Teslimat ücreti {formatTL(s.delivery_fee)}&apos;dir; {formatTL(s.free_delivery_threshold)} ve üzeri siparişlerde teslimat ücretsizdir.
        {s.min_order_amount > 0 ? ` Minimum sipariş tutarı ${formatTL(s.min_order_amount)}'dir.` : ""}
      </li>
      <li>Ödeme teslimat sırasında, kapıda nakit veya kapıda kredi/banka kartı ile yapılır. Siparişte internet üzerinden ödeme alınmaz.</li>
      <li>Fiyatlara KDV dahildir. Sipariş anındaki fiyat geçerlidir.</li>
      <li>
        Siparişteki bir ürün stokta kalmazsa Alıcı bilgilendirilir; ürün siparişten çıkarılır veya Alıcının onayıyla muadiliyle değiştirilir ve toplam tutar
        buna göre güncellenir. Alıcı, eksik ürün nedeniyle siparişin tamamından vazgeçebilir.
      </li>
      <li>Alkollü içkiler 22:00–06:00 arasında satılmaz; alkol ve tütün ürünleri 18 yaşından küçüklere satılmaz ve teslim edilmez (teslimatta kimlik istenebilir).</li>
    </ul>
  );
}

export function WithdrawalTerms({ s }: { s: StoreSettings }) {
  return (
    <>
      <p>
        Alıcı, malın kendisine veya gösterdiği kişiye teslim edildiği günden itibaren <b>14 gün</b> içinde herhangi bir gerekçe göstermeksizin ve cezai şart
        ödemeksizin sözleşmeden cayma hakkına sahiptir. Cayma bildirimi bu süre içinde telefonla, WhatsApp&apos;tan
        {s.contact_email ? ` veya ${s.contact_email} adresine e-postayla` : ""} Satıcıya yapılır.
      </p>
      <p>
        Cayma hakkı kullanıldığında Satıcı, bildirimin kendisine ulaştığı tarihten itibaren 14 gün içinde tahsil edilen tutarı (teslimat ücreti dahil) ödemenin
        yapıldığı yöntemle iade eder. Alıcı, cayma bildiriminden itibaren 10 gün içinde malı geri gönderir veya Satıcıya teslim eder; mal Satıcının
        kuryesiyle teslim alınabilir.
      </p>
      <p>
        <b>Cayma hakkı kullanılamayan mallar</b> (Mesafeli Sözleşmeler Yönetmeliği m.15): çabuk bozulabilen veya son kullanma tarihi geçebilecek mallar (ör. süt,
        et, meyve-sebze, ekmek, taze ürünler); tesliminden sonra ambalajı, bandı, mührü veya paketi açılmış olup iadesi sağlık ve hijyen açısından uygun
        olmayan mallar; tesliminden sonra başka ürünlerle karışan ve doğası gereği ayrıştırılması mümkün olmayan mallar.
      </p>
      <p>Ayıplı (bozuk, son kullanma tarihi geçmiş, hasarlı) ürünlerde Alıcının 6502 sayılı Kanun&apos;dan doğan seçimlik hakları saklıdır; bu ürünler teslimatta veya hemen sonra bildirilirse ücretsiz değiştirilir ya da bedeli iade edilir.</p>
    </>
  );
}

export function Complaints() {
  return (
    <p>
      Alıcı, şikâyet ve itirazlarını önce Satıcıya iletebilir. Uyuşmazlıklarda, Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar dahilinde Alıcının
      yerleşim yerindeki veya işlemin yapıldığı yerdeki <b>Tüketici Hakem Heyetine</b>, bu sınırları aşan uyuşmazlıklarda <b>Tüketici Mahkemesine</b>{" "}
      başvurulabilir. Başvurular e-Devlet üzerinden Tüketici Bilgi Sistemi (TÜBİS) ile de yapılabilir.
    </p>
  );
}
