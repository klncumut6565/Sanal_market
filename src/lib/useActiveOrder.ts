"use client";
// Devam eden (alındı / hazırlanıyor / yolda) son siparişi bulur: üyede hesabından,
// misafirde bu cihazda kayıtlı siparişlerden. Kurye takip butonu için.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/lib/types";

export type ActiveOrder = { id: string; no: number; status: OrderStatus; href: string };
const OPEN = ["alindi", "hazirlaniyor", "yolda"];
const SAVED_KEY = "sanal-market-siparisler";

async function find(): Promise<ActiveOrder | null> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getSession();
  if (auth.session) {
    const { data } = await sb
      .from("orders")
      .select("id,order_no,status")
      .eq("user_id", auth.session.user.id)
      .in("status", OPEN)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return { id: data.id, no: data.order_no, status: data.status, href: `/siparis/${data.id}` };
  }
  let saved: { id: string; t: string; no: number }[] = [];
  try {
    saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
  } catch {}
  for (const s of saved.slice(0, 5)) {
    const { data } = await sb.rpc("get_order_public", { p_order_id: s.id, p_token: s.t });
    const st = (data as { order?: { status?: OrderStatus } } | null)?.order?.status;
    if (st && OPEN.includes(st)) return { id: s.id, no: s.no, status: st, href: `/siparis/${s.id}?t=${s.t}` };
  }
  return null;
}

export function useActiveOrder() {
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      find()
        .then((o) => alive && setOrder(o))
        .catch(() => {});
    check();
    const t = setInterval(check, 45_000);
    const vis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("sesli-asistan:siparis-tamamlandi", check);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("sesli-asistan:siparis-tamamlandi", check);
    };
  }, []);
  return order;
}
