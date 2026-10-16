import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { AuthForm } from "./AuthForm";

export const metadata = { title: "Giriş yap" };

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; yonetici?: string; kurye?: string }> }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mx-auto mb-4 block w-56">
          <Image src="/logo.png" alt="Çorlu Sanal Market — İhtiyacın Kapında!" width={900} height={916} priority className="h-auto w-full" />
        </Link>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-white" />}>
          <Next searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Next({ searchParams }: { searchParams: Promise<{ next?: string; yonetici?: string; kurye?: string }> }) {
  const { next, yonetici, kurye } = await searchParams;
  const admin = yonetici === "1" || next?.startsWith("/admin") === true;
  const courier = !admin && (kurye === "1" || next?.startsWith("/kurye") === true);
  return (
    <AuthForm
      key={admin ? "admin" : courier ? "kurye" : "user"}
      next={admin ? "/admin" : courier ? "/kurye/basvuru" : (next ?? "/")}
      admin={admin}
      courier={courier}
    />
  );
}
