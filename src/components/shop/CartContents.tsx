"use client";
import Link from "next/link";
import { Minus, Plus, ShoppingBasket, Trash2, Truck } from "lucide-react";
import { useCart, useCartHydrated, cartTotals, lineUnit } from "@/store/cart";
import { formatTL } from "@/lib/format";
import type { StoreSettings } from "@/lib/types";
import { ProductImage } from "./ProductImage";
import { useStoreHours } from "./useStoreHours";

type Props = { settings: Pick<StoreSettings, "delivery_fee" | "free_delivery_threshold" | "min_order_amount" | "is_open" | "open_time" | "close_time"> };

export function useCartSummary(settings: Props["settings"]) {
  const ready = useCartHydrated();
  const lines = useCart((s) => s.lines);
  const visible = ready ? lines : [];
  const t = cartTotals(visible, settings.delivery_fee, settings.free_delivery_threshold);
  const belowMin = t.subtotal < settings.min_order_amount;
  const hours = useStoreHours(settings);
  const closed = !hours || !hours.open;
  return { ready, lines: visible, ...t, belowMin, closed, hours };
}

export function CartLines() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  return (
    <ul className="divide-y divide-line">
      {lines.map((l) => (
        <li key={l.id} className="flex items-center gap-3 py-3">
          <ProductImage src={l.image_url} emoji={l.emoji} alt={l.name} size="sm" />
          <div className="min-w-0 flex-1">
            <Link href={`/urun/${l.slug}`} className="line-clamp-1 text-sm font-semibold">
              {l.name}
            </Link>
            <p className="text-xs text-muted">{l.unit_label}</p>
            <p className="text-sm font-bold text-brand">{formatTL(lineUnit(l) * l.qty)}</p>
          </div>
          <div className="flex h-8 items-center rounded-full ring-1 ring-line">
            <button onClick={() => setQty(l.id, l.qty - 1)} aria-label="Azalt" className="grid h-8 w-8 place-items-center text-brand">
              {l.qty === 1 ? <Trash2 size={15} /> : <Minus size={15} strokeWidth={2.5} />}
            </button>
            <span className="w-6 text-center text-sm font-bold tabular-nums">{l.qty}</span>
            <button
              onClick={() => setQty(l.id, l.qty + 1)}
              disabled={l.qty >= l.max}
              aria-label="Artır"
              className="grid h-8 w-8 place-items-center text-brand disabled:opacity-30"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FreeDeliveryBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  const left = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, (subtotal / threshold) * 100);
  return (
    <div className="rounded-xl bg-brand-soft p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <Truck size={16} className="text-brand" />
        {left > 0 ? (
          <span>
            <b className="text-brand">{formatTL(left)}</b> daha ekle, teslimat ücretsiz!
          </span>
        ) : (
          <span className="text-ok">Teslimat ücretsiz 🎉</span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Totals({ subtotal, delivery, savings, total }: { subtotal: number; delivery: number; savings: number; total: number }) {
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between"><dt className="text-muted">Ara toplam</dt><dd className="font-semibold">{formatTL(subtotal)}</dd></div>
      {savings > 0 && (
        <div className="flex justify-between text-ok"><dt>İndirim kazancın</dt><dd className="font-semibold">-{formatTL(savings)}</dd></div>
      )}
      <div className="flex justify-between">
        <dt className="text-muted">Teslimat ücreti</dt>
        <dd className="font-semibold">{delivery === 0 ? <span className="text-ok">Ücretsiz</span> : formatTL(delivery)}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-2 text-base"><dt className="font-bold">Toplam</dt><dd className="font-extrabold">{formatTL(total)}</dd></div>
    </dl>
  );
}

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
        <ShoppingBasket size={30} />
      </div>
      <p className="font-bold">Sepetin boş</p>
      <p className="mt-1 text-sm text-muted">Eklediğin ürünler burada görünecek.</p>
    </div>
  );
}

/** Masaüstünde sağda sabit duran sepet paneli (Yemeksepeti düzeni). */
export function CartPanel({ settings }: Props) {
  const s = useCartSummary(settings);
  const clear = useCart((st) => st.clear);
  return (
    <aside className="sticky top-[84px] flex max-h-[calc(100dvh-100px)] flex-col rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Sepetim</h2>
        {s.count > 0 && (
          <button onClick={clear} className="text-xs font-semibold text-muted hover:text-brand">
            Temizle
          </button>
        )}
      </div>
      {s.count === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <div className="-mx-1 flex-1 overflow-y-auto px-1">
            <CartLines />
          </div>
          <div className="space-y-3 border-t border-line pt-3">
            <FreeDeliveryBar subtotal={s.subtotal} threshold={settings.free_delivery_threshold} />
            <Totals subtotal={s.subtotal} delivery={s.delivery} savings={s.savings} total={s.total} />
            {s.belowMin ? (
              <p className="rounded-lg bg-bg p-2 text-center text-xs font-semibold text-muted">
                Minimum sipariş tutarı {formatTL(settings.min_order_amount)}
              </p>
            ) : null}
            <Link
              href="/odeme"
              aria-disabled={s.belowMin || s.closed}
              className={`btn-primary w-full ${s.belowMin || s.closed ? "pointer-events-none opacity-50" : ""}`}
            >
              {s.hours && !s.hours.open ? `Şu an kapalıyız · ${settings.open_time}'da açılıyor` : "Sepeti onayla"}
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}

/** Mobilde altta sabit "Sepete git" çubuğu. */
export function MobileCartBar({ settings }: Props) {
  const s = useCartSummary(settings);
  if (s.count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
      <Link href="/sepet" className="btn-primary w-full justify-between">
        <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-white/20 px-1.5 text-sm">{s.count}</span>
        <span>Sepete git</span>
        <span>{formatTL(s.total)}</span>
      </Link>
    </div>
  );
}
