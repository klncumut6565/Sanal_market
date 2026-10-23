"use client";
// Sanal Market asistan robotu (SVG, ~6 KB, görsel dosyası yok). Durumu sesli asistanın GERÇEK durumundan gelir:
//  idle (bekleme) · listening (dinliyor / müşteri konuşuyor) · thinking (bağlanıyor, düşünüyor, ürün arıyor)
//  speaking (asistan konuşuyor) · error (hata). Animasyonlar CSS; "hareketi azalt" tercihinde durur.
import { useId } from "react";
import type { VoiceState } from "@/lib/voice/types";

export type RobotState = "idle" | "listening" | "thinking" | "speaking" | "error";

/** Sesli asistan durumunu robot görünümüne çevirir. */
export function robotStateOf(s: VoiceState | undefined): RobotState {
  switch (s) {
    case "listening":
    case "user_speaking":
      return "listening";
    case "connecting":
    case "processing":
    case "tool_calling":
    case "reconnecting":
      return "thinking";
    case "speaking":
      return "speaking";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

const CSS = `
.rb{overflow:visible}
.rb .rb-float{animation:rb-float 4s ease-in-out infinite;transform-origin:100px 120px}
.rb .rb-eyes{transform-origin:100px 84px;animation:rb-blink 5s infinite}
.rb .rb-glow{opacity:.55}
.rb[data-s=listening] .rb-glow{animation:rb-pulse 1.4s ease-in-out infinite}
.rb[data-s=listening] .rb-ear{animation:rb-ear 1.4s ease-in-out infinite}
.rb[data-s=speaking] .rb-mouth{transform-origin:100px 98px;animation:rb-talk .32s ease-in-out infinite alternate}
.rb[data-s=speaking] .rb-chest{animation:rb-pulse .64s ease-in-out infinite}
.rb[data-s=thinking] .rb-dots circle{animation:rb-dot 1s ease-in-out infinite}
.rb[data-s=thinking] .rb-dots circle:nth-child(2){animation-delay:.15s}
.rb[data-s=thinking] .rb-dots circle:nth-child(3){animation-delay:.3s}
.rb[data-s=thinking] .rb-ring{transform-origin:100px 168px;animation:rb-spin 1.6s linear infinite}
@keyframes rb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes rb-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes rb-pulse{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes rb-ear{0%,100%{fill:#bfe9ef}50%{fill:#19c6c8}}
@keyframes rb-talk{from{transform:scaleY(.35)}to{transform:scaleY(1.15)}}
@keyframes rb-dot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
@keyframes rb-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.rb *{animation:none!important}}
`;

export function Robot({ state = "idle", size = 160, className = "", title = "Sanal Market asistanı" }: { state?: RobotState; size?: number; className?: string; title?: string }) {
  // Sayfada birden çok robot olabilir (biri gizli olsa bile gradyanlar bozulmasın) → benzersiz kimlikler
  const u = useId().replace(/:/g, "");
  const id = (n: string) => `${n}-${u}`;
  const eye = state === "error" ? "#ff8a7a" : "#3ef0f2";
  const glow = state === "error" ? "#ff6b5b" : "#19c6c8";
  return (
    <svg viewBox="0 0 200 240" width={size} height={size * 1.2} className={`rb ${className}`} data-s={state} role="img" aria-label={title}>
      <style>{CSS}</style>
      <defs>
        <linearGradient id={id("rb-shell")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe6ec" />
        </linearGradient>
        <linearGradient id={id("rb-visor")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2b3a" />
          <stop offset="1" stopColor="#070d14" />
        </linearGradient>
        <radialGradient id={id("rb-base")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <filter id={id("rb-soft")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      {/* zemin ışığı */}
      <ellipse className="rb-glow" cx="100" cy="226" rx="56" ry="10" fill={`url(#${id("rb-base")})`} />

      <g className="rb-float">
        {/* gövde */}
        <path d="M58 152c0-18 19-30 42-30s42 12 42 30v22c0 26-19 40-42 40s-42-14-42-40z" fill={`url(#${id("rb-shell")})`} stroke="#cfd8df" strokeWidth="1.2" />
        {/* kollar */}
        <path d="M60 150c-14 6-20 22-12 30 6 6 18 0 26-10" fill={`url(#${id("rb-shell")})`} stroke="#cfd8df" strokeWidth="1.2" />
        <path d="M140 152c14 8 22 24 16 32-4 6-14 2-20-6" fill={`url(#${id("rb-shell")})`} stroke="#cfd8df" strokeWidth="1.2" />
        {/* göğüs ışığı */}
        <g className="rb-chest">
          <circle cx="100" cy="168" r="11" fill="none" stroke={glow} strokeWidth="3" opacity="0.9" />
          <circle cx="100" cy="168" r="11" fill="none" stroke={glow} strokeWidth="6" opacity="0.35" filter={`url(#${id("rb-soft")})`} />
        </g>
        <circle className="rb-ring" cx="100" cy="168" r="16" fill="none" stroke={glow} strokeWidth="1.6" strokeDasharray={state === "thinking" ? "8 6" : "0 200"} opacity="0.8" />
        {/* boyun */}
        <ellipse cx="100" cy="128" rx="22" ry="6" fill="#c9d3db" />

        {/* kafa */}
        <rect x="34" y="22" width="132" height="110" rx="54" fill={`url(#${id("rb-shell")})`} stroke="#cfd8df" strokeWidth="1.2" />
        {/* kulaklıklar */}
        <rect className="rb-ear" x="24" y="58" width="16" height="38" rx="8" fill="#bfe9ef" />
        <rect className="rb-ear" x="160" y="58" width="16" height="38" rx="8" fill="#bfe9ef" />
        {/* yüz ekranı */}
        <rect x="50" y="44" width="100" height="72" rx="32" fill={`url(#${id("rb-visor")})`} />
        <rect x="58" y="49" width="56" height="9" rx="4.5" fill="#ffffff" opacity="0.08" />

        {/* yüz ifadesi */}
        <g stroke={eye} strokeWidth="5" strokeLinecap="round" fill="none">
          {state === "error" ? (
            <>
              <path d="M74 76l12 12M86 76L74 88M114 76l12 12M126 76l-12 12" />
              <path d="M88 104q12-8 24 0" />
            </>
          ) : state === "thinking" ? (
            <>
              <g className="rb-dots" fill={eye} stroke="none">
                <circle cx="84" cy="84" r="4.5" />
                <circle cx="100" cy="84" r="4.5" />
                <circle cx="116" cy="84" r="4.5" />
              </g>
            </>
          ) : (
            <>
              <g className="rb-eyes">
                {state === "listening" ? (
                  <>
                    <ellipse cx="80" cy="82" rx="7" ry="8" fill={eye} stroke="none" />
                    <ellipse cx="120" cy="82" rx="7" ry="8" fill={eye} stroke="none" />
                  </>
                ) : (
                  <path d="M70 86q10-13 20 0M110 86q10-13 20 0" />
                )}
              </g>
              {state === "speaking" ? (
                <ellipse className="rb-mouth" cx="100" cy="99" rx="9" ry="6" fill={eye} stroke="none" />
              ) : (
                <path className="rb-mouth" d="M88 97q12 10 24 0" />
              )}
            </>
          )}
        </g>
        {/* yüz parıltısı */}
        <rect x="50" y="44" width="100" height="72" rx="32" fill="none" stroke={glow} strokeOpacity="0.25" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
