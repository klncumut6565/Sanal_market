import { requireAdmin } from "@/lib/data/auth";
import { QuickBarcode } from "@/components/admin/QuickBarcode";

export const metadata = { title: "Barkodla fiyat güncelle" };

export default async function BarcodePage() {
  await requireAdmin();
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-black">Barkodla fiyat güncelle</h1>
        <p className="text-sm text-muted">Ürünün barkodunu okut, fiyatı ve stoğu değiştir, kaydet, sıradakine geç.</p>
      </div>
      <QuickBarcode />
    </div>
  );
}
