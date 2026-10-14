"use client";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { ChevronRight } from "lucide-react";
import { ReorderButton } from "@/components/shop/ReorderButton";

type Saved = { id: string; t: string; no: number };
const KEY = "sanal-market-siparisler";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

export function DeviceOrders() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const list = useMemo<Saved[]>(() => {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, [raw]);
  if (list.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 font-extrabold">Bu cihazdan verilen siparişler</h2>
      <ul className="space-y-2">
        {list.map((o) => (
          <li key={o.id} className="rounded-2xl bg-white p-4 ring-1 ring-line hover:ring-brand">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/siparis/${o.id}?t=${o.t}`} className="flex-1 font-bold">
                Sipariş #{o.no}
              </Link>
              <ReorderButton orderId={o.id} token={o.t} compact />
              <Link href={`/siparis/${o.id}?t=${o.t}`} aria-label="Siparişi aç">
                <ChevronRight size={18} />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
