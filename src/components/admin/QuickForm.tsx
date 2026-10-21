"use client";
// Ürün listesindeki satır içi hızlı kaydetme formu: sonucu bekler, hata olursa satırda kırmızı uyarı gösterir.
import { useActionState } from "react";
import { quickUpdateProductState, type QuickUpdateResult } from "@/app/admin/actions";

export function QuickForm({ children, className }: { children: React.ReactNode; className?: string }) {
  const [state, action, pending] = useActionState<QuickUpdateResult | null, FormData>(quickUpdateProductState, null);
  return (
    <form action={action} className={className} aria-busy={pending}>
      {children}
      {state && !state.ok && (
        <span role="alert" title={state.error} className="block max-w-[9rem] text-[11px] font-bold leading-tight text-red-600">
          ✕ {state.error}
        </span>
      )}
    </form>
  );
}
