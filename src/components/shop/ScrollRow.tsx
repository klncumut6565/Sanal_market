"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Yatay kayan ürün sırası. Bilgisayarda solda/sağda ‹ › okları ile bir ekran kaydırır; telefonda parmakla kayar. */
export function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  const go = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };
  const btn =
    "absolute top-[38%] z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-lg ring-1 ring-line transition hover:bg-brand hover:text-white lg:grid";

  return (
    <div className="relative">
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto scroll-smooth px-4 pb-1 lg:mx-0 lg:px-0">
        {children}
      </div>
      {edge.left && (
        <button type="button" onClick={() => go(-1)} aria-label="Önceki ürünler" className={`${btn} -left-4`}>
          <ChevronLeft size={22} />
        </button>
      )}
      {edge.right && (
        <button type="button" onClick={() => go(1)} aria-label="Sonraki ürünler" className={`${btn} -right-4`}>
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
}
