import Link from "next/link";
import { Clock, MapPin, UserRound } from "lucide-react";
import { Brand } from "@/components/Brand";
import { StoreStatusBar } from "./StoreStatusBar";
import { getStoreSettings } from "@/lib/data/catalog";
import { CartButton } from "./CartButton";
import { SearchBox } from "./SearchBox";

export async function Header() {
  const s = await getStoreSettings();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-2.5 lg:flex-nowrap lg:gap-6">
        <Link href="/" aria-label={s.store_name}>
          <Brand />
        </Link>

        <div className="hidden items-center gap-1.5 rounded-full bg-bg px-3 py-2 text-sm lg:flex">
          <MapPin size={16} className="text-brand" />
          <span className="max-w-56 truncate text-muted">{s.delivery_area_note ?? "Teslimat adresi"}</span>
        </div>
        {s.working_hours && (
          <div className="hidden items-center gap-1.5 rounded-full bg-brand-soft px-3 py-2 text-sm font-bold text-brand xl:flex">
            <Clock size={16} /> {s.working_hours}
          </div>
        )}

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
      <StoreStatusBar settings={s} />
    </header>
  );
}
