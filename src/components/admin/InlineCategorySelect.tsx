"use client";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { quickUpdateProduct } from "@/app/admin/actions";
import { CategoryOptionList } from "./CategoryOptionList";

type Cat = { id: string; name: string; sort_order: number; parent_id?: string | null };

/** Ürün listesinde kategoriyi doğrudan seç → anında kaydeder. */
export function InlineCategorySelect({ id, value, categories }: { id: string; value: string | null; categories: Cat[] }) {
  const [cur, setCur] = useState(value ?? "");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex min-w-0 items-center gap-1">
      <select
        value={cur}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          setCur(v);
          setDone(false);
          const fd = new FormData();
          fd.set("id", id);
          fd.set("category_id", v);
          start(async () => {
            await quickUpdateProduct(fd);
            setDone(true);
          });
        }}
        className={`w-full min-w-0 max-w-40 truncate rounded-lg border px-1.5 py-1.5 text-[13px] ${cur ? "border-line" : "border-dashed border-warn text-muted"}`}
      >
        <option value="">— Kategori seç —</option>
        <CategoryOptionList categories={categories} />
      </select>
      {pending ? <Loader2 size={14} className="animate-spin text-muted" /> : done ? <Check size={14} className="text-emerald-600" /> : null}
    </div>
  );
}
