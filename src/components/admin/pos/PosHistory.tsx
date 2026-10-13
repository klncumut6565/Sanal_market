"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Printer, RotateCcw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTL } from "@/lib/format";
import { PosReceipt, type ReceiptData } from "./PosReceipt";
import { PAY_LABEL, posError, type PosSaleRow, type PosStore } from "./posTypes";

const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Gün içi kasa satışları: özet (gün sonu), fiş listesi, tekrar yazdır, iptal (stok geri döner). */
export function PosHistory({ store, onClose, onChanged }: { store: PosStore; onClose: () => void; onChanged: () => void }) {
  const sb = useMemo(() => createClient(), []);
  const [day, setDay] = useState(() => dayStr(new Date()));
  const [rows, setRows] = useState<PosSaleRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [printing, setPrinting] = useState<ReceiptData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const start = new Date(`${day}T00:00:00`);
    const end = new Date(start.getTime() + 86_400_000);
    const { data, error } = await sb
      .from("pos_sales")
      .select("id,sale_no,created_at,total,subtotal,discount,payment,cash_amount,card_amount,paid,change_due,cost_total,item_count,voided_at,pos_sale_items(product_name,quantity,unit_price,line_total)")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setRows((data ?? []) as unknown as PosSaleRow[]);
  }, [sb, day]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !voidId && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, voidId]);

  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => {
      window.print();
      setPrinting(null);
    }, 80);
    return () => clearTimeout(t);
  }, [printing]);

  const live = (rows ?? []).filter((r) => !r.voided_at);
  const sum = (f: (r: PosSaleRow) => number) => live.reduce((a, r) => a + f(r), 0);
  const total = sum((r) => Number(r.total));
  const cash = sum((r) => Number(r.cash_amount) - Number(r.change_due));
  const card = sum((r) => Number(r.card_amount));
  const withCost = live.filter((r) => r.cost_total != null);
  const profit = withCost.reduce((a, r) => a + Number(r.total) - Number(r.cost_total), 0);
  const voided = (rows ?? []).filter((r) => r.voided_at);

  const toReceipt = (r: PosSaleRow): ReceiptData => ({
    saleNo: r.sale_no,
    at: r.created_at,
    lines: r.pos_sale_items.map((i) => ({ name: i.product_name, qty: Number(i.quantity), price: Number(i.unit_price) })),
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    total: Number(r.total),
    payment: r.payment,
    cash: Number(r.cash_amount),
    card: Number(r.card_amount),
    change: Number(r.change_due),
    voided: !!r.voided_at,
  });

  const doVoid = async (id: string) => {
    setErr(null);
    const { error } = await sb.rpc("pos_void_sale", { p_id: id });
    setVoidId(null);
    if (error) {
      setErr(posError(error.message));
      return;
    }
    await load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line p-4">
          <p className="text-lg font-black">Kasa satışları</p>
          <input type="date" value={day} max={dayStr(new Date())} onChange={(e) => setDay(e.target.value)} className="ml-auto rounded-lg border border-line px-2 py-1.5 text-sm" />
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-bg" aria-label="Kapat">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-line p-4 sm:grid-cols-4">
          <Stat k="Ciro" v={formatTL(total)} strong />
          <Stat k="Nakit (kasada)" v={formatTL(cash)} />
          <Stat k="Kart" v={formatTL(card)} />
          <Stat k="Fiş" v={`${live.length}${voided.length ? ` · ${voided.length} iptal` : ""}`} />
          {withCost.length > 0 && <Stat k={`Brüt kâr${withCost.length < live.length ? " (alışı olanlar)" : ""}`} v={formatTL(profit)} />}
          {live.length > 0 && <Stat k="Ortalama fiş" v={formatTL(total / live.length)} />}
        </div>
        {err && <p className="mx-4 mt-3 rounded-xl bg-red-50 p-2 text-sm font-semibold text-red-700">{err}</p>}

        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {!rows && (
            <li className="flex items-center gap-2 p-6 text-muted">
              <Loader2 className="animate-spin" size={18} /> Yükleniyor…
            </li>
          )}
          {rows?.length === 0 && <li className="p-6 text-center text-muted">Bu gün kasa satışı yok.</li>}
          {rows?.map((r) => (
            <li key={r.id} className={r.voided_at ? "bg-zinc-50 opacity-60" : ""}>
              <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg">
                <span className="w-14 text-xs font-bold text-muted">#{r.sale_no}</span>
                <span className="text-sm font-semibold">{new Date(r.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-xs text-muted">
                  {PAY_LABEL[r.payment]} · {r.item_count} adet
                </span>
                <span className={`ml-auto font-black tabular-nums ${r.voided_at ? "line-through" : ""}`}>{formatTL(r.total)}</span>
              </button>
              {open === r.id && (
                <div className="space-y-2 px-4 pb-3">
                  <ul className="rounded-xl bg-bg p-2 text-sm">
                    {r.pos_sale_items.map((i, k) => (
                      <li key={k} className="flex justify-between gap-2 py-0.5">
                        <span>
                          {String(Number(i.quantity)).replace(".", ",")} × {i.product_name}
                        </span>
                        <span className="tabular-nums">{formatTL(i.line_total)}</span>
                      </li>
                    ))}
                    {Number(r.discount) > 0 && (
                      <li className="flex justify-between py-0.5 text-brand">
                        <span>İndirim</span>
                        <span>−{formatTL(r.discount)}</span>
                      </li>
                    )}
                  </ul>
                  <div className="flex gap-2">
                    <button onClick={() => setPrinting(toReceipt(r))} className="btn-ghost flex-1 py-2 text-sm">
                      <Printer size={15} /> Tekrar yazdır
                    </button>
                    {!r.voided_at && (
                      <button onClick={() => setVoidId(r.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-50 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200">
                        <RotateCcw size={15} /> Fişi iptal et
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {voidId && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={(e) => (e.stopPropagation(), setVoidId(null))}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-black">Fiş iptal edilsin mi?</p>
            <p className="text-sm text-muted">Satış cirodan düşer, ürünler stoğa geri eklenir. Bu işlem geri alınamaz.</p>
            <div className="flex gap-2">
              <button onClick={() => setVoidId(null)} className="flex-1 rounded-xl bg-bg py-2.5 font-bold">
                Vazgeç
              </button>
              <button onClick={() => void doVoid(voidId)} className="flex-1 rounded-xl bg-red-600 py-2.5 font-bold text-white">
                Evet, iptal et
              </button>
            </div>
          </div>
        </div>
      )}
      {printing && <PosReceipt data={printing} store={store} />}
    </div>
  );
}

function Stat({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-bg p-2.5">
      <p className="text-[11px] font-bold uppercase text-muted">{k}</p>
      <p className={`tabular-nums ${strong ? "text-xl font-black" : "font-bold"}`}>{v}</p>
    </div>
  );
}
