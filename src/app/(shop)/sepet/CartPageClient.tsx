"use client";
import Link from "next/link";
import { CartLines, EmptyCart, FreeDeliveryBar, Totals, useCartSummary } from "@/components/shop/CartContents";
import { formatTL } from "@/lib/format";
import type { StoreSettings } from "@/lib/types";

export function CartPageClient({ settings }: { settings: StoreSettings }) {
  const s = useCartSummary(settings);
  if (!s.ready) return <div className="h-60 animate-pulse rounded-2xl bg-white" />;
  if (s.count === 0)
    return (
      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <EmptyCart />
        <Link href="/" className="btn-primary mx-auto mt-2 flex w-fit">Alışverişe başla</Link>
      </div>
    );
  const blocked = s.belowMin || s.closed;
  return (
    <div className="space-y-4 pb-44 lg:pb-28">
      <div className="rounded-2xl bg-white px-4 ring-1 ring-line"><CartLines /></div>
      <FreeDeliveryBar subtotal={s.subtotal} threshold={settings.free_delivery_threshold} />
      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <Totals subtotal={s.subtotal} delivery={s.delivery} savings={s.savings} total={s.total} />
      </div>
      <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] lg:bottom-0 z-30 border-t border-line bg-white p-3">
        <div className="mx-auto max-w-2xl">
          {s.belowMin && (
            <p className="mb-2 text-center text-xs font-semibold text-muted">
              Minimum sipariş tutarı {formatTL(settings.min_order_amount)} — {formatTL(settings.min_order_amount - s.subtotal)} daha ekle
            </p>
          )}
          <Link href="/odeme" aria-disabled={blocked} className={`btn-primary w-full justify-between ${blocked ? "pointer-events-none opacity-50" : ""}`}>
            <span>{s.hours && !s.hours.open ? `Kapalıyız · ${settings.open_time}'da açılıyor` : "Sepeti onayla"}</span>
            <span>{formatTL(s.total)}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
