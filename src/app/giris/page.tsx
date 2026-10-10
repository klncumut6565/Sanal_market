import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { AuthForm } from "./AuthForm";

export const metadata = { title: "Giriş yap" };

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mx-auto mb-4 block w-56">
          <Image src="/logo.png" alt="Sanal Market — İhtiyacın Kapında!" width={900} height={832} priority className="h-auto w-full" />
        </Link>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-white" />}>
          <Next searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Next({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm next={next ?? "/siparislerim"} />;
}
