"use client";
// Mobilde altta sabit menü: Anasayfa · Kurye takip · Favorilerim · Sepetim · Hesabım
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, Heart, Home, ShoppingCart, User } from "lucide-react";
import { useCart, useCartHydrated } from "@/store/cart";
import { useFavorites } from "@/store/favorites";
import { useActiveOrder } from "@/lib/useActiveOrder";
import { STATUS_LABEL } from "@/lib/format";

export const BOTTOM_NAV_HIDDEN = ["/odeme"];

export function BottomNav() {
  const path = usePathname();
  const ready = useCartHydrated();
  const cartCount = useCart((s) => s.lines.length);
  const favCount = useFavorites().length;
  const active = useActiveOrder();
  if (BOTTOM_NAV_HIDDEN.some((p) => path.startsWith(p))) return null;

  const item = (on: boolean) => `relative flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold ${on ? "text-brand" : "text-ink/75"}`;
  const badge = (n: number, tone = "bg-brand") =>
    n > 0 && <span className={`absolute -top-1.5 left-1/2 ml-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-black text-white ${tone}`}>{n}</span>;

  return (
    <nav
      aria-label="Alt menü"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(60px+env(safe-area-inset-bottom))] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <Link href="/" className={item(path === "/")}>
        <Home size={22} className={path === "/" ? "fill-brand/20" : ""} />
        Anasayfa
      </Link>

      {active ? (
        <Link href={active.href} className={item(path.startsWith("/siparis/"))} aria-label={`Kurye takip: sipariş #${active.no} ${STATUS_LABEL[active.status]}`}>
          <span className="relative">
            <Bike size={22} className="text-brand" />
            <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500" />
            <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="max-w-[72px] truncate">{active.status === "yolda" ? "Kurye yolda" : "Kurye takip"}</span>
        </Link>
      ) : (
        <span aria-disabled className={`${item(false)} cursor-not-allowed opacity-40`} title="Aktif siparişin olduğunda kuryeni buradan takip edebilirsin">
          <Bike size={22} />
          Kurye takip
        </span>
      )}

      <Link href="/favorilerim" className={item(path.startsWith("/favorilerim"))}>
        <span className="relative">
          <Heart size={22} className={path.startsWith("/favorilerim") ? "fill-brand/20" : ""} />
        </span>
        {badge(favCount, "bg-ink")}
        Favorilerim
      </Link>

      <Link href="/sepet" className={item(path.startsWith("/sepet"))}>
        <ShoppingCart size={22} />
        {ready && badge(cartCount)}
        Sepetim
      </Link>

      <Link href="/siparislerim" className={item(path.startsWith("/siparislerim") || path.startsWith("/giris"))}>
        <User size={22} />
        Hesabım
      </Link>
    </nav>
  );
}
