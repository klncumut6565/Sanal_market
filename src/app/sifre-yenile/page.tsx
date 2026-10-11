import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata = { title: "Yeni şifre belirle" };

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mx-auto mb-4 block w-56">
          <Image src="/logo.png" alt="Sanal Market — İhtiyacın Kapında!" width={900} height={832} priority className="h-auto w-full" />
        </Link>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
          <Body searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  await connection();
  const { hata } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user)
    return (
      <div className="space-y-3 rounded-2xl bg-white p-5 text-center ring-1 ring-line">
        <h1 className="text-lg font-extrabold">Bağlantı geçersiz</h1>
        <p className="text-sm text-muted">
          {hata ? "Şifre yenileme bağlantısının süresi dolmuş veya daha önce kullanılmış." : "Bu sayfa e-postadaki şifre yenileme bağlantısıyla açılır."} Yeni bir
          bağlantı isteyebilirsin.
        </p>
        <Link href="/giris" className="btn-primary w-full">
          Yeniden bağlantı iste
        </Link>
      </div>
    );

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
      <h1 className="text-lg font-extrabold">Yeni şifre belirle</h1>
      <p className="mb-3 mt-1 text-sm text-muted">{data.user.email} hesabı için yeni şifreni yaz.</p>
      <NewPasswordForm />
    </div>
  );
}
