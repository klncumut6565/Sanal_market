import { CartPageClient } from "./CartPageClient";
import { getStoreSettings } from "@/lib/data/catalog";

export const metadata = { title: "Sepetim" };

export default async function CartPage() {
  const settings = await getStoreSettings();
  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="mb-4 text-2xl font-black">Sepetim</h1>
      <CartPageClient settings={settings} />
    </div>
  );
}
