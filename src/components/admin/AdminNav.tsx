"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bike,
  ChartNoAxesCombined,
  LayoutDashboard,
  MapPin,
  Package,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };

/** Menü grupları — geniş ekranda başlıklı bölümler, telefonda tek yatay şerit */
const groups: { title: string; items: Item[] }[] = [
  {
    title: "İşletme",
    items: [
      { href: "/admin", label: "Genel bakış", icon: LayoutDashboard },
      { href: "/admin/satis", label: "Satış ekranı", icon: ShoppingBasket },
      { href: "/admin/siparisler", label: "Siparişler", icon: ReceiptText },
      { href: "/admin/rapor", label: "Kâr raporu", icon: ChartNoAxesCombined },
    ],
  },
  {
    title: "Operasyon",
    items: [
      { href: "/admin/kuryeler", label: "Kuryeler", icon: Bike },
      { href: "/admin/musteriler", label: "Müşteriler", icon: Users },
      { href: "/admin/bolgeler", label: "Teslimat bölgeleri", icon: MapPin },
    ],
  },
  {
    title: "Katalog",
    items: [
      { href: "/admin/urunler", label: "Ürünler & stok", icon: Package },
      { href: "/admin/barkod", label: "Barkodla fiyat", icon: ScanBarcode },
      { href: "/admin/kategoriler", label: "Kategoriler", icon: Tags },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/ayarlar", label: "Ayarlar", icon: Settings },
      { href: "/admin/yoneticiler", label: "Yöneticiler", icon: ShieldCheck },
    ],
  },
];

/** Onay bekleyen ("Alındı" aşamasındaki) sipariş sayısı — 30 sn'de bir yenilenir. */
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
    const t = setInterval(() => document.visibilityState === "visible" && check(), 30_000);
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
    <nav className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-3 lg:block lg:space-y-4 lg:overflow-visible lg:px-3 lg:pb-0">
      {groups.map((g) => (
        <div key={g.title} className="contents lg:block">
          <p className="hidden px-2.5 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted/80 lg:block">{g.title}</p>
          <div className="contents lg:flex lg:flex-col lg:gap-0.5">
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? path === href : path.startsWith(href);
              const alarm = href === "/admin/siparisler" && pending > 0;
              return (
                <Link
                  key={href}
                  href={alarm ? "/admin/siparisler?durum=acik" : href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-semibold transition lg:px-2 lg:py-1.5 lg:text-[13.5px] ${
                    alarm
                      ? "bekleyen-yanip-son"
                      : active
                        ? "bg-gradient-to-r from-brand to-[#11a58a] text-white shadow-md shadow-brand/25"
                        : "bg-white text-ink/80 ring-1 ring-line hover:text-ink lg:bg-transparent lg:ring-0 lg:hover:bg-bg"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${
                      alarm ? "bg-white/25" : active ? "bg-white/20" : "bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white"
                    }`}
                  >
                    <Icon size={17} />
                  </span>
                  {label}
                  {alarm && (
                    <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-black text-brand ring-1 ring-brand/30" aria-label={`${pending} bekleyen sipariş`}>
                      {pending} yeni
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
