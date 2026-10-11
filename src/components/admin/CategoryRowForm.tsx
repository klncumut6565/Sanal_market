"use client";
import { useActionState, useState } from "react";
import { CATEGORY_EMOJIS } from "@/lib/categoryEmoji";
import { deleteCategory, saveCategory, type ActionState } from "@/app/admin/actions";
import type { Category } from "@/lib/types";

export function CategoryRowForm({ category, productCount }: { category?: Category; productCount?: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCategory, {});
  const [emoji, setEmoji] = useState(category?.emoji ?? "");
  const [pick, setPick] = useState(false);
  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-2" key={category ? undefined : state.ok}>
        {category && <input type="hidden" name="id" value={category.id} />}
        <input type="hidden" name="emoji" value={emoji} />
        <button
          type="button"
          onClick={() => setPick((p) => !p)}
          title="Simge seç"
          className="input grid w-16 place-items-center text-2xl"
          aria-label="Simge seç"
        >
          {emoji || <span className="text-xs text-muted">simge</span>}
        </button>
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
        {pick && (
          <div className="flex w-full flex-wrap gap-1 rounded-xl bg-bg p-2 ring-1 ring-line">
            {CATEGORY_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setEmoji(e);
                  setPick(false);
                }}
                className={`grid h-10 w-10 place-items-center rounded-lg text-xl hover:bg-white ${emoji === e ? "bg-white ring-2 ring-brand" : ""}`}
              >
                {e}
              </button>
            ))}
            <button type="button" onClick={() => { setEmoji(""); setPick(false); }} className="h-10 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-white">
              Otomatik
            </button>
          </div>
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
