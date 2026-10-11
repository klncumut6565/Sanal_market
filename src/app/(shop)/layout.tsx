import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/shop/Header";
import { getStoreSettings } from "@/lib/data/catalog";
import { Brand } from "@/components/Brand";
import { VoiceAssistant } from "@/components/shop/VoiceAssistant";
import { BottomNav } from "@/components/shop/BottomNav";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <Suspense fallback={null}>
        <Voice />
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

async function Footer() {
  const s = await getStoreSettings();
  return (
    <footer className="mt-10 border-t border-line bg-white pb-44 lg:pb-0">
      <div className="mx-auto grid max-w-[1320px] gap-2 px-4 py-6 text-sm text-muted sm:grid-cols-3">
        <div>
          <Brand size="sm" />
          <p className="mt-1 text-xs font-semibold tracking-wide">İhtiyacın Kapında!</p>
          <Link href="/kvkk" className="mt-2 inline-block text-xs font-semibold underline underline-offset-2 hover:text-brand">KVKK Aydınlatma Metni</Link>
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
