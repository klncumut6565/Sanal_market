"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Dup = { id: string; name: string; barcode: string | null; is_active: boolean; match: "barkod" | "ad" };

/** Ürün formunda yazarken: aynı barkod (farklı yazımlar dahil) veya aynı adlı ürün varsa uyarır. */
export function DuplicateHint({ id, barcode, name }: { id?: string; barcode: string; name: string }) {
  const [dups, setDups] = useState<Dup[]>([]);
  useEffect(() => {
    const b = barcode.trim();
    const n = name.trim();
    const t = setTimeout(async () => {
      if (b.length < 4 && n.length < 3) return setDups([]);
      const { data } = await createClient().rpc("find_product_duplicates", { p_id: id ?? null, p_barcode: b || null, p_name: n || null });
      setDups((data ?? []) as Dup[]);
    }, 350);
    return () => clearTimeout(t);
  }, [id, barcode, name]);
  if (dups.length === 0) return null;
  const byBarcode = dups.filter((d) => d.match === "barkod");
  const byName = dups.filter((d) => d.match === "ad");
  return (
    <div className="space-y-1.5 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-300 sm:col-span-2">
      {byBarcode.length > 0 && (
        <p className="flex items-start gap-1.5 font-bold text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Bu barkod zaten kayıtlı:{" "}
            {byBarcode.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ", "}
                <Link href={`/admin/urunler/${d.id}`} className="underline">
                  {d.name}
                </Link>{" "}
                <span className="font-mono text-xs font-normal">({d.barcode})</span>
              </span>
            ))}
            . Aynı barkod ikinci kez kaydedilemez.
          </span>
        </p>
      )}
      {byName.length > 0 && (
        <p className="flex items-start gap-1.5 text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Aynı adla kayıtlı ürün var — aynı ürünü tekrar ekliyor olabilirsin:{" "}
            {byName.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ", "}
                <Link href={`/admin/urunler/${d.id}`} className="font-semibold underline">
                  {d.name}
                </Link>{" "}
                <span className="font-mono text-xs">({d.barcode ?? "barkodsuz"}{d.is_active ? "" : ", pasif"})</span>
              </span>
            ))}
          </span>
        </p>
      )}
    </div>
  );
}
