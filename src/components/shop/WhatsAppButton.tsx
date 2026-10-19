"use client";
// Müşteri sayfalarında sol altta sabit WhatsApp düğmesi: dokununca dükkânın WhatsApp hattına mesaj açılır.
// Ürün sayfasındayken mesaja ürün adı ve bağlantısı eklenir. (Sesli sipariş düğmesi sağda, çakışmaz.)
import { usePathname } from "next/navigation";
import { useCart, useCartHydrated } from "@/store/cart";
import { waLink } from "@/lib/whatsapp";

export function WhatsAppButton({ phone, storeName }: { phone: string; storeName: string }) {
  const path = usePathname();
  const ready = useCartHydrated();
  const hasCart = useCart((s) => s.lines.length > 0);
  if (path.startsWith("/odeme")) return null;

  const href = () => {
    if (path.startsWith("/urun/")) {
      const name = document.querySelector("h1")?.textContent?.trim();
      return waLink(phone, `Merhaba, ${name ? `"${name}" ` : "bir ürün "}hakkında bilgi almak istiyorum: ${window.location.href}`);
    }
    return waLink(phone, `Merhaba ${storeName}, `);
  };

  return (
    <a
      href={waLink(phone, `Merhaba ${storeName}, `)}
      onClick={(e) => {
        e.preventDefault();
        window.open(href(), "_blank", "noopener");
      }}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp'tan bize yazın"
      title="WhatsApp'tan bize yazın"
      className={`group fixed left-4 z-30 flex items-center gap-2 rounded-full bg-[#25D366] p-3 text-sm font-bold text-white shadow-xl ring-4 ring-white transition hover:scale-105 lg:bottom-6 lg:pr-4 ${
        ready && hasCart ? "bottom-[calc(136px+env(safe-area-inset-bottom))]" : "bottom-[calc(72px+env(safe-area-inset-bottom))]"
      }`}
    >
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden fill="currentColor">
        <path d="M16.04 3C9.43 3 4.06 8.36 4.06 14.97c0 2.11.55 4.17 1.6 5.99L4 29l8.24-1.62a11.95 11.95 0 0 0 3.8.62h.01c6.6 0 11.97-5.36 11.97-11.97C28.02 8.36 22.65 3 16.04 3Zm0 21.9h-.01c-1.24 0-2.46-.24-3.6-.7l-.26-.1-4.9.96.98-4.77-.17-.27a9.92 9.92 0 0 1-1.52-5.05c0-5.49 4.47-9.96 9.97-9.96 5.49 0 9.96 4.47 9.96 9.97 0 5.49-4.47 9.92-9.95 9.92Zm5.46-7.45c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
      </svg>
      <span className="hidden lg:inline">WhatsApp</span>
    </a>
  );
}
