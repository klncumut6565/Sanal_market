"use client";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { quickUpdateProduct } from "@/app/admin/actions";

/** Ürün listesinde kategoriyi doğrudan seç → anında kaydeder. */
export function InlineCategorySelect({ id, value, options }: { id: string; value: string | null; options: { id: string; name: string }[] }) {
  const [cur, setCur] = useState(value ?? "");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1">
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
        className={`w-40 rounded-lg border px-2 py-1.5 text-sm ${cur ? "border-line" : "border-dashed border-warn text-muted"}`}
      >
        <option value="">— Kategori seç —</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {pending ? <Loader2 size={14} className="animate-spin text-muted" /> : done ? <Check size={14} className="text-emerald-600" /> : null}
    </div>
  );
}
