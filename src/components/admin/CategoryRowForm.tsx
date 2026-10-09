"use client";
import { useActionState } from "react";
import { deleteCategory, saveCategory, type ActionState } from "@/app/admin/actions";
import type { Category } from "@/lib/types";

export function CategoryRowForm({ category, productCount }: { category?: Category; productCount?: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCategory, {});
  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-2" key={category ? undefined : state.ok}>
        {category && <input type="hidden" name="id" value={category.id} />}
        <input name="emoji" defaultValue={category?.emoji ?? ""} placeholder="🛒" maxLength={4} className="input w-16 text-center" />
        <input name="name" required defaultValue={category?.name} placeholder="Kategori adı" className="input min-w-40 flex-1" />
        <input name="sort_order" type="number" defaultValue={category?.sort_order ?? 0} title="Sıra" className="input w-20" />
        <label className="flex items-center gap-1.5 text-sm font-semibold">
          <input type="checkbox" name="is_active" defaultChecked={category?.is_active ?? true} className="h-4 w-4 accent-brand" /> Aktif
        </label>
        <button disabled={pending} className="btn-primary py-2">{category ? "Kaydet" : "Ekle"}</button>
        {category && (
          <button
            formAction={deleteCategory}
            formNoValidate
            onClick={(e) => {
              if (!confirm(`"${category.name}" silinsin mi? Ürünleri kategorisiz kalır.`)) e.preventDefault();
            }}
            className="px-2 text-sm font-semibold text-muted hover:text-brand"
          >
            Sil
          </button>
        )}
      </form>
      <div className="mt-1 flex gap-3 text-xs">
        {category && <span className="text-muted">{productCount} ürün · /kategori/{category.slug}</span>}
        {state.error && <span className="font-semibold text-brand">{state.error}</span>}
        {state.ok && <span className="font-semibold text-ok">{state.ok}</span>}
      </div>
    </div>
  );
}
