"use client";
// Ürün sayfası görsel galerisi:
// - Masaüstü: fare görselin üzerindeyken mercek gibi yakınlaştırır (imlecin olduğu bölge büyür).
// - Tıklayınca / mobilde dokununca tam ekran görüntüleyici açılır: iki parmakla büyütme, çift dokunma,
//   büyütülmüşken sürükleme, kaydırarak görsel değiştirme, aşağı çekerek kapatma; masaüstünde tekerlek ile yakınlaştırma.
// Büyük boyutlu görsel yalnızca yakınlaştırma başladığında indirilir.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image, { getImageProps } from "next/image";
import { ChevronLeft, ChevronRight, Minus, Plus, X, ZoomIn } from "lucide-react";
import { ProductImage } from "./ProductImage";

const LENS_ZOOM = 2.5;
const MAX_SCALE = 5;

/** Yakınlaştırma için yüksek çözünürlüklü (≈1920 px) optimize edilmiş görsel adresi. */
const bigSrc = (src: string) => getImageProps({ src, alt: "", width: 960, height: 960 }).props.src;

export function ProductGallery({ images, emoji, alt }: { images: string[]; emoji: string | null; alt: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [canHover, setCanHover] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const set = () => setCanHover(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  if (!images.length) return <ProductImage src={null} emoji={emoji} alt={alt} size="lg" />;
  const many = images.length > 1;
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);

  return (
    <div className="space-y-2">
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-2xl bg-white ${canHover ? "cursor-zoom-in" : ""}`}
        onMouseMove={(e) => {
          if (!canHover) return;
          const r = e.currentTarget.getBoundingClientRect();
          setLens({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setLens(null)}
        onClick={() => {
          setLens(null);
          setOpen(true);
        }}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (many && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            e.preventDefault(); // kaydırma tıklama sayılmasın
            go(dx < 0 ? 1 : -1);
          }
        }}
      >
        <Image
          key={images[i]}
          src={images[i]}
          alt={many ? `${alt} — ${i + 1}/${images.length}` : alt}
          fill
          sizes="(max-width:768px) 100vw, 480px"
          className={`object-contain p-1 transition-opacity ${lens ? "opacity-0" : ""}`}
          priority={i === 0}
        />
        {lens && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-white bg-no-repeat"
            style={{
              backgroundImage: `url("${bigSrc(images[i])}")`,
              backgroundSize: `${LENS_ZOOM * 100}%`,
              backgroundPosition: `${lens.x}% ${lens.y}%`,
            }}
          />
        )}
        {!lens && (
          <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold text-white">
            <ZoomIn size={13} /> {canHover ? "Yakınlaştırmak için üzerine gel" : "Yakınlaştırmak için dokun"}
          </span>
        )}
        {many && !lens && (
          <>
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), go(-1))}
              aria-label="Önceki görsel"
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-line"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), go(1))}
              aria-label="Sonraki görsel"
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-line"
            >
              <ChevronRight size={20} />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold text-white">
              {i + 1}/{images.length}
            </span>
          </>
        )}
      </div>
      {many && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((u, k) => (
            <button
              key={u}
              type="button"
              onClick={() => setI(k)}
              aria-label={`Görsel ${k + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-2 ${k === i ? "ring-brand" : "ring-line"}`}
            >
              <Image src={u} alt="" fill sizes="64px" className="object-contain p-0.5" />
            </button>
          ))}
        </div>
      )}
      {open && <Viewer images={images} index={i} alt={alt} onIndex={setI} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------ tam ekran görüntüleyici
type T = { s: number; x: number; y: number };

function Viewer({ images, index, alt, onIndex, onClose }: { images: string[]; index: number; alt: string; onIndex: (i: number) => void; onClose: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<T>({ s: 1, x: 0, y: 0 });
  const [anim, setAnim] = useState(false);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: T; dist: number; cx: number; cy: number; px: number; py: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const many = images.length > 1;

  const clamp = useCallback((n: T): T => {
    const el = stage.current;
    const s = Math.min(MAX_SCALE, Math.max(1, n.s));
    if (!el || s === 1) return { s, x: 0, y: 0 };
    const mx = ((s - 1) * el.clientWidth) / 2;
    const my = ((s - 1) * el.clientHeight) / 2;
    return { s, x: Math.max(-mx, Math.min(mx, n.x)), y: Math.max(-my, Math.min(my, n.y)) };
  }, []);

  /** (px, py) ekran noktası sabit kalacak şekilde ölçek değiştir. */
  const zoomAt = useCallback(
    (s: number, px: number, py: number, from = tRef.current) => {
      const el = stage.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const ox = px - (r.left + r.width / 2);
      const oy = py - (r.top + r.height / 2);
      const k = Math.min(MAX_SCALE, Math.max(1, s)) / from.s;
      setT(clamp({ s: from.s * k, x: ox - (ox - from.x) * k, y: oy - (oy - from.y) * k }));
    },
    [clamp],
  );

  const show = useCallback(
    (d: number) => {
      setAnim(false);
      setT({ s: 1, x: 0, y: 0 });
      onIndex((index + d + images.length) % images.length);
    },
    [index, images.length, onIndex],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && many) show(1);
      else if (e.key === "ArrowLeft" && many) show(-1);
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", key);
    };
  }, [onClose, show, many]);

  // Tekerlek ile yakınlaştırma (pasif olmayan dinleyici: sayfa kaymasın)
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setAnim(false);
      zoomAt(tRef.current.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomAt]);

  const startGesture = () => {
    const p = [...pts.current.values()];
    const cx = p.reduce((a, q) => a + q.x, 0) / p.length;
    const cy = p.reduce((a, q) => a + q.y, 0) / p.length;
    const dist = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    gesture.current = { start: tRef.current, dist, cx, cy, px: cx, py: cy, moved: gesture.current?.moved ?? false };
  };

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pts.current.size === 0) gesture.current = null;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnim(false);
    startGesture();
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId) || !gesture.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const p = [...pts.current.values()];
    const cx = p.reduce((a, q) => a + q.x, 0) / p.length;
    const cy = p.reduce((a, q) => a + q.y, 0) / p.length;
    if (Math.hypot(cx - g.cx, cy - g.cy) > 6) g.moved = true;
    g.px = cx;
    g.py = cy;
    if (p.length > 1 && g.dist > 0) {
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      g.moved = true;
      // önce ölçek (başlangıç merkezine göre), sonra parmakların kaymasıyla taşıma
      const el = stage.current!;
      const r = el.getBoundingClientRect();
      const ox = g.cx - (r.left + r.width / 2);
      const oy = g.cy - (r.top + r.height / 2);
      const s = Math.min(MAX_SCALE, Math.max(1, (g.start.s * d) / g.dist));
      const k = s / g.start.s;
      setT(clamp({ s, x: ox - (ox - g.start.x) * k + (cx - g.cx), y: oy - (oy - g.start.y) * k + (cy - g.cy) }));
    } else if (g.start.s > 1) {
      setT(clamp({ s: g.start.s, x: g.start.x + (cx - g.cx), y: g.start.y + (cy - g.cy) }));
    } else {
      // büyütülmemişken: görseli parmakla birlikte kaydır (geçiş / kapatma için)
      setT({ s: 1, x: cx - g.cx, y: Math.max(0, cy - g.cy) });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.delete(e.pointerId);
    const g = gesture.current;
    if (pts.current.size > 0) {
      startGesture(); // bir parmak kaldı: kaldığı yerden devam
      return;
    }
    if (!g) return;
    const dx = g.px - g.cx;
    const dy = g.py - g.cy;
    if (!g.moved) {
      // dokunma / tıklama: çift dokunmada yakınlaştır-uzaklaştır
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        setAnim(true);
        if (tRef.current.s > 1) setT({ s: 1, x: 0, y: 0 });
        else zoomAt(2.5, e.clientX, e.clientY);
      } else lastTap.current = now;
      return;
    }
    if (g.start.s === 1 && tRef.current.s === 1) {
      setAnim(true);
      if (many && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) show(dx < 0 ? 1 : -1);
      else if (dy > 110 && Math.abs(dy) > Math.abs(dx)) onClose();
      else setT({ s: 1, x: 0, y: 0 });
    }
  };

  const src = bigSrc(images[index]);
  const btn = "grid h-11 w-11 place-items-center rounded-full bg-black/5 text-ink ring-1 ring-line backdrop-blur hover:bg-black/10";

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={`${alt} görseli`}>
      <div className="flex items-center justify-between gap-2 border-b border-line p-3">
        <span className="min-w-0 truncate text-sm font-semibold">
          {alt}
          {many && <span className="ml-2 text-muted">{index + 1}/{images.length}</span>}
        </span>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={btn} aria-label="Uzaklaştır" onClick={() => (setAnim(true), setT((p) => clamp({ ...p, s: p.s / 1.5, x: p.x / 1.5, y: p.y / 1.5 })))}>
            <Minus size={20} />
          </button>
          <button type="button" className={btn} aria-label="Yakınlaştır" onClick={() => (setAnim(true), setT((p) => clamp({ ...p, s: p.s * 1.5, x: p.x * 1.5, y: p.y * 1.5 })))}>
            <Plus size={20} />
          </button>
          <button type="button" className={btn} aria-label="Kapat" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
      </div>

      <div
        ref={stage}
        className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden ${t.s > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- dönüşüm (transform) ile yakınlaştırılan büyük görsel */}
        <img
          key={src}
          src={src}
          alt={alt}
          draggable={false}
          className={`absolute inset-0 m-auto h-full w-full object-contain ${anim ? "transition-transform duration-200" : ""}`}
          style={{ transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.s})`, opacity: t.s === 1 && t.y > 0 ? Math.max(0.3, 1 - t.y / 400) : 1 }}
        />
        {many && (
          <>
            <button type="button" onClick={() => show(-1)} aria-label="Önceki görsel" className={`${btn} absolute left-3 top-1/2 -translate-y-1/2`}>
              <ChevronLeft size={24} />
            </button>
            <button type="button" onClick={() => show(1)} aria-label="Sonraki görsel" className={`${btn} absolute right-3 top-1/2 -translate-y-1/2`}>
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>
      <p className="p-3 text-center text-xs text-muted">İki parmakla veya çift dokunarak yakınlaştır · aşağı çekerek kapat</p>
    </div>,
    document.body,
  );
}
