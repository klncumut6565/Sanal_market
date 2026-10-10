"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div className="max-w-sm">
        <p className="text-6xl">😕</p>
        <h1 className="mt-3 text-2xl font-black">Bir şeyler ters gitti</h1>
        <p className="mt-2 text-muted">Sayfa yüklenirken bir hata oluştu. Lütfen tekrar dene.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="btn-primary">Tekrar dene</button>
          <Link href="/" className="btn-ghost">Ana sayfa</Link>
        </div>
        {error.digest && <p className="mt-6 text-xs text-muted">Hata kodu: {error.digest}</p>}
      </div>
    </div>
  );
}
