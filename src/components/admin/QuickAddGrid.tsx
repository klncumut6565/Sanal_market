"use client";
// Hızlı ürün ekleme: her satır bir ürün (Excel/stok programı gibi).
// Enter → sonraki hücre, satır sonunda alt satır. Excel'den kopyalanan satırlar yapıştırılınca tabloya dağılır.
import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Plus, Save, ScanBarcode, Trash2 } from "lucide-react";
import { BarcodeScanner } from "./BarcodeScanner";
import { useHidScanner } from "@/lib/hidScanner";
import { createClient } from "@/lib/supabase/client";
import { quickAddProducts, type QuickRow } from "@/app/admin/actions";
import { calcMargin, marginTone, pctTR } from "@/lib/margin";
import { parseNumTR } from "@/lib/numTR";
import type { Category } from "@/lib/types";

type TextKey = "barcode" | "name" | "unit_label" | "cost" | "price" | "sale" | "stock" | "critical" | "max";
type Col = { key: TextKey | "category_id"; label: string; w: string; num?: boolean; ph?: string };

// Sütunlar: "Yeni ürün" formundaki alanlarla aynı
const COLS: Col[] = [
  { key: "barcode", label: "Barkod", w: "w-40", ph: "869…" },
  { key: "name", label: "Ürün adı *", w: "w-64" },
  { key: "category_id", label: "Kategori", w: "w-44" },
  { key: "unit_label", label: "Birim", w: "w-24", ph: "1 kg" },
  { key: "cost", label: "Alış fiyatı ₺", w: "w-28", num: true },
  { key: "price", label: "Satış fiyatı ₺ *", w: "w-28", num: true },
  { key: "sale", label: "İndirimli ₺", w: "w-24", num: true, ph: "yok" },
  { key: "stock", label: "Stok *", w: "w-20", num: true, ph: "0" },
  { key: "critical", label: "Kritik stok", w: "w-20", num: true, ph: "5" },
  { key: "max", label: "Sip. sınırı", w: "w-20", num: true, ph: "20" },
];

type Row = QuickRow & { status?: "ok" | "err"; msg?: string; dup?: string };

let seq = 0;
const blank = (category_id: string): Row => ({
  key: `r${Date.now().toString(36)}${(seq++).toString(36)}`,
  barcode: "",
  name: "",
  category_id,
  unit_label: "",
  cost: "",
  price: "",
  sale: "",
  stock: "",
  critical: "",
  max: "",
  active: true,
});
const isEmpty = (r: Row) => !r.barcode.trim() && !r.name.trim() && !r.price.trim();

export function QuickAddGrid({ categories }: { categories: Category[] }) {
  const [defCat, setDefCat] = useState("");
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 10 }, () => blank("")));
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [scanRow, setScanRow] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const catByName = useMemo(() => new Map(categories.map((c) => [c.name.toLocaleLowerCase("tr"), c.id])), [categories]);

  const update = useCallback((i: number, patch: Partial<Row>) => {
    setRows((rs) => {
      const next = rs.map((r, k) => (k === i ? { ...r, ...patch, status: undefined, msg: undefined } : r));
      // Son satıra yazılınca otomatik yeni satır
      if (i === next.length - 1 && !isEmpty(next[i])) next.push(blank(defCat));
      return next;
    });
  }, [defCat]);

  const focusCell = (r: number, c: number) => {
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`);
    el?.focus();
    if (el instanceof HTMLInputElement) el.select();
  };

  const onKey = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (c < COLS.length - 1) focusCell(r, c + 1);
      else {
        if (r === rows.length - 1) setRows((rs) => [...rs, blank(defCat)]);
        setTimeout(() => focusCell(r + 1, 0), 0);
      }
    } else if (e.key === "ArrowDown" && !(e.target instanceof HTMLSelectElement)) {
      e.preventDefault();
      focusCell(Math.min(r + 1, rows.length - 1), c);
    } else if (e.key === "ArrowUp" && !(e.target instanceof HTMLSelectElement)) {
      e.preventDefault();
      focusCell(Math.max(r - 1, 0), c);
    }
  };

  // Barkod kayıtlı mı? (aynı barkodla ikinci ürün açılmasın)
  const checkBarcode = async (i: number, code: string) => {
    const c = code.replace(/\s+/g, "");
    if (c.length < 4) return;
    const { data } = await createClient().from("products").select("name").eq("barcode", c).maybeSingle();
    setRows((rs) => rs.map((r, k) => (k === i && r.barcode.replace(/\s+/g, "") === c ? { ...r, dup: data?.name ?? undefined } : r)));
  };

  // Excel / stok programından kopyalanan satırları tabloya dağıt
  const onPaste = (e: React.ClipboardEvent, r0: number, c0: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
    setRows((rs) => {
      const next = [...rs];
      lines.forEach((line, li) => {
        const ri = r0 + li;
        while (next.length <= ri) next.push(blank(defCat));
        const cells = line.split("\t");
        const patch: Partial<Row> = {};
        cells.forEach((val, ci) => {
          const col = COLS[c0 + ci];
          if (!col) return;
          const v = val.trim();
          if (col.key === "category_id") {
            const id = catByName.get(v.toLocaleLowerCase("tr"));
            if (id) patch.category_id = id;
          } else patch[col.key] = v;
        });
        next[ri] = { ...next[ri], ...patch, status: undefined, msg: undefined };
      });
      next.push(blank(defCat));
      return next;
    });
  };

  const applyDefaultCat = (id: string) => {
    setDefCat(id);
    setRows((rs) => rs.map((r) => (isEmpty(r) || !r.category_id ? { ...r, category_id: id } : r)));
  };

  const filled = rows.filter((r) => !isEmpty(r) && r.status !== "ok");

  const save = async () => {
    if (!filled.length) return setSummary("Kaydedilecek satır yok.");
    setSaving(true);
    setSummary(null);
    try {
      const res = await quickAddProducts(filled.map(({ status: _s, msg: _m, dup: _d, ...r }) => (void _s, void _m, void _d, r)));
      const byKey = new Map(res.map((x) => [x.key, x]));
      const ok = res.filter((x) => x.ok).length;
      setRows((rs) => {
        const kept = rs
          .map((r) => {
            const x = byKey.get(r.key);
            if (!x) return r;
            return x.ok ? null : { ...r, status: "err" as const, msg: x.error };
          })
          .filter(Boolean) as Row[];
        while (kept.length < 5) kept.push(blank(defCat));
        if (!isEmpty(kept[kept.length - 1])) kept.push(blank(defCat));
        return kept;
      });
      const notes = res.filter((x) => x.ok && x.note).length;
      setSummary(
        `${ok} ürün eklendi` +
          (res.length - ok ? ` · ${res.length - ok} satırda hata var (kırmızı)` : "") +
          (notes ? ` · ${notes} üründe negatif stok 0 alındı` : ""),
      );
    } catch {
      setSummary("Kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.");
    } finally {
      setSaving(false);
    }
  };

  // El barkod okuyucu: barkod hücresindeyken normal yazım (Enter sonraki hücre);
  // başka hücredeyken o satırın barkoduna, hiçbir hücrede değilken ilk boş satıra yazılır.
  useHidScanner((code, target) => {
    const cell = target?.getAttribute?.("data-cell");
    let i: number;
    if (cell) {
      const [ri, ci] = cell.split("-").map(Number);
      if (ci === 0) return false;
      i = ri;
    } else {
      i = rows.findIndex(isEmpty);
      if (i < 0) {
        i = rows.length;
        setRows((rs) => [...rs, blank(defCat)]);
      }
    }
    update(i, { barcode: code, dup: undefined });
    void checkBarcode(i, code);
    setTimeout(() => focusCell(i, 1), 50);
    return true;
  }, scanRow === null);

  return (
    <div className="space-y-3">
      {scanRow !== null && (
        <BarcodeScanner
          onResult={(code) => {
            const i = scanRow;
            update(i, { barcode: code });
            setScanRow(null);
            void checkBarcode(i, code);
            setTimeout(() => focusCell(i, 1), 50);
          }}
          onClose={() => setScanRow(null)}
        />
      )}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link href="/admin/urunler" className="flex items-center text-sm font-semibold text-muted hover:text-brand">
            <ChevronLeft size={16} /> Ürünler
          </Link>
          <h1 className="text-2xl font-black">Hızlı ürün ekle (liste)</h1>
          <p className="text-sm text-muted">
            Her satır bir ürün. <b>Enter</b> ile sonraki hücreye geç; Excel veya stok programından kopyaladığın satırları bir hücreye <b>yapıştır</b>, tabloya dağılır.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Varsayılan kategori
          <select value={defCat} onChange={(e) => applyDefaultCat(e.target.value)} className="input w-auto py-2">
            <option value="">— Seç —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table ref={tableRef} className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-bg text-left text-xs font-bold text-muted">
            <tr>
              <th className="w-8 px-2 py-2 text-center">#</th>
              {COLS.map((c) => (
                <th key={c.key} className={`${c.w} px-1.5 py-2 ${c.num ? "text-right" : ""}`}>{c.label}</th>
              ))}
              <th className="px-1.5 py-2 text-center">Satışta</th>
              <th className="w-20 px-1.5 py-2 text-right">Kâr marjı</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const price = parseNumTR(r.sale || r.price);
              const cost = parseNumTR(r.cost);
              const m = calcMargin(Number.isNaN(price) ? null : price, Number.isNaN(cost) ? null : cost);
              return (
                <tr key={r.key} className={`border-t border-line ${r.status === "err" ? "bg-red-50" : ""}`}>
                  <td className="px-2 text-center text-xs text-muted">{i + 1}</td>
                  {COLS.map((c, ci) => (
                    <td key={c.key} className="p-0.5">
                      {c.key === "category_id" ? (
                        <select
                          data-cell={`${i}-${ci}`}
                          value={r.category_id}
                          onChange={(e) => update(i, { category_id: e.target.value })}
                          onKeyDown={(e) => onKey(e, i, ci)}
                          className="h-9 w-full rounded-lg border border-transparent bg-transparent px-1.5 hover:border-line focus:border-brand focus:outline-none"
                        >
                          <option value="">—</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="relative flex items-center">
                          <input
                            data-cell={`${i}-${ci}`}
                            value={r[c.key]}
                            placeholder={c.ph}
                            inputMode={c.num ? "decimal" : c.key === "barcode" ? "numeric" : undefined}
                            onChange={(e) => update(i, { [c.key]: e.target.value, ...(c.key === "barcode" ? { dup: undefined } : {}) } as Partial<Row>)}
                            onBlur={c.key === "barcode" ? (e) => void checkBarcode(i, e.target.value) : undefined}
                            onKeyDown={(e) => onKey(e, i, ci)}
                            onPaste={(e) => onPaste(e, i, ci)}
                            className={`h-9 w-full rounded-lg border bg-transparent px-1.5 placeholder:text-zinc-300 focus:border-brand focus:bg-white focus:outline-none ${
                              c.num ? "text-right tabular-nums" : ""
                            } ${c.key === "barcode" ? "pr-7 font-mono" : ""} ${
                              c.key === "barcode" && r.dup ? "border-amber-400 bg-amber-50" : "border-transparent hover:border-line"
                            }`}
                          />
                          {c.key === "barcode" && (
                            <button type="button" tabIndex={-1} onClick={() => setScanRow(i)} className="absolute right-1 text-muted hover:text-brand" aria-label="Kamerayla barkod okut">
                              <ScanBarcode size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="text-center">
                    <input type="checkbox" checked={r.active} onChange={(e) => update(i, { active: e.target.checked })} className="h-4 w-4 accent-brand" tabIndex={-1} />
                  </td>
                  <td className={`px-1.5 text-right text-xs font-bold ${m ? marginTone(m) : "text-zinc-300"}`}>{m ? pctTR(m.marginPct) : "—"}</td>
                  <td>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : [blank(defCat)]))}
                      className="grid h-8 w-8 place-items-center text-zinc-300 hover:text-brand"
                      aria-label="Satırı sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.some((r) => r.dup || r.msg) && (
        <ul className="space-y-1 text-sm">
          {rows.map((r, i) =>
            r.msg ? (
              <li key={r.key + "e"} className="font-semibold text-brand">Satır {i + 1}: {r.msg}</li>
            ) : r.dup ? (
              <li key={r.key + "d"} className="font-semibold text-amber-700">Satır {i + 1}: bu barkod zaten kayıtlı — “{r.dup}”</li>
            ) : null,
          )}
        </ul>
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-2xl bg-white/95 p-3 ring-1 ring-line backdrop-blur">
        <button type="button" onClick={() => setRows((rs) => [...rs, ...Array.from({ length: 10 }, () => blank(defCat))])} className="btn-ghost py-2 text-sm">
          <Plus size={16} /> 10 satır ekle
        </button>
        <button type="button" onClick={save} disabled={saving || !filled.length} className="btn-primary py-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {filled.length} ürünü kaydet
        </button>
        {summary && <span className="text-sm font-semibold">{summary}</span>}
      </div>
    </div>
  );
}
