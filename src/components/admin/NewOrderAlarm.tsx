"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellOff, BellRing, Check, Play, Settings2, Volume2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RINGTONES, ringtoneUrl, type RingtoneId } from "@/lib/ringtones";

const RING_MS = 20_000;
const POLL_MS = 8_000;
const PREF_KEY = "sanal-market-zil";

type Latest = { id: string; order_no: number; customer_name: string; total: number };
type Prefs = { tone: RingtoneId; volume: number };

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? "null");
    if (p && RINGTONES.some((r) => r.id === p.tone)) return { tone: p.tone, volume: Math.min(1, Math.max(0.1, Number(p.volume) || 1)) };
  } catch {}
  return { tone: "dingdong", volume: 1 };
}

/** Yeni sipariş gelince seçilen zil sesini 20 sn çalar. */
export function NewOrderAlarm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastNo = useRef<number | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tercihler yalnızca açılır panelde gösterildiği için ilk çizimde uyuşmazlık olmaz
  const [prefs, setPrefs] = useState<Prefs>(() => (typeof window === "undefined" ? { tone: "dingdong", volume: 1 } : loadPrefs()));
  const [soundReady, setSoundReady] = useState(false);
  const [panel, setPanel] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ringing, setRinging] = useState<Latest | null>(null);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const savePrefs = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(p));
    } catch {}
  };

  const getAudio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      a.setAttribute("playsinline", "");
      audioRef.current = a;
    }
    return audioRef.current;
  };

  /** Dokunuşla sesi aç (tarayıcı kuralı). iPhone'da sessiz modda da çalsın diye medya oturumu. */
  const unlock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback";
      const a = getAudio();
      a.src = ringtoneUrl(prefsRef.current.tone);
      a.volume = 0.0001;
      a.muted = false;
      await a.play();
      a.pause();
      a.currentTime = 0;
      a.volume = prefsRef.current.volume;
      setSoundReady(true);
    } catch {
      setSoundReady(false);
    }
  }, []);

  useEffect(() => {
    const h = () => unlock();
    window.addEventListener("pointerdown", h, { once: true });
    window.addEventListener("keydown", h, { once: true });
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", h);
    };
  }, [unlock]);

  const startSound = useCallback((ms: number) => {
    const a = getAudio();
    a.src = ringtoneUrl(prefsRef.current.tone);
    a.loop = true;
    a.volume = prefsRef.current.volume;
    a.currentTime = 0;
    a.play().catch(() => setSoundReady(false));
    if ("vibrate" in navigator) navigator.vibrate?.([300, 150, 300, 150, 300]);
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      a.pause();
      a.loop = false;
      setRinging(null);
      setTesting(false);
      document.title = document.title.replace(/^🔔 YENİ SİPARİŞ · /, "");
    }, ms);
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.loop = false;
    }
    if (stopTimer.current) clearTimeout(stopTimer.current);
    setRinging(null);
    setTesting(false);
    document.title = document.title.replace(/^🔔 YENİ SİPARİŞ · /, "");
  }, []);

  const ring = useCallback(
    (order: Latest) => {
      setRinging(order);
      if (!document.title.startsWith("🔔")) document.title = "🔔 YENİ SİPARİŞ · " + document.title;
      try {
        if ("Notification" in window && Notification.permission === "granted")
          new Notification(`Yeni sipariş #${order.order_no}`, { body: `${order.customer_name} · ${Number(order.total).toFixed(2)} ₺`, icon: "/logo-mark.png", tag: "siparis" });
      } catch {}
      startSound(RING_MS);
    },
    [startSound],
  );

  const test = async () => {
    await unlock();
    setTesting(true);
    startSound(3000);
  };

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
      if (lastNo.current === null) lastNo.current = no;
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
      if (stopTimer.current) clearTimeout(stopTimer.current);
      audioRef.current?.pause();
    };
  }, [ring]);

  return (
    <>
      {/* Zil durumu / ayar düğmesi */}
      <button
        onClick={() => {
          unlock();
          setPanel(true);
        }}
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-lg ${
          soundReady ? "bg-white text-ink ring-1 ring-line" : "bg-ink text-white"
        }`}
      >
        {soundReady ? <Volume2 size={18} className="text-emerald-600" /> : <Volume2 size={18} className="text-brand" />}
        {soundReady ? "Zil açık" : "Sipariş zilini aç"}
        <Settings2 size={16} className="opacity-60" />
      </button>

      {panel && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setPanel(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">🔔 Sipariş zili</h2>
              <button onClick={() => setPanel(false)} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full hover:bg-bg">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {RINGTONES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => savePrefs({ ...prefs, tone: r.id })}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left ring-1 ${prefs.tone === r.id ? "bg-brand-soft ring-2 ring-brand" : "ring-line"}`}
                >
                  <span>
                    <span className="block text-sm font-bold">{r.label}</span>
                    <span className="block text-xs text-muted">{r.desc}</span>
                  </span>
                  {prefs.tone === r.id && <Check size={18} className="text-brand" />}
                </button>
              ))}
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Ses seviyesi</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={prefs.volume}
                onChange={(e) => savePrefs({ ...prefs, volume: Number(e.target.value) })}
                className="w-full accent-brand"
              />
            </label>
            <button onClick={testing ? stop : test} className="btn-primary w-full">
              {testing ? <BellOff size={18} /> : <Play size={18} />} {testing ? "Durdur" : "Test et (3 sn)"}
            </button>
            <p className="text-xs leading-relaxed text-muted">
              Zil yalnızca bu sayfa açıkken çalar. Telefonun <b>medya sesi</b> açık olmalı; ekran kilitlenirse tarayıcı sesi durdurur. Siparişleri ekranı açık bir tablet veya bilgisayarda takip etmen en güvenlisi.
            </p>
          </div>
        </div>
      )}

      {ringing && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-brand p-4 text-white shadow-2xl ring-4 ring-brand/30">
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
