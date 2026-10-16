"use client";
// Kurye konum paylaşımı: YALNIZCA mesaideyken. Konum en fazla ~15 sn'de bir (ya da 40 m hareket edince) gönderilir;
// yöneticiler canlı haritada görür, yoldaki siparişte rota izi tutulur. Mola verilince paylaşım durur.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type LocStatus = "kapali" | "bekliyor" | "aktif" | "reddedildi" | "desteklenmiyor" | "hata";

const MIN_MS = 15_000;
const MIN_M = 40;

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function useCourierLocation(enabled: boolean) {
  const [state, setState] = useState<{ status: LocStatus; sentAt: number | null; accuracy: number | null }>({ status: "bekliyor", sentAt: null, accuracy: null });
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => setState((s) => ({ ...s, status: "desteklenmiyor" })));
      return;
    }
    const sb = createClient();
    let lock: { release: () => Promise<void> } | null = null;
    // Ekran açık kalsın (telefon kilitlenince tarayıcı konumu göndermeyi bırakır)
    const keepAwake = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === "visible") lock = await wl.request("screen");
      } catch {
        /* desteklenmiyorsa önemli değil */
      }
    };
    void keepAwake();
    const onVis = () => document.visibilityState === "visible" && void keepAwake();
    document.addEventListener("visibilitychange", onVis);

    const send = async (p: GeolocationPosition) => {
      const cur = { lat: p.coords.latitude, lng: p.coords.longitude };
      const now = Date.now();
      const prev = last.current;
      if (prev && now - prev.at < MIN_MS && meters(prev, cur) < MIN_M) return;
      last.current = { ...cur, at: now };
      const { error } = await sb.rpc("courier_update_location", {
        p_lat: cur.lat,
        p_lng: cur.lng,
        p_accuracy: Math.round(p.coords.accuracy),
        p_speed: p.coords.speed,
        p_heading: p.coords.heading,
      });
      setState({ status: error ? "hata" : "aktif", sentAt: error ? null : now, accuracy: Math.round(p.coords.accuracy) });
    };
    const id = navigator.geolocation.watchPosition(
      (p) => void send(p),
      (e) => setState((s) => ({ ...s, status: e.code === e.PERMISSION_DENIED ? "reddedildi" : "hata" })),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
      last.current = null;
    };
  }, [enabled]);

  return enabled ? state : { status: "kapali" as LocStatus, sentAt: null, accuracy: null };
}
