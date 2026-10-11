"use client";
// Favori ürünler — cihazda (localStorage) tutulur, üyelik gerektirmez.
import { useSyncExternalStore } from "react";

const KEY = "sanal-market-favoriler";
const EVT = "favoriler-degisti";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
let cache: string[] | null = null;
let cacheRaw = "";
function snapshot(): string[] {
  let raw = "[]";
  try {
    raw = localStorage.getItem(KEY) ?? "[]";
  } catch {}
  if (cache && raw === cacheRaw) return cache;
  cacheRaw = raw;
  cache = read();
  return cache;
}
const EMPTY: string[] = [];
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useFavorites() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function toggleFavorite(id: string) {
  const cur = read();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 200);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(EVT));
}
