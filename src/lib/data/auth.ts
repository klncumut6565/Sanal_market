import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";

export type SessionUser = { id: string; email: string | null; role: "customer" | "admin"; full_name: string | null; phone: string | null };

/**
 * Oturumdaki kullanıcı. `cache` ile aynı istek içinde (layout + sayfa + aksiyon) yalnızca BİR KEZ çalışır.
 * Kimlik `getClaims()` ile doğrulanır: proje asimetrik (ES256) imza anahtarı kullandığı için JWT imzası
 * sunucuda yerel olarak (önbellekli JWKS ile) kontrol edilir — Supabase Auth'a ağ isteği atılmaz.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  await connection();
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const { data: profile } = await supabase.from("profiles").select("role, full_name, phone").eq("id", claims.sub).maybeSingle();
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    role: profile?.role === "admin" ? "admin" : "customer",
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
  };
});

/** Sunucu tarafı yönetici kontrolü — her admin sayfası ve aksiyonunda çağrılır (istek başına tek sorgu). */
export const requireAdmin = cache(async () => {
  const user = await getSessionUser();
  if (!user) redirect("/giris?next=/admin");
  if (user.role !== "admin") redirect("/?yetki=yok");
  const supabase = await createClient();
  return { user, supabase };
});
