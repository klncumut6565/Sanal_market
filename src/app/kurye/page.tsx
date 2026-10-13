import type { Metadata } from "next";
import { Suspense } from "react";
import { CourierBoard } from "./CourierBoard";

type Props = { searchParams: Promise<{ k?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { k = "" } = await searchParams;
  return {
    title: "Kurye",
    robots: { index: false, follow: false },
    manifest: `/api/manifest/kurye?k=${encodeURIComponent(k)}`,
    appleWebApp: { capable: true, title: "SM Kurye", statusBarStyle: "default" },
    icons: { apple: "/pwa-192.png" },
  };
}

export default function CourierPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="p-6 text-center text-muted">Yükleniyor…</div>}>
      <Board searchParams={searchParams} />
    </Suspense>
  );
}

async function Board({ searchParams }: Props) {
  const { k = "" } = await searchParams;
  return <CourierBoard token={k} />;
}
