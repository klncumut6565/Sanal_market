import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sanal Market", template: "%s · Sanal Market" },
  description: "İhtiyacın kapında! Motokurye servisi, kapıda nakit veya kartla ödeme. Her gün 10:00 - 01:00.",
};

export const viewport: Viewport = {
  themeColor: "#f26a12",
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
