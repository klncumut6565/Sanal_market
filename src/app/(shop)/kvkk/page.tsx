import Link from "next/link";
import { getStoreSettings } from "@/lib/data/catalog";

export const metadata = { title: "KVKK Aydınlatma Metni" };

const UPDATED = "11 Ekim 2026";

export default async function KvkkPage() {
  const s = await getStoreSettings();
  const iletisim = [s.address, s.phone ? `Tel: ${s.phone}` : null].filter(Boolean).join(" · ");

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-6 text-[15px] leading-relaxed">
      <header>
        <h1 className="text-2xl font-black">Kişisel Verilerin Korunması Aydınlatma Metni</h1>
        <p className="text-sm text-muted">Son güncelleme: {UPDATED}</p>
      </header>

      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, <b>{s.store_name}</b> olarak veri sorumlusu sıfatıyla; internet sitemizi
        kullanmanız, üye olmanız, sipariş vermeniz ve sesli alışveriş asistanını kullanmanız sırasında işlenen kişisel verileriniz hakkında sizi
        bilgilendiriyoruz.
      </p>

      <Section n="1" title="Veri sorumlusu">
        <p>
          {s.store_name}
          {iletisim ? ` — ${iletisim}` : ""}
        </p>
      </Section>

      <Section n="2" title="İşlenen kişisel veriler">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Kimlik:</b> ad soyad.</li>
          <li><b>İletişim:</b> cep telefonu, e-posta adresi (üyelikte), teslimat adresi (mahalle, sokak, kapı numarası, apartman/site adı, adres tarifi).</li>
          <li><b>Müşteri işlemi:</b> sipariş içeriği, tutarı, tarihi, teslimat saati, ödeme yöntemi (kapıda nakit/kart), sipariş notları, WhatsApp ve telefon yazışmaları.</li>
          <li><b>Ses verisi (yalnızca sesli asistanı kullanırsanız):</b> asistanla konuşurken mikrofonunuzdan alınan ses ve bu sesin yazıya dökülmüş hâli.</li>
          <li><b>İşlem güvenliği:</b> oturum bilgileri; sesli asistanın kötüye kullanımını önlemek için IP adresinizden türetilen, geri çevrilemeyen bir özet (ham IP adresi saklanmaz).</li>
          <li><b>Cihazınızda tutulan bilgiler:</b> sepetiniz, son teslimat adresiniz, sipariş takip bağlantılarınız ve tercihleriniz tarayıcınızın yerel depolamasında saklanır; bunları tarayıcı ayarlarınızdan silebilirsiniz.</li>
        </ul>
        <p className="text-sm text-muted">Ödeme kapıda yapıldığı için kart bilgileriniz sitemizde işlenmez ve saklanmaz.</p>
      </Section>

      <Section n="3" title="İşleme amaçları">
        <ul className="list-disc space-y-1 pl-5">
          <li>Siparişin alınması, hazırlanması, teslim edilmesi ve ödemenin kapıda tahsil edilmesi,</li>
          <li>Sipariş durumu, stokta olmayan ürünler veya teslimat hakkında sizinle iletişime geçilmesi (telefon, WhatsApp),</li>
          <li>Üyelik hesabınızın oluşturulması ve sipariş geçmişinizin gösterilmesi,</li>
          <li>Sesli asistan ile ürün aramanız, ürünleri sepetinize eklemeniz ve (üyelerde geçmiş siparişlerinize göre kişisel) öneri almanız,</li>
          <li>Faturalandırma, muhasebe ve yasal yükümlülüklerin yerine getirilmesi,</li>
          <li>Site ve hizmet güvenliğinin sağlanması, kötüye kullanımın önlenmesi.</li>
        </ul>
      </Section>

      <Section n="4" title="Hukuki sebepler">
        <ul className="list-disc space-y-1 pl-5">
          <li>Sipariş ve üyelik verileri: sözleşmenin kurulması ve ifası (KVKK m.5/2-c), hukuki yükümlülük (m.5/2-ç) ve meşru menfaat (m.5/2-f).</li>
          <li>Ses verisi ve bunun yurt dışındaki hizmet sağlayıcıya aktarılması: <b>açık rızanız</b> (m.5/1 ve m.9). Sesli asistan, siz onay vermeden çalışmaz.</li>
        </ul>
      </Section>

      <section id="sesli-asistan" className="scroll-mt-24 space-y-2 rounded-2xl bg-brand-soft p-4 ring-1 ring-brand/20">
        <h2 className="text-lg font-extrabold">5. Sesli alışveriş asistanı</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Sesli asistanı kullanmak <b>tamamen isteğe bağlıdır</b>. Siparişinizi asistan olmadan, ekrandan da verebilirsiniz.</li>
          <li>
            Mikrofon yalnızca &quot;Sesli sipariş&quot; butonuna basıp asistanı başlattığınızda açılır ve &quot;Konuşmayı bitir&quot; dediğinizde, paneli kapattığınızda,
            90 saniye konuşmadığınızda veya en geç 10 dakika sonra kapanır.
          </li>
          <li>
            Sesiniz, konuşmayı anlayıp yanıt üretmesi için <b>Google LLC</b>&apos;nin Gemini yapay zekâ hizmetine gerçek zamanlı olarak iletilir. Bu hizmetin
            sunucuları <b>yurt dışında</b> bulunabilir; bu nedenle ses verinizin yurt dışına aktarılması söz konusudur.
          </li>
          <li>
            Ses kayıtlarınız ve konuşma metinleri <b>bizim sistemlerimizde saklanmaz</b>. Asistan yalnızca ürün aramak ve sepetinizi düzenlemek için
            kullanılır; sesiniz kimlik tespiti amacıyla kullanılmaz.
          </li>
          <li>
            Üye girişi yaptıysanız, size adınızla hitap edebilmesi ve önceki alışverişlerinize göre kişisel öneri sunabilmesi için <b>adınız ve geçmiş
            siparişlerinizdeki ürün adları, adetleri ve tarihleri</b> de asistanın oturumu süresince Google&apos;ın Gemini hizmetine iletilir. Adres,
            telefon ve ödeme bilgileriniz asistana iletilmez. Misafir kullanıcılarda bu bilgiler kullanılmaz.
          </li>
          <li>Google&apos;ın bu verileri işleme ve saklama koşulları, Google&apos;ın Gemini API hizmet şartları ve gizlilik politikasına tabidir.</li>
          <li>Asistanı kullanırken adres, telefon, kimlik veya ödeme bilgisi gibi kişisel bilgilerinizi söylemeyiniz; bunları ödeme sayfasında ekrandan girersiniz.</li>
          <li>Açık rızanızı dilediğiniz zaman geri alabilirsiniz: asistanı kullanmamanız yeterlidir; verdiğiniz onayı tarayıcı verilerinizi silerek de kaldırabilirsiniz.</li>
        </ul>
      </section>

      <Section n="6" title="Aktarım">
        <ul className="list-disc space-y-1 pl-5">
          <li>Sipariş ve teslimat bilgileriniz, siparişi size ulaştıran kurye personelimizle paylaşılır.</li>
          <li>
            Verileriniz, sitemizin barındırıldığı ve veritabanı hizmeti aldığımız bulut hizmet sağlayıcılarının (Vercel Inc., Supabase Inc.) sunucularında
            saklanır; bu sunucular yurt dışında bulunabilir.
          </li>
          <li>Sesli asistan kullanılırsa ses veriniz yukarıda açıklandığı şekilde Google LLC&apos;ye aktarılır.</li>
          <li>
            Yönetim panelindeki sesli raporlama asistanı kullanıldığında, istenen rapora göre sipariş özetleri (tutar, ürün, müşteri adı) yanıt üretilmesi
            amacıyla aynı şekilde Google LLC&apos;ye iletilebilir; telefon ve adres bilgileri bu amaçla iletilmez.
          </li>
          <li>Kanunen yetkili kamu kurum ve kuruluşlarına, talep hâlinde ve mevzuatın gerektirdiği ölçüde aktarılabilir.</li>
        </ul>
      </Section>

      <Section n="7" title="Toplama yöntemi">
        <p>Kişisel verileriniz; internet sitemizdeki üyelik, sipariş ve sesli asistan formları/araçları ile, telefon ve WhatsApp üzerinden elektronik ortamda toplanır.</p>
      </Section>

      <Section n="8" title="Saklama süresi">
        <p>
          Sipariş ve fatura bilgileri ilgili mevzuatta öngörülen süreler boyunca, üyelik bilgileri üyeliğiniz devam ettiği sürece saklanır; süre sonunda silinir,
          yok edilir veya anonim hâle getirilir. Ses kayıtları sistemlerimizde saklanmaz.
        </p>
      </Section>

      <Section n="9" title="Haklarınız (KVKK m.11)">
        <p>Veri sorumlusuna başvurarak;</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>kişisel verilerinizin işlenip işlenmediğini öğrenme ve işlenmişse bilgi talep etme,</li>
          <li>işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
          <li>yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
          <li>eksik veya yanlış işlenmişse düzeltilmesini, KVKK m.7 şartları çerçevesinde silinmesini veya yok edilmesini isteme ve bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme,</li>
          <li>münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme,</li>
          <li>kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
        </ul>
        <p>haklarına sahipsiniz. Başvurularınızı yukarıdaki iletişim bilgileri üzerinden yazılı olarak iletebilirsiniz; talebiniz en geç 30 gün içinde sonuçlandırılır.</p>
      </Section>

      <p className="text-sm text-muted">
        <Link href="/" className="font-semibold text-brand">
          ← Alışverişe dön
        </Link>
      </p>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-extrabold">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
