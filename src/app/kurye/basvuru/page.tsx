import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Bike, Clock, XCircle } from "lucide-react";
import { getSessionUser } from "@/lib/data/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { ApplyForm } from "./ApplyForm";

export const metadata = { title: "Kurye başvurusu", robots: { index: false, follow: false } };

export default function CourierApplyPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-md space-y-4 bg-bg p-4 pt-8">
      <h1 className="flex items-center gap-2 text-2xl font-black">
        <Bike className="text-sky-600" /> Kurye başvurusu
      </h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white" />}>
        <Body />
      </Suspense>
    </div>
  );
}

async function Body() {
  const user = await getSessionUser();
  if (!user) redirect("/giris?kurye=1");
  if (user.isCourier) redirect("/kurye");
  const supabase = await createClient();
  const { data: app } = await supabase.from("courier_applications").select("status, requested_at, decided_at, vehicle, plate").eq("user_id", user.id).maybeSingle();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {user.full_name ?? user.email} olarak giriş yaptın. Kurye paneli, yönetici başvurunu onayladıktan sonra açılır.
      </p>
      {app?.status === "bekliyor" && (
        <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <Clock className="shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-bold text-amber-900">Başvurun onay bekliyor</p>
            <p className="text-amber-900/80">Gönderildi: {formatDate(app.requested_at)}. Onaylanınca bu sayfayı yenilemen yeterli.</p>
          </div>
        </div>
      )}
      {app?.status === "reddedildi" && (
        <div className="flex gap-3 rounded-2xl bg-brand-soft p-4">
          <XCircle className="shrink-0 text-brand" />
          <p className="text-sm font-semibold text-brand">Başvurun onaylanmadı ya da kurye yetkin kaldırıldı. Yöneticiyle görüşebilirsin.</p>
        </div>
      )}
      <ApplyForm vehicle={app?.vehicle ?? "motosiklet"} plate={app?.plate ?? ""} again={!!app} />
      <Link href="/" className="block text-center text-sm font-semibold text-muted">
        ← Mağazaya dön
      </Link>
    </div>
  );
}
