"use client";
// E-postadaki bağlantı oturumu adres çubuğunun # kısmında getirir (implicit akış).
// Burada okunup çerezli oturuma çevrilir, sonra sayfa yenilenip şifre formu açılır.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const noop = () => () => {};
function parseHash(raw: string) {
  if (!raw) return null;
  const h = new URLSearchParams(raw.replace(/^#/, ""));
  return {
    access_token: h.get("access_token"),
    refresh_token: h.get("refresh_token"),
    error: h.get("error_description") || h.get("error"),
  };
}

export function RecoveryLink({ expired }: { expired: boolean }) {
  const router = useRouter();
  // Sunucuda # kısmı yoktur: ilk çizim sunucuyla aynı, sonra tarayıcı değeri okunur
  const raw = useSyncExternalStore(noop, () => window.location.hash, () => "");
  const hash = useMemo(() => parseHash(raw), [raw]);
  const hasTokens = !!hash?.access_token && !!hash?.refresh_token;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasTokens || !hash) return;
    const sb = createClient();
    sb.auth
      .setSession({ access_token: hash.access_token!, refresh_token: hash.refresh_token! })
      .then(({ error }) => {
        history.replaceState(null, "", window.location.pathname); // jetonları adres çubuğundan sil
        if (error) setFailed(true);
        else router.refresh();
      });
  }, [hasTokens, hash, router]);

  if (hasTokens && !failed)
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-6 text-sm font-semibold ring-1 ring-line">
        <Loader2 size={18} className="animate-spin text-brand" /> Bağlantı doğrulanıyor…
      </div>
    );

  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 text-center ring-1 ring-line">
      <h1 className="text-lg font-extrabold">Bağlantı geçersiz</h1>
      <p className="text-sm text-muted">
        {expired || failed || hash?.error
          ? "Şifre yenileme bağlantısının süresi dolmuş veya daha önce kullanılmış."
          : "Bu sayfa e-postadaki şifre yenileme bağlantısıyla açılır."}{" "}
        Yeni bir bağlantı isteyebilirsin.
      </p>
      <Link href="/giris" className="btn-primary w-full">
        Yeniden bağlantı iste
      </Link>
    </div>
  );
}
