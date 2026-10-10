"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, BellOff, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const RING_MS = 20_000;
const POLL_MS = 8_000;

type Latest = { id: string; order_no: number; customer_name: string; total: number };

/** Yeni sipariş gelince 20 sn zil çalar. Tarayıcı kuralı gereği ses, sayfada bir kez dokunulduktan sonra açılır. */
export function NewOrderAlarm() {
  const ctxRef = useRef<AudioContext | null>(null);
  const lastNo = useRef<number | null>(null);
  const stopAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [soundReady, setSoundReady] = useState(false);
  const [ringing, setRinging] = useState<Latest | null>(null);

  const unlock = useCallback(async () => {
    try {
      ctxRef.current ??= new AudioContext();
      await ctxRef.current.resume();
      setSoundReady(ctxRef.current.state === "running");
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } catch {}
  }, []);

  // Sayfadaki ilk dokunuş/tıklamada sesi otomatik aç
  useEffect(() => {
    const h = () => unlock();
    window.addEventListener("pointerdown", h, { once: true });
    window.addEventListener("keydown", h, { once: true });
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", h);
    };
  }, [unlock]);

  const ding = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    // "Ding-dong" zil sesi
    [
      [1318.5, 0],
      [987.8, 0.35],
    ].forEach(([freq, delay]) => {
      for (const mult of [1, 2.01]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq * mult;
        const t = now + delay;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(mult === 1 ? 0.6 : 0.15, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.95);
      }
    });
    if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
  }, []);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRinging(null);
    document.title = document.title.replace(/^🔔 YENİ SİPARİŞ · /, "");
  }, []);

  const ring = useCallback(
    (order: Latest) => {
      setRinging(order);
      stopAt.current = Date.now() + RING_MS;
      if (!document.title.startsWith("🔔")) document.title = "🔔 YENİ SİPARİŞ · " + document.title;
      try {
        if ("Notification" in window && Notification.permission === "granted")
          new Notification(`Yeni sipariş #${order.order_no}`, { body: `${order.customer_name} · ${Number(order.total).toFixed(2)} ₺`, icon: "/logo-mark.png", tag: "siparis" });
      } catch {}
      if (timer.current) clearInterval(timer.current);
      ding();
      timer.current = setInterval(() => {
        if (Date.now() >= stopAt.current) stop();
        else ding();
      }, 1500);
    },
    [ding, stop],
  );

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const check = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_no, customer_name, total")
        .order("order_no", { ascending: false })
        .limit(1)
        .maybeSingle<Latest>();
      if (!alive || error) return;
      const no = data?.order_no ?? 0;
      if (lastNo.current === null) lastNo.current = no; // ilk açılışta çalmasın (hiç sipariş yoksa 0)
      else if (data && no > lastNo.current) {
        lastNo.current = no;
        ring(data);
      }
    };
    check();
    const t = setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearInterval(timer.current);
    };
  }, [ring]);

  return (
    <>
      {!soundReady && (
        <button
          onClick={unlock}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-white shadow-lg"
        >
          <Volume2 size={18} className="text-brand" /> Sipariş zilini aç
        </button>
      )}
      {ringing && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-lg items-center ring-4 ring-brand/30 gap-3 rounded-2xl bg-brand p-4 text-white shadow-2xl">
          <BellRing size={28} className="shrink-0 animate-bounce" />
          <Link href={`/admin/siparisler/${ringing.id}`} onClick={stop} className="min-w-0 flex-1">
            <p className="text-lg font-black">Yeni sipariş #{ringing.order_no}</p>
            <p className="truncate text-sm font-semibold opacity-90">
              {ringing.customer_name} · {Number(ringing.total).toFixed(2)} ₺ — açmak için dokun
            </p>
          </Link>
          <button onClick={stop} aria-label="Zili sustur" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20">
            <BellOff size={20} />
          </button>
        </div>
      )}
    </>
  );
}
