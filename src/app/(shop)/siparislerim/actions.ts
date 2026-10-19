"use server";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Müşteri, sesli asistanın hatırladığı bir tercihini siler (RLS: yalnızca kendi notu). */
export async function deletePref(fd: FormData) {
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return;
  const sb = await createClient();
  await sb.from("customer_prefs").delete().eq("id", id);
  refresh();
}

export async function deleteAllPrefs() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return;
  await sb.from("customer_prefs").delete().eq("user_id", data.user.id);
  refresh();
}
