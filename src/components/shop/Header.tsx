import Link from "next/link";
import { MapPin, UserRound } from "lucide-react";
import { getStoreSettings } from "@/lib/data/catalog";
import { CartButton } from "./CartButton";
import { SearchBox } from "./SearchBox";

export async function Header() {
  const s = await getStoreSettings();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-3 px-4 py-2.5 lg:flex-nowrap lg:gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-black text-white">S</span>
          <span className="text-lg font-black tracking-tight">
            {s.store_name}
          </span>
        </Link>

        <div className="hidden items-center gap-1.5 rounded-full bg-bg px-3 py-2 text-sm lg:flex">
          <MapPin size={16} className="text-brand" />
          <span className="max-w-56 truncate text-muted">{s.delivery_area_note ?? "Teslimat adresi"}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:order-last lg:ml-0">
          <Link href="/siparislerim" aria-label="Hesabım" className="grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-bg">
            <UserRound size={22} />
          </Link>
          <CartButton />
        </div>

        <div className="order-last w-full lg:order-none lg:flex-1">
          <SearchBox />
        </div>
      </div>
      {!s.is_open && (
        <div className="bg-warn px-4 py-1.5 text-center text-sm font-semibold text-white">
          Market şu an kapalı — siparişler geçici olarak alınmıyor.
        </div>
      )}
    </header>
  );
}
