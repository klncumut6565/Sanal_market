import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sanal Market", template: "%s · Sanal Market" },
  description: "Market alışverişin kapında. Taze ürünler, hızlı teslimat, kapıda ödeme.",
};

export const viewport: Viewport = {
  themeColor: "#ea004b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
