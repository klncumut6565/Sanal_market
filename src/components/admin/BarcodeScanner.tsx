"use client";
import { useEffect, useRef, useState } from "react";
import { X, Zap } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";

type Props = { onResult: (code: string) => void; onClose: () => void };

/** Telefon/bilgisayar kamerasıyla barkod (EAN-13, EAN-8, UPC, Code128…) okur. */
export function BarcodeScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
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
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => {
            if (!result || doneRef.current) return;
            doneRef.current = true;
            beep();
            navigator.vibrate?.(120);
            controlsRef.current?.stop();
            onResult(result.getText().trim());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        if (controls.switchTorch) setTorch(false);
      } catch (e) {
        const name = (e as Error)?.name;
        setError(
          name === "NotAllowedError"
            ? "Kamera izni verilmedi. Tarayıcı ayarlarından bu siteye kamera izni ver ve tekrar dene."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "Kamera bulunamadı."
              : "Kamera açılamadı. Barkodu elle yazabilirsin.",
        );
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <p className="font-bold">Barkodu çerçeveye hizala</p>
        <div className="flex gap-2">
          {torch !== null && (
            <button
              onClick={async () => {
                await controlsRef.current?.switchTorch?.(!torch);
                setTorch(!torch);
              }}
              aria-label="Fener"
              className={`grid h-10 w-10 place-items-center rounded-full ${torch ? "bg-brand" : "bg-white/15"}`}
            >
              <Zap size={20} />
            </button>
          )}
          <button onClick={onClose} aria-label="Kapat" className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <X size={22} />
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-36 w-[80%] max-w-md rounded-2xl border-4 border-brand shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-brand" />
          </div>
        </div>
        {error && (
          <div className="absolute inset-x-4 bottom-6 rounded-2xl bg-white p-4 text-center text-sm font-semibold text-brand">{error}</div>
        )}
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
    o.stop(ctx.currentTime + 0.12);
    o.onended = () => ctx.close();
  } catch {}
}
