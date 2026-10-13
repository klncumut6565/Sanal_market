"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteProductById } from "@/app/admin/actions";

/** "Sil" → onay kutusu ("Ürün silinsin mi?") → evet ise siler. */
export function DeleteProductButton({ id, name, redirectTo, label = "Sil" }: { id: string; name: string; redirectTo?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && !pending && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, pending]);

  const confirm = () =>
    start(async () => {
      const r = await deleteProductById(id);
      if (!r.ok) {
        setErr(r.error ?? "Silinemedi.");
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErr(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 font-bold text-muted hover:text-red-600"
      >
        <Trash2 size={14} /> {label}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={18} />
              </span>
              <div>
                <p className="font-black">Ürün silinsin mi?</p>
                <p className="mt-1 text-sm text-muted">
                  <b className="text-ink">{name}</b> kalıcı olarak silinecek. Bu işlem geri alınamaz. (Geçmiş siparişlerdeki kayıtlar korunur.)
                </p>
              </div>
            </div>
            {err && <p className="rounded-xl bg-red-50 p-2 text-sm font-semibold text-red-700">{err}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-gray-100 py-2.5 font-bold">
                Vazgeç
              </button>
              <button type="button" disabled={pending} onClick={confirm} className="flex-1 rounded-xl bg-red-600 py-2.5 font-bold text-white disabled:opacity-60">
                {pending ? "Siliniyor…" : "Evet, sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
