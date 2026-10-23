import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/shop/Header";
import { getStoreSettings } from "@/lib/data/catalog";
import { Brand } from "@/components/Brand";
import { VoiceAssistant } from "@/components/shop/VoiceAssistant";
import { BottomNav } from "@/components/shop/BottomNav";
import { WhatsAppButton } from "@/components/shop/WhatsAppButton";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="icerik">{children}</main>
      <Footer />
      <Suspense fallback={null}>
        <Voice />
      </Suspense>
      <Suspense fallback={null}>
        <WhatsApp />
      </Suspense>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </>
  );
}

async function Voice() {
  const s = await getStoreSettings();
  if (s.voice_enabled === false) return null;
  return <VoiceAssistant settings={s} />;
}

async function WhatsApp() {
  const s = await getStoreSettings();
  const phone = s.whatsapp_phone || s.phone;
  if (!phone) return null;
  return <WhatsAppButton phone={phone} storeName={s.store_name || "Sanal Market"} />;
}

async function Footer() {
  const s = await getStoreSettings();
  return (
    <footer className="mt-10 border-t border-line bg-white pb-44 lg:pb-0">
      <div className="mx-auto grid max-w-[1440px] gap-2 px-4 py-6 text-sm text-muted sm:grid-cols-3">
        <div>
          <Brand size="sm" />
          <p className="mt-1 text-xs font-semibold tracking-wide">İhtiyacın Kapında!</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
            <Link href="/kvkk" className="underline underline-offset-2 hover:text-brand">KVKK Aydınlatma Metni</Link>
            <Link href="/mesafeli-satis-sozlesmesi" className="underline underline-offset-2 hover:text-brand">Mesafeli Satış Sözleşmesi</Link>
            <Link href="/on-bilgilendirme" className="underline underline-offset-2 hover:text-brand">Ön Bilgilendirme Formu</Link>
          </div>
        </div>
        <p>{s.address ?? "Adres bilgisi ayarlardan girilecek"}</p>
        <p>
          {s.working_hours && <>Çalışma saatleri: <b className="text-ink">{s.working_hours}</b><br /></>}
          {s.phone ? `Tel: ${s.phone}` : "Kapıda nakit · Kapıda kartla ödeme"}
        </p>
      </div>
    </footer>
  );
}
