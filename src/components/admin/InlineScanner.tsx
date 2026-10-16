"use client";
// Satış ekranı için sayfa içinde (tam ekran değil) kamera barkod / QR okuyucu.
// Bir kod okununca: kamera hemen durur, büyük yeşil ✓ onay gösterilir, ~1,2 sn sonra kamera kapanır
// (ekranda açık kalmaz). Yeni ürün için tekrar "Kamerayla okut"a basılır.
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, Loader2, X, Zap } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";

const CONFIRM_MS = 1200;

export function InlineScanner({ onResult, className = "" }: { onResult: (code: string) => boolean | void; className?: string }) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [okCode, setOkCode] = useState<{ code: string; found: boolean } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const doneRef = useRef(false);
  const cb = useRef(onResult);
  useEffect(() => {
    cb.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    doneRef.current = false;
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
            if (!result || doneRef.current) return;
            const code = result.getText().trim();
            if (!code) return;
            doneRef.current = true;
            controlsRef.current?.stop(); // kamera hemen durur
            beep();
            navigator.vibrate?.(80);
            const found = cb.current(code) !== false;
            setOkCode({ code, found });
            closeTimer = setTimeout(() => {
              setOkCode(null);
              setOn(false);
            }, CONFIRM_MS);
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
      clearTimeout(closeTimer);
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
      {okCode && (
        <div className={`absolute inset-0 grid place-items-center text-white ${okCode.found ? "bg-emerald-600/90" : "bg-red-600/90"}`}>
          <div className="flex flex-col items-center gap-1.5">
            <span className={`grid h-14 w-14 place-items-center rounded-full bg-white shadow-lg ${okCode.found ? "text-emerald-600" : "text-red-600"}`}>
              {okCode.found ? <Check size={34} strokeWidth={3.5} /> : <X size={34} strokeWidth={3.5} />}
            </span>
            <p className="text-sm font-black">{okCode.found ? "Okundu · fişe eklendi" : "Okundu · ürün bulunamadı"}</p>
            <p className="max-w-[90%] truncate font-mono text-xs opacity-90">{okCode.code}</p>
          </div>
        </div>
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
