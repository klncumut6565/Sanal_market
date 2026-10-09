import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";

export type SessionUser = { id: string; email: string | null; role: "customer" | "admin"; full_name: string | null; phone: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  await connection();
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, phone")
    .eq("id", data.user.id)
    .single();
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: profile?.role === "admin" ? "admin" : "customer",
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
  };
}

/** Sunucu tarafı yönetici kontrolü — her admin sayfası ve aksiyonunda çağrılır. */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/giris?next=/admin");
  if (user.role !== "admin") redirect("/?yetki=yok");
  const supabase = await createClient();
  return { user, supabase };
}
