import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "./AuthForm";

export const metadata = { title: "Giriş yap" };

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-xl font-black text-white">S</span>
          <span className="text-xl font-black">Sanal Market</span>
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
