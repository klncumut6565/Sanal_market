"use client";
// Satış ekranı için sayfa içinde (tam ekran değil) sürekli çalışan kamera barkod / QR okuyucu.
// Açık kaldığı sürece okutulan her barkodu bildirir; aynı kod 1,5 sn içinde tekrar okunursa yok sayılır.
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, Zap } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";

const REPEAT_MS = 1500;

export function InlineScanner({ onResult, className = "" }: { onResult: (code: string) => void; className?: string }) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const last = useRef<{ code: string; at: number } | null>(null);
  const cb = useRef(onResult);
  useEffect(() => {
    cb.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => {
            if (!result) return;
            const code = result.getText().trim();
            const now = Date.now();
            if (!code || (last.current && last.current.code === code && now - last.current.at < REPEAT_MS)) return;
            last.current = { code, at: now };
            beep();
            navigator.vibrate?.(80);
            setLastCode(code);
            cb.current(code);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setReady(true);
        if (controls.switchTorch) setTorch(false);
      } catch (e) {
        const name = (e as Error)?.name;
        setError(
          name === "NotAllowedError"
            ? "Kamera izni verilmedi. Tarayıcı ayarlarından kamera izni ver."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "Kamera bulunamadı."
              : "Kamera açılamadı.",
        );
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      setReady(false);
      setTorch(null);
    };
  }, [on]);

  if (!on)
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOn(true);
        }}
        className={`flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/50 bg-brand-soft/40 px-3 text-sm font-black text-brand hover:bg-brand-soft ${className}`}
        title="Kamerayla barkod / QR okut"
      >
        <Camera size={22} /> Kamerayla okut
      </button>
    );

  return (
    <div className={`relative h-40 overflow-hidden rounded-2xl bg-black ring-2 ring-brand ${className}`}>
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      {/* hedef çerçeve */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative h-16 w-[82%] rounded-xl border-2 border-brand shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-brand" />
        </div>
      </div>
      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center text-white">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {error && <p className="absolute inset-x-2 bottom-2 rounded-lg bg-white p-2 text-center text-xs font-bold text-brand">{error}</p>}
      {lastCode && !error && (
        <p className="absolute inset-x-2 bottom-2 truncate rounded-lg bg-black/60 px-2 py-1 text-center font-mono text-xs font-bold text-white">✓ {lastCode}</p>
      )}
      <div className="absolute right-1.5 top-1.5 flex gap-1.5">
        {torch !== null && (
          <button
            type="button"
            onClick={async () => {
              await controlsRef.current?.switchTorch?.(!torch);
              setTorch(!torch);
            }}
            aria-label="Fener"
            className={`grid h-8 w-8 place-items-center rounded-full text-white ${torch ? "bg-brand" : "bg-black/50"}`}
          >
            <Zap size={16} />
          </button>
        )}
        <button type="button" onClick={() => setOn(false)} aria-label="Kamerayı kapat" className="grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white">
          <CameraOff size={16} />
        </button>
      </div>
    </div>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1800;
    g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.1);
    o.onended = () => void ctx.close();
  } catch {
    /* ses yoksa önemli değil */
  }
}
