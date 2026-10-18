"use client";
import { createContext, useContext, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, ShoppingCart, Trash2, X } from "lucide-react";
import { deleteProductsByIds, setProductsActive } from "@/app/admin/actions";

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  clear: () => void;
  pageIds: string[];
};
const C = createContext<Ctx | null>(null);
const useSel = () => {
  const c = useContext(C);
  if (!c) throw new Error("BulkSelectProvider yok");
  return c;
};

/**
 * Ürünler & stok toplu seçim. pageIds: bu sayfadaki ürünler; allIds: filtreyle bulunan tüm ürünler
 * (yalnızca filtre/arama varken verilir — "tüm ürünleri sil" kazası olmasın diye).
 */
export function BulkSelectProvider({
  pageIds,
  allIds,
  names,
  children,
}: {
  pageIds: string[];
  allIds: string[] | null;
  names: Record<string, string>;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const value = useMemo<Ctx>(
    () => ({
      selected,
      pageIds,
      toggle: (id) =>
        setSelected((s) => {
          const n = new Set(s);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        }),
      setMany: (ids, on) =>
        setSelected((s) => {
          const n = new Set(s);
          for (const id of ids) {
            if (on) n.add(id);
            else n.delete(id);
          }
          return n;
        }),
      clear: () => setSelected(new Set()),
    }),
    [selected, pageIds],
  );
  return (
    <C.Provider value={value}>
      {children}
      <BulkBar allIds={allIds} names={names} />
    </C.Provider>
  );
}

export function SelectPageCheckbox() {
  const { selected, pageIds, setMany } = useSel();
  const n = pageIds.filter((id) => selected.has(id)).length;
  const all = pageIds.length > 0 && n === pageIds.length;
  return (
    <input
      type="checkbox"
      aria-label="Bu sayfadakilerin tümünü seç"
      title="Bu sayfadakilerin tümünü seç"
      className="h-4 w-4 accent-brand"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = n > 0 && !all;
      }}
      onChange={() => setMany(pageIds, !all)}
    />
  );
}

export function RowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useSel();
  return <input type="checkbox" aria-label="Seç" className="h-4 w-4 accent-brand" checked={selected.has(id)} onChange={() => toggle(id)} />;
}

function BulkBar({ allIds, names }: { allIds: string[] | null; names: Record<string, string> }) {
  const { selected, pageIds, setMany, clear } = useSel();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const count = selected.size;
  const pageAll = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const canAll = !!allIds && allIds.length > pageIds.length && pageAll && count < allIds.length;

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && !pending && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, pending]);

  if (count === 0) return null;
  const sample = [...selected].map((id) => names[id]).filter(Boolean).slice(0, 5);

  const confirm = () =>
    start(async () => {
      setErr(null);
      const r = await deleteProductsByIds([...selected]);
      if (!r.ok) {
        setErr(r.error ?? "Silinemedi.");
        router.refresh();
        return;
      }
      setOpen(false);
      clear();
      router.refresh();
    });

  const setActive = (active: boolean) =>
    start(async () => {
      setErr(null);
      const r = await setProductsActive([...selected], active);
      if (!r.ok) setErr(r.error ?? "Güncellenemedi.");
      else clear();
      router.refresh();
    });

  return (
    <>
      <div className="sticky bottom-3 z-40 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm text-white shadow-2xl">
        <b>{count} ürün seçili</b>
        {canAll && (
          <button type="button" onClick={() => setMany(allIds!, true)} className="rounded-lg px-2 py-1 font-semibold underline hover:bg-white/10">
            Bulunan {allIds!.length} ürünün tümünü seç
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => setActive(true)} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 font-bold disabled:opacity-60">
          <ShoppingCart size={15} /> Satışa aç
        </button>
        <button type="button" disabled={pending} onClick={() => setActive(false)} className="flex items-center gap-1.5 rounded-xl bg-zinc-600 px-3 py-1.5 font-bold disabled:opacity-60">
          <EyeOff size={15} /> Pasif yap
        </button>
        <button type="button" onClick={() => (setErr(null), setOpen(true))} className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 font-bold">
          <Trash2 size={15} /> Seçili ürünleri sil
        </button>
        <button type="button" onClick={clear} className="flex items-center gap-1 rounded-xl px-2 py-1.5 font-semibold hover:bg-white/10">
          <X size={15} /> Seçimi kaldır
        </button>
        {pending && !open && <span className="text-xs text-white/70">Güncelleniyor…</span>}
        {err && !open && <span className="w-full text-xs font-semibold text-red-300">{err}</span>}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={18} />
              </span>
              <div>
                <p className="font-black">{count} ürün silinsin mi?</p>
                <p className="mt-1 text-sm text-muted">Seçili ürünler kalıcı olarak silinecek. Bu işlem geri alınamaz. (Geçmiş siparişlerdeki kayıtlar korunur.)</p>
                {sample.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-sm">
                    {sample.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                    {count > sample.length && <li className="list-none text-muted">… ve {count - sample.length} ürün daha</li>}
                  </ul>
                )}
              </div>
            </div>
            {err && <p className="rounded-xl bg-red-50 p-2 text-sm font-semibold text-red-700">{err}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-gray-100 py-2.5 font-bold">
                Vazgeç
              </button>
              <button type="button" disabled={pending} onClick={confirm} className="flex-1 rounded-xl bg-red-600 py-2.5 font-bold text-white disabled:opacity-60">
                {pending ? "Siliniyor…" : `Evet, ${count} ürünü sil`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
