import { getStoreSettings } from "@/lib/data/catalog";
import { CheckoutForm } from "./CheckoutForm";

export const metadata = { title: "Siparişi tamamla" };

export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <h1 className="mb-4 text-2xl font-black">Siparişi tamamla</h1>
      <CheckoutForm settings={settings} />
    </div>
  );
}
