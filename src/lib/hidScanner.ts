"use client";
// USB/Bluetooth el barkod okuyucu (ör. Afanda AF-9090-2D-USB) desteği.
// Bu cihazlar klavye gibi çalışır: barkodu çok hızlı tuş vuruşlarıyla yazar ve sonuna Enter basar.
// Burada hızlı tuş dizisi + Enter "okutma" olarak yakalanır; insan yazımıyla karışmaz
// (tuşlar arası ≤ 45 ms, en az 6 karakter). Okutma bir giriş kutusuna yazıldıysa o kutudan silinir
// (barkod kutusu hariç) ve Enter'ın formu göndermesi engellenir.
// Aynı anda tek dinleyici çalışır: en son eklenen (sayfaya özel) dinleyici, genel olanı ezer.
import { useEffect, useRef } from "react";

/** true dönerse okutma işlendi sayılır (Enter engellenir, kutudaki karakterler silinir). */
export type ScanHandler = (code: string, target: HTMLElement | null) => boolean | void;

const MAX_GAP = 45;
const MIN_LEN = 6;
const stack: { id: number; fn: () => ScanHandler }[] = [];
let seq = 0;
let installed = false;

function isEditable(el: unknown): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** React kontrollü kutudan okutulan karakterleri sil (React'in onChange'i tetiklenir). */
function stripFromInput(el: HTMLInputElement | HTMLTextAreaElement, code: string) {
  if (el.dataset.barcode === "1" || !el.value.endsWith(code)) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, el.value.slice(0, -code.length));
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  let buf = "";
  let last = 0;
  let target: HTMLElement | null = null;
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const now = performance.now();
      if (e.key.length === 1) {
        if (now - last > MAX_GAP) {
          buf = "";
          target = e.target as HTMLElement | null;
        }
        buf += e.key;
        last = now;
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && buf.length >= MIN_LEN && now - last <= MAX_GAP * 3) {
        const code = buf.trim();
        buf = "";
        const top = stack[stack.length - 1];
        if (!top || !/^[0-9A-Za-z\-_.]+$/.test(code)) return;
        const el = target;
        if (top.fn()(code, el) === false) return; // işlenmedi: normal Enter davranışı
        e.preventDefault();
        e.stopPropagation();
        if (isEditable(el)) stripFromInput(el, code);
        return;
      }
      if (e.key !== "Shift") buf = "";
    },
    true,
  );
}

/** El barkod okuyucuyu dinle. enabled=false iken dinlemez (ör. kamera açıkken). */
export function useHidScanner(onScan: ScanHandler, enabled = true) {
  const ref = useRef(onScan);
  useEffect(() => {
    ref.current = onScan;
  }, [onScan]);
  useEffect(() => {
    if (!enabled) return;
    install();
    const id = ++seq;
    stack.push({ id, fn: () => ref.current });
    return () => {
      const i = stack.findIndex((s) => s.id === id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [enabled]);
}
