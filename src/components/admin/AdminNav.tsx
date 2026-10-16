"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bike, ChartNoAxesCombined, LayoutDashboard, MapPin, Package, ReceiptText, ScanBarcode, Settings, ShieldCheck, ShoppingBasket, Tags, Users } from "lucide-react";

const items = [
  { href: "/admin", label: "Genel bakış", icon: LayoutDashboard },
  { href: "/admin/satis", label: "Satış ekranı", icon: ShoppingBasket },
  { href: "/admin/siparisler", label: "Siparişler", icon: ReceiptText },
  { href: "/admin/rapor", label: "Kâr raporu", icon: ChartNoAxesCombined },
  { href: "/admin/kuryeler", label: "Kuryeler", icon: Bike },
  { href: "/admin/musteriler", label: "Müşteriler", icon: Users },
  { href: "/admin/urunler", label: "Ürünler & stok", icon: Package },
  { href: "/admin/barkod", label: "Barkodla fiyat", icon: ScanBarcode },
  { href: "/admin/kategoriler", label: "Kategoriler", icon: Tags },
  { href: "/admin/bolgeler", label: "Teslimat bölgeleri", icon: MapPin },
  { href: "/admin/ayarlar", label: "Ayarlar", icon: Settings },
  { href: "/admin/yoneticiler", label: "Yöneticiler", icon: ShieldCheck },
];

/** Onay bekleyen ("Alındı" aşamasındaki) sipariş sayısı — 10 sn'de bir yenilenir. */
function usePendingCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const sb = createClient();
    let alive = true;
    const check = async () => {
      const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "alindi");
      if (alive && count != null) setN(count);
    };
    check();
    const t = setInterval(check, 10_000);
    const vis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", vis);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return n;
}

export function AdminNav() {
  const path = usePathname();
  const pending = usePendingCount();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        const alarm = href === "/admin/siparisler" && pending > 0;
        return (
          <Link
            key={href}
            href={alarm ? "/admin/siparisler?durum=acik" : href}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold lg:px-2.5 lg:py-2 lg:text-[13px] ${
              alarm ? "bekleyen-yanip-son" : active ? "bg-brand-soft text-brand" : "hover:bg-bg"
            }`}
          >
            <Icon size={18} /> {label}
            {alarm && (
              <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-black text-brand ring-1 ring-brand/30" aria-label={`${pending} bekleyen sipariş`}>
                {pending} yeni
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
