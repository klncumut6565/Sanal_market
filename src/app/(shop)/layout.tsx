import { Suspense } from "react";
import { Header } from "@/components/shop/Header";
import { getStoreSettings } from "@/lib/data/catalog";
import { Brand } from "@/components/Brand";
import { VoiceAssistant } from "@/components/shop/VoiceAssistant";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <Suspense fallback={null}>
        <Voice />
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
    <footer className="mt-10 border-t border-line bg-white pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-[1320px] gap-2 px-4 py-6 text-sm text-muted sm:grid-cols-3">
        <div>
          <Brand size="sm" />
          <p className="mt-1 text-xs font-semibold tracking-wide">İhtiyacın Kapında!</p>
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
