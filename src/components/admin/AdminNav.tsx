"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MapPin, Package, ReceiptText, ScanBarcode, Settings, Tags } from "lucide-react";

const items = [
  { href: "/admin", label: "Genel bakış", icon: LayoutDashboard },
  { href: "/admin/siparisler", label: "Siparişler", icon: ReceiptText },
  { href: "/admin/urunler", label: "Ürünler & stok", icon: Package },
  { href: "/admin/barkod", label: "Barkodla fiyat", icon: ScanBarcode },
  { href: "/admin/kategoriler", label: "Kategoriler", icon: Tags },
  { href: "/admin/bolgeler", label: "Teslimat bölgeleri", icon: MapPin },
  { href: "/admin/ayarlar", label: "Ayarlar", icon: Settings },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? "bg-brand-soft text-brand" : "hover:bg-bg"}`}
          >
            <Icon size={18} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
