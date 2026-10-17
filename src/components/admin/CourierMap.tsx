"use client";
// Yönetici için canlı kurye haritası (OpenStreetMap + Leaflet). 30 sn'de bir yenilenir.
// orderId verilirse o siparişin kuryesine odaklanır ve teslimat sırasındaki rota izini çizer.
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, LayerGroup } from "leaflet";
import { createClient } from "@/lib/supabase/client";

type C = {
  user_id: string;
  full_name: string | null;
  on_duty: boolean;
  last_lat: number | null;
  last_lng: number | null;
  last_accuracy: number | null;
  last_speed: number | null;
  last_loc_at: string | null;
};
type Live = { courier_id: string; order_no: number; status: string };

const CORLU: [number, number] = [41.1592, 27.8006];
const STALE_MS = 5 * 60_000;
const ago = (iso: string | null, now: number) => {
  if (!iso) return "konum yok";
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  return m < 1 ? "şimdi" : m < 60 ? `${m} dk önce` : `${Math.floor(m / 60)} sa önce`;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function CourierMap({ orderId, courierId, height = 360 }: { orderId?: string; courierId?: string | null; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);
  const [info, setInfo] = useState<{ shown: number; total: number; focus?: C; now: number } | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sb = createClient();

    (async () => {
      const L = (await import("leaflet")).default;
      if (!alive || !box.current) return;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(CORLU, 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      map.current = m;
      layer.current = L.layerGroup().addTo(m);

      const draw = async () => {
        let q = sb.from("couriers").select("user_id,full_name,on_duty,last_lat,last_lng,last_accuracy,last_speed,last_loc_at").eq("is_active", true);
        if (courierId) q = q.eq("user_id", courierId);
        const [{ data: cs }, { data: live }, track] = await Promise.all([
          q,
          sb.from("orders").select("courier_id,order_no,status").not("courier_id", "is", null).in("status", ["hazirlaniyor", "yolda"]),
          orderId ? sb.from("courier_track").select("lat,lng,at").eq("order_id", orderId).order("at").limit(2000) : Promise.resolve({ data: [] as { lat: number; lng: number }[] }),
        ]);
        if (!alive || !layer.current) return;
        const now = Date.now();
        const list = ((cs ?? []) as C[]).filter((c) => courierId || c.on_duty || (c.last_loc_at && now - Date.parse(c.last_loc_at) < 3600_000));
        const tasks = (live ?? []) as Live[];
        layer.current.clearLayers();
        const pts: [number, number][] = [];

        const trail = ((track.data ?? []) as { lat: number; lng: number }[]).map((p) => [p.lat, p.lng] as [number, number]);
        if (trail.length > 1) {
          L.polyline(trail, { color: "#0284c7", weight: 4, opacity: 0.75 }).addTo(layer.current);
          L.circleMarker(trail[0], { radius: 6, color: "#0284c7", fillColor: "#fff", fillOpacity: 1, weight: 3 }).bindTooltip("Yola çıkış").addTo(layer.current);
          pts.push(...trail);
        }

        for (const c of list) {
          if (c.last_lat == null || c.last_lng == null) continue;
          const stale = !c.last_loc_at || now - Date.parse(c.last_loc_at) > STALE_MS || !c.on_duty;
          const mine = tasks.filter((t) => t.courier_id === c.user_id);
          const name = esc(c.full_name ?? "Kurye");
          const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          const icon = L.divIcon({
            className: "",
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            html: `<div style="width:38px;height:38px;border-radius:999px;display:grid;place-items:center;font:800 13px system-ui;color:#fff;background:${
              stale ? "#9ca3af" : mine.some((t) => t.status === "yolda") ? "#0284c7" : "#16a34a"
            };border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)">${initials || "🛵"}</div>`,
          });
          const speed = c.last_speed != null && c.last_speed > 0.5 ? ` · ${Math.round(c.last_speed * 3.6)} km/s` : "";
          const jobs = mine.length ? mine.map((t) => `#${t.order_no} ${t.status === "yolda" ? "yolda" : "hazırlanıyor"}`).join(", ") : "boşta";
          L.marker([c.last_lat, c.last_lng], { icon })
            .bindPopup(
              `<b>${name}</b><br>${c.on_duty ? "Mesaide" : "Molada"} · ${ago(c.last_loc_at, now)}${speed}<br>${jobs}<br>` +
                `<a href="https://www.google.com/maps/search/?api=1&query=${c.last_lat},${c.last_lng}" target="_blank" rel="noopener">Google Haritalar'da aç</a>`,
            )
            .bindTooltip(`${name} · ${ago(c.last_loc_at, now)}`, { direction: "top", offset: [0, -18] })
            .addTo(layer.current);
          if (c.last_accuracy && c.last_accuracy < 500 && !stale)
            L.circle([c.last_lat, c.last_lng], { radius: c.last_accuracy, color: "#16a34a", weight: 1, fillOpacity: 0.08 }).addTo(layer.current);
          pts.push([c.last_lat, c.last_lng]);
        }

        if (!fitted.current && pts.length) {
          fitted.current = true;
          if (pts.length === 1) m.setView(pts[0], 15);
          else m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
        }
        setInfo({ shown: list.filter((c) => c.last_lat != null).length, total: list.length, focus: courierId ? list[0] : undefined, now });
      };

      await draw();
      timer = setInterval(() => document.visibilityState === "visible" && void draw(), 30_000);
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      map.current?.remove();
      map.current = null;
      layer.current = null;
      fitted.current = false;
    };
  }, [orderId, courierId]);

  return (
    <div className="isolate overflow-hidden rounded-2xl ring-1 ring-line">
      <div ref={box} style={{ height }} className="z-0 w-full bg-bg" />
      <p className="bg-white px-3 py-1.5 text-xs text-muted">
        {info == null
          ? "Harita yükleniyor…"
          : courierId
            ? info.focus?.last_loc_at
              ? `Kurye konumu: ${ago(info.focus.last_loc_at, info.now)} güncellendi${orderId ? " · mavi çizgi: teslimat rotası" : ""}`
              : "Kurye henüz konum paylaşmadı (mesaide ve konum izni açık olmalı)."
            : `${info.shown} kurye haritada · yeşil: boşta, mavi: yolda, gri: konum eski / molada · 30 sn'de bir yenilenir`}
      </p>
    </div>
  );
}
