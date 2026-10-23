import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito-sans";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · Sanal Market Çorlu" },
  description: SITE_DESCRIPTION,
  applicationName: "Sanal Market",
  keywords: [
    "Çorlu online market",
    "Çorlu sanal market",
    "Çorlu market siparişi",
    "Çorlu eve market",
    "Çorlu market alışverişi",
    "Tekirdağ online market",
  ],
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Sanal Market",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [{ url: "/logo.png", alt: "Çorlu Sanal Market" }],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["/logo.png"] },
  // Google Search Console doğrulama kodu (Vercel > Environment Variables > GOOGLE_SITE_VERIFICATION)
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  themeColor: "#0e8a6c",
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
