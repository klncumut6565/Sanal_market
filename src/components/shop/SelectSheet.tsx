"use client";
// Sahibinden.com tarzı tam ekran seçim listesi: başlık + geri, grup başlığı,
// arama, sağda yuvarlak işaret. Satıra dokununca seçer ve kapanır.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, Search } from "lucide-react";

export type SheetOption = { value: string; label: string; disabled?: boolean; hint?: string; /** Alt grup başlığı (ör. semt) */ section?: string };

const norm = (t: string) =>
  t
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .trim();

/** Form içinde görünen alan — dokununca tam ekran liste açılır. */
export function SheetField({
  label,
  required,
  placeholder,
  valueLabel,
  disabled,
  onOpen,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  valueLabel?: string;
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="block space-y-1">
      <span className="text-sm font-semibold">
        {label} {required && <span className="text-brand">*</span>}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="input flex items-center justify-between gap-2 text-left disabled:opacity-50"
      >
        <span className={`truncate ${valueLabel ? "font-semibold text-ink" : "text-muted"}`}>{valueLabel || placeholder}</span>
        <ChevronDown size={18} className="shrink-0 text-muted" />
      </button>
    </div>
  );
}

export function SelectSheet({
  open,
  title,
  group,
  options,
  value,
  onSelect,
  onClose,
  searchPlaceholder = "Ara",
  freeText,
}: {
  open: boolean;
  title: string;
  /** Liste üstündeki grup başlığı (ör. "Tekirdağ", "Hatip Mah.") */
  group?: string;
  options: SheetOption[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchPlaceholder?: string;
  /** Aramada sonuç yoksa yazılanı serbest metin olarak kullanma seçeneği */
  freeText?: { label: (q: string) => string; onUse: (q: string) => void };
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Arka plan kaymasın
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);

  const list = useMemo(() => {
    const n = norm(q);
    return n ? options.filter((o) => norm(o.label).includes(n)) : options;
  }, [q, options]);

  if (!open) return null;
  const showSearch = options.length > 8 || !!freeText;
  const close = () => {
    setQ("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={title}>
      <header className="flex h-14 shrink-0 items-center bg-ink px-2 text-white">
        <button type="button" onClick={close} aria-label="Geri" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10">
          <ChevronLeft size={26} />
        </button>
        <h2 className="flex-1 text-center text-lg font-extrabold">{title}</h2>
        <span className="w-10" />
      </header>

      {showSearch && (
        <div className="shrink-0 border-b border-line p-3">
          <label className="flex items-center gap-2 rounded-xl bg-bg px-3 ring-1 ring-line focus-within:ring-brand">
            <Search size={18} className="text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full bg-transparent text-[16px] outline-none"
              autoComplete="off"
            />
          </label>
        </div>
      )}

      {group && (
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-brand-soft px-4 py-3">
          <span className="font-extrabold">{group}</span>
          {value && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">1</span>}
        </div>
      )}

      <ul className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {list.map((o, i) => {
          const sel = o.value === value;
          const newSection = o.section && o.section !== list[i - 1]?.section;
          return (
            <li key={o.value} className="border-b border-line/70 last:border-0">
              {newSection && (
                <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 pb-2 pt-4 backdrop-blur">
                  <span className="text-[17px] font-extrabold">{o.section}</span> <span className="text-sm text-muted">(Semt)</span>
                </div>
              )}
              <button
                type="button"
                disabled={o.disabled}
                onClick={() => {
                  onSelect(o.value);
                  close();
                }}
                className={`flex w-full items-center justify-between gap-3 py-3.5 pr-4 text-left text-[17px] active:bg-bg disabled:opacity-45 ${o.section ? "pl-7" : "pl-4"}`}
              >
                <span className="min-w-0">
                  <span className={sel ? "font-bold" : ""}>{o.label}</span>
                  {o.hint && <span className="ml-2 text-xs font-semibold text-muted">{o.hint}</span>}
                </span>
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${sel ? "bg-emerald-600 text-white" : "ring-2 ring-zinc-300"}`}
                  aria-hidden
                >
                  {sel && <Check size={16} strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}

        {freeText && q.trim().length >= 2 && (
          <li className="border-t border-line bg-bg/60">
            <button
              type="button"
              onClick={() => {
                freeText.onUse(q.trim());
                close();
              }}
              className="w-full px-4 py-4 text-left font-bold text-brand"
            >
              ✏️ {freeText.label(q.trim())}
            </button>
          </li>
        )}

        {!list.length && !freeText && <li className="p-6 text-center text-muted">Sonuç bulunamadı.</li>}
      </ul>
    </div>
  );
}
