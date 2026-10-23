"use client";
// Sesli asistan penceresi gizlenince (sohbet sürerken) sayfanın ORTA ALT kısmında görünen, yarı saydam
// küçük "enerji küresi". TMGD'deki VoiceOrbOverlay'in küçültülmüş, tüm ekranı kaplamayan sürümü.
// • Sayfa normal kullanılır (pointer-events: none); yalnızca küre (pencereyi açar) ve "Bitir" tıklanır.
// • Ses verisi her karede getter'lardan okunur (React render'ı yok):
//     asistan konuşurken → çalınan sesin AnalyserNode'u (gerçek ses)
//     dinlerken / müşteri konuşurken → gürültü kapısından geçen mikrofon seviyesi
// • prefers-reduced-motion: dönme/parçacık hareketi durur, yalnızca parlaklık sese tepki verir.
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { VoiceState } from "@/lib/voice/types";
import { AnalizOkuyucu, yumusat } from "@/lib/voice/sesAnalizi";

const KURE_OPAKLIK = 0.72;

const ETIKET: Record<VoiceState, string> = {
  idle: "",
  connecting: "BAĞLANIYOR",
  listening: "DİNLİYOR",
  user_speaking: "SENİ DUYUYOR",
  processing: "DÜŞÜNÜYOR",
  tool_calling: "MARKETE BAKIYOR",
  speaking: "KONUŞUYOR",
  reconnecting: "YENİDEN BAĞLANIYOR",
  error: "HATA",
};

export type OrbTema = "market" | "yonetim";

/** Durum → [ton, doygunluk %, yoğunluk 0..1] — marka yeşili / turkuaz tonları (müşteri) */
const PALET_MARKET: Record<VoiceState, [number, number, number]> = {
  idle: [168, 70, 0],
  connecting: [180, 25, 0.5],
  listening: [170, 78, 0.72],
  user_speaking: [190, 88, 0.95],
  processing: [38, 85, 0.85],
  tool_calling: [205, 80, 0.85],
  speaking: [160, 85, 1],
  reconnecting: [180, 25, 0.5],
  error: [0, 80, 0.6],
};

/** Yönetim asistanı: pembe → mor skala (fuşya / orkide / menekşe) */
const PALET_YONETIM: Record<VoiceState, [number, number, number]> = {
  idle: [300, 70, 0],
  connecting: [290, 30, 0.5],
  listening: [305, 82, 0.72],
  user_speaking: [285, 90, 0.95],
  processing: [325, 88, 0.85],
  tool_calling: [270, 82, 0.85],
  speaking: [315, 92, 1],
  reconnecting: [290, 30, 0.5],
  error: [0, 80, 0.6],
};
const PALETLER: Record<OrbTema, Record<VoiceState, [number, number, number]>> = { market: PALET_MARKET, yonetim: PALET_YONETIM };

type Halka = { rx: number; oran: number; egim: number; hiz: number; f1: number; f2: number; k1: number; k2: number; bant: 0 | 1 | 2 };
type Parcacik = { r: number; a: number; w: number; boy: number; ph: number };
type Kivilcim = { x: number; y: number; vx: number; vy: number; omur: number; maks: number };

function rastgeleUret(tohum: number) {
  let s = tohum >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function VoiceOrb({
  durum,
  asistanAnalyser,
  kullaniciSeviyesi,
  onAc,
  onBitir,
  raised = false,
  tema = "market",
  konumClass,
}: {
  durum: VoiceState;
  asistanAnalyser: () => AnalyserNode | null;
  kullaniciSeviyesi: () => number;
  onAc: () => void;
  onBitir: () => void;
  /** Mobilde alttaki sepet çubuğu görünüyorsa biraz daha yukarıda dur */
  raised?: boolean;
  /** Renk teması: "market" yeşil/turkuaz, "yonetim" pembe-mor */
  tema?: OrbTema;
  /** Konum sınıflarını tamamen değiştirmek için (ör. yönetim panelinde yan menü payı) */
  konumClass?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ durum, asistanAnalyser, kullaniciSeviyesi, palet: PALETLER[tema] });
  useEffect(() => {
    propsRef.current = { durum, asistanAnalyser, kullaniciSeviyesi, palet: PALETLER[tema] };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let S = 0; // kutu kenarı (CSS px)
    const boyutla = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      S = canvas.clientWidth || 200;
      canvas.width = Math.round(S * dpr);
      canvas.height = Math.round(S * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    boyutla();
    window.addEventListener("resize", boyutla);

    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let azHareket = !!mq?.matches;
    const mqDegisti = (e: MediaQueryListEvent) => {
      azHareket = e.matches;
    };
    mq?.addEventListener?.("change", mqDegisti);

    const rnd = rastgeleUret(20261023);
    const halkalar: Halka[] = Array.from({ length: 6 }, (_, i) => ({
      rx: 1.35 + rnd() * 0.5,
      oran: 0.55 + rnd() * 0.4,
      egim: rnd() * Math.PI,
      hiz: (rnd() < 0.5 ? -1 : 1) * (0.05 + rnd() * 0.13),
      f1: rnd() * Math.PI * 2,
      f2: rnd() * Math.PI * 2,
      k1: 2 + Math.floor(rnd() * 2),
      k2: 4 + Math.floor(rnd() * 2),
      bant: (i % 3) as 0 | 1 | 2,
    }));
    const parcaciklar: Parcacik[] = Array.from({ length: 90 }, () => ({
      r: Math.pow(rnd(), 1.8),
      a: rnd() * Math.PI * 2,
      w: (rnd() - 0.5) * 0.6,
      boy: 0.6 + rnd() * 1.1,
      ph: rnd() * Math.PI * 2,
    }));
    const kivilcimlar: Kivilcim[] = [];

    const okuyucu = new AnalizOkuyucu();
    let enerji = 0;
    let [ton, doyg] = propsRef.current.palet.listening;
    let yogun = 0;
    let zaman = 0;
    const bantlar: [number, number, number] = [0, 0, 0];
    let onceki = performance.now();
    let rafId = 0;

    const tonYumusat = (m: number, h: number, dt: number) => {
      let f = ((h - m + 540) % 360) - 180;
      f *= 1 - Math.exp(-dt / 0.35);
      return (m + f + 360) % 360;
    };

    const ciz = (simdi: number) => {
      rafId = requestAnimationFrame(ciz);
      const dt = Math.min(0.1, Math.max(0.001, (simdi - onceki) / 1000));
      onceki = simdi;
      const { durum: d, asistanAnalyser: getA, kullaniciSeviyesi: getK, palet: PALET } = propsRef.current;
      if (!azHareket) zaman += dt;
      const t = zaman;
      const sn = simdi / 1000;

      let hedefE = 0.04;
      let hedefB: [number, number, number] = [0.3, 0.3, 0.3];
      if (d === "speaking") {
        const o = okuyucu.oku(getA());
        if (o) {
          hedefE = o.seviye;
          hedefB = [o.alcak, o.orta, o.yuksek];
        }
      } else if (d === "listening" || d === "user_speaking") {
        hedefE = Math.max(0.03, Math.min(1, getK()));
      } else if (d === "processing" || d === "tool_calling") {
        hedefE = azHareket ? 0.18 : 0.14 + 0.08 * Math.sin(sn * 3.2);
      } else if (d === "connecting" || d === "reconnecting") {
        hedefE = azHareket ? 0.06 : 0.05 + 0.04 * Math.sin(sn * 2.5);
      }
      enerji = yumusat(enerji, hedefE, dt, azHareket ? 0.2 : 0.05, azHareket ? 0.4 : 0.18);
      for (let i = 0; i < 3; i++) bantlar[i] = yumusat(bantlar[i], hedefB[i], dt, 0.06, 0.2);
      const [hT, hD, hY] = PALET[d];
      ton = tonYumusat(ton, hT, dt);
      doyg = yumusat(doyg, hD, dt, 0.3, 0.3);
      yogun = yumusat(yogun, hY, dt, 0.4, 0.4);
      const e = enerji;
      const I = Math.max(yogun, 0.25); // gizli modda küre hep biraz görünür

      const cx = S / 2;
      const cy = S / 2;
      const R = S * 0.2;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, S, S);

      // Pus (kutu kenarına varmadan tamamen saydam)
      const pus = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, S / 2);
      pus.addColorStop(0, `hsla(${ton},${doyg}%,32%,${0.22 * I})`);
      pus.addColorStop(0.6, `hsla(${ton},${doyg}%,26%,${0.08 * I})`);
      pus.addColorStop(1, `hsla(${ton},${doyg}%,20%,0)`);
      ctx.fillStyle = pus;
      ctx.fillRect(0, 0, S, S);

      // Küre gövdesi
      const govde = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R);
      govde.addColorStop(0, `hsla(${ton - 12},70%,30%,${0.45 * I})`);
      govde.addColorStop(1, `hsla(${ton - 18},75%,14%,${0.55 * I})`);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = govde;
      ctx.fill();

      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `hsla(${ton + 10},90%,78%,${0.08 * I})`;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = `hsla(${ton + 10},90%,85%,${(0.45 + e * 0.3) * I})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // İç kesikli halka
      ctx.save();
      ctx.setLineDash([R * 0.22, R * 0.16]);
      ctx.lineDashOffset = -t * R * 0.25;
      ctx.beginPath();
      ctx.arc(cx, cy, R * (0.62 + e * 0.05), 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${ton + 30},90%,72%,${0.5 * I})`;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();

      // Parlak çekirdek + parçacıklar
      const Rc = R * (0.26 + 0.24 * e);
      const ck = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rc);
      ck.addColorStop(0, `rgba(255,255,255,${0.95 * I})`);
      ck.addColorStop(0.35, `hsla(${ton + 30},100%,82%,${0.45 * I})`);
      ck.addColorStop(1, `hsla(${ton + 30},100%,70%,0)`);
      ctx.fillStyle = ck;
      ctx.fillRect(cx - Rc, cy - Rc, Rc * 2, Rc * 2);
      const bulutR = R * 0.48 * (1 + e * 0.45);
      ctx.fillStyle = `hsla(${ton + 40},100%,90%,${0.7 * I})`;
      for (const p of parcaciklar) {
        const a = p.a + t * p.w;
        const r = p.r * bulutR;
        const parla = 0.5 + 0.5 * Math.sin(t * 3 + p.ph);
        if (parla < 0.25) continue;
        const boy = p.boy * (0.6 + parla * 0.6);
        ctx.fillRect(cx + Math.cos(a) * r - boy / 2, cy + Math.sin(a) * r - boy / 2, boy, boy);
      }

      // Yörünge halkaları — sese göre şekil değiştirir (açık zeminde de seçilsin diye normal karışım)
      ctx.globalCompositeOperation = "source-over";
      const N = 80;
      for (let i = 0; i < halkalar.length; i++) {
        const h = halkalar[i];
        const rot = h.egim + t * h.hiz;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const amp = 0.035 + e * (0.12 + 0.14 * bantlar[h.bant]);
        const rx = h.rx * R * (1 + e * 0.08);
        const ry = rx * h.oran;
        ctx.beginPath();
        for (let j = 0; j <= N; j++) {
          const th = (j / N) * Math.PI * 2;
          const dz = 1 + amp * (0.6 * Math.sin(h.k1 * th + t * 0.9 + h.f1) + 0.4 * Math.sin(h.k2 * th - t * 1.3 + h.f2));
          const ex = Math.cos(th) * rx * dz;
          const ey = Math.sin(th) * ry * dz;
          const x = cx + ex * cosR - ey * sinR;
          const y = cy + ex * sinR + ey * cosR;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const hh = ton + i * 5;
        ctx.strokeStyle = `hsla(${hh},90%,55%,${0.08 * I})`;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = `hsla(${hh + 10},95%,42%,${(0.45 + e * 0.4) * I})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "lighter";

      // Kıvılcımlar (ses arttıkça çoğalır; kutunun içinde kalır)
      if (!azHareket && Math.random() < (0.6 + e * 6) * dt * 10 && kivilcimlar.length < 40) {
        const a = Math.random() * Math.PI * 2;
        const r0 = R * (1 + Math.random() * 0.6);
        const v = R * (0.08 + Math.random() * 0.2);
        kivilcimlar.push({ x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, omur: 0, maks: 1.2 + Math.random() * 1.6 });
      }
      for (let k = kivilcimlar.length - 1; k >= 0; k--) {
        const s = kivilcimlar[k];
        s.omur += dt;
        if (s.omur > s.maks) {
          kivilcimlar.splice(k, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        ctx.fillStyle = `hsla(${ton + 30},100%,88%,${Math.sin((s.omur / s.maks) * Math.PI) * 0.8 * I})`;
        ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
      }
      ctx.globalCompositeOperation = "source-over";
    };
    rafId = requestAnimationFrame(ciz);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", boyutla);
      mq?.removeEventListener?.("change", mqDegisti);
      okuyucu.birak();
    };
  }, []);

  const etiket = tema === "yonetim" && durum === "tool_calling" ? "VERİLERE BAKIYOR" : ETIKET[durum];
  const rozet = tema === "yonetim" ? "bg-[#3b1252]/55 hover:bg-[#3b1252]/85" : "bg-navy/45 hover:bg-navy/80";
  const konum =
    konumClass ??
    `left-1/2 -translate-x-1/2 lg:bottom-3 ${raised ? "bottom-[calc(124px+env(safe-area-inset-bottom))]" : "bottom-[calc(60px+env(safe-area-inset-bottom))]"}`;
  return (
    <div data-asistan-ui className={`pointer-events-none fixed z-40 flex flex-col items-center ${konum}`}>
      <div className="relative h-[170px] w-[170px] sm:h-[200px] sm:w-[200px]">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" style={{ opacity: KURE_OPAKLIK }} />
        <button
          type="button"
          onClick={onAc}
          aria-label="Sesli asistan penceresini aç"
          title="Pencereyi aç"
          className="pointer-events-auto absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        />
      </div>
      <div className="-mt-5 flex items-center gap-1.5">
        {etiket && (
          <span className={`rounded-full ${rozet} px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.25em] text-white backdrop-blur-sm`}>{etiket}</span>
        )}
        <button
          type="button"
          onClick={onBitir}
          aria-label="Sesli sohbeti bitir"
          title="Bitir"
          className={`pointer-events-auto grid h-6 w-6 place-items-center rounded-full ${rozet} text-white backdrop-blur-sm`}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
