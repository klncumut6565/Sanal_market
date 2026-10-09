import { Header } from "@/components/shop/Header";
import { getStoreSettings } from "@/lib/data/catalog";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}

async function Footer() {
  const s = await getStoreSettings();
  return (
    <footer className="mt-10 border-t border-line bg-white pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-[1320px] gap-2 px-4 py-6 text-sm text-muted sm:grid-cols-3">
        <p className="font-bold text-ink">{s.store_name}</p>
        <p>{s.address ?? "Adres bilgisi ayarlardan girilecek"}</p>
        <p>{s.phone ? `Tel: ${s.phone}` : "Kapıda nakit · Kapıda kartla ödeme"}</p>
      </div>
    </footer>
  );
}
