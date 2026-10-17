"use client";
// Mağaza içi satış ekranı (kasa). Barkod okuyucu / arama / hızlı ürün kutucukları ile fiş oluşturur,
// nakit-kart-karışık ödeme alır, stoktan düşer (pos_complete_sale), fiş yazdırır, bekletme ve iptal destekler.
import { InlineScanner } from "@/components/admin/InlineScanner";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CategoryIcon } from "@/components/shop/CategoryIcon";
import {
  Banknote,
  CreditCard,
  History,
  Keyboard,
  Loader2,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  Search,
  ShoppingBasket,
  SplitSquareHorizontal,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTL } from "@/lib/format";
import { parseNumTR } from "@/lib/numTR";
import { useHidScanner } from "@/lib/hidScanner";
import { PosHistory } from "./PosHistory";
import { PosReceipt, type ReceiptData } from "./PosReceipt";
import { fold, posError, r2, unitPrice, type PosLine, type PosProduct, type PosStore } from "./posTypes";

type Cat = { id: string; name: string; emoji: string | null; image_url?: string | null; parent_id?: string | null; sort_order?: number };
type PayMode = "nakit" | "kart" | "karisik";
type Held = { id: string; at: number; lines: PosLine[]; discount: string };

const LS_CART = "pos-fis-v1";
const LS_HELD = "pos-bekleyen-v1";
const BILLS = [5, 10, 20, 50, 100, 200, 500, 1000];
// Ürün kutucuk listesi (tüm ürünlerin tarayıcıya indirilmesi) şimdilik KAPALI — Supabase veri çıkışını azaltmak için.
// Kapalıyken barkod ve ad araması tek tek, küçük sorgularla veritabanından yapılır. Tekrar açmak için true yapın.
const PRODUCT_LIST_ENABLED = false;
const POS_COLS = "id,name,barcode,price,sale_price,stock,category_id,unit_label,image_url,emoji,is_active";

const lsGet = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const lsSet = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
let lineSeq = 0;
const newKey = () => `l${Date.now().toString(36)}${(lineSeq++).toString(36)}`;
const beep = (ok = true) => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1250 : 320;
    g.gain.value = 0.06;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.07 : 0.25));
    o.onended = () => void ctx.close();
  } catch {}
};

export function PosScreen({ store, categories }: { store: PosStore; categories: Cat[] }) {
  const sb = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<PosProduct[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [lines, setLines] = useState<PosLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [held, setHeld] = useState<Held[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [multiplier, setMultiplier] = useState(1);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [pay, setPay] = useState<PayMode | null>(null);
  const [manual, setManual] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [done, setDone] = useState<ReceiptData | null>(null);
  const [today, setToday] = useState<{ total: number; count: number } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const restored = useRef(false);

  // ---------------- veri ----------------
  const loadProducts = useCallback(async () => {
    if (!PRODUCT_LIST_ENABLED) return;
    const all: PosProduct[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from("products")
        .select(POS_COLS)
        .order("name")
        .range(from, from + 999);
      if (error) {
        setLoadErr("Ürünler yüklenemedi: " + error.message);
        return;
      }
      all.push(...((data ?? []) as PosProduct[]));
      if (!data || data.length < 1000) break;
    }
    setProducts(all);
  }, [sb]);

  const loadToday = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await sb.from("pos_sales").select("total").is("voided_at", null).gte("created_at", start.toISOString());
    setToday({ total: (data ?? []).reduce((a, r) => a + Number(r.total), 0), count: data?.length ?? 0 });
  }, [sb]);

  useEffect(() => {
    const t0 = setTimeout(() => {
      void loadProducts();
      void loadToday();
      setNow(new Date());
    }, 0);
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [loadProducts, loadToday]);

  // Fiş ve bekleyenler sayfa yenilense de kaybolmasın
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      const c = lsGet<{ lines: PosLine[]; discount: string }>(LS_CART, { lines: [], discount: "" });
      setLines(c.lines ?? []);
      setDiscount(c.discount ?? "");
      setHeld(lsGet<Held[]>(LS_HELD, []));
      return;
    }
    lsSet(LS_CART, { lines, discount });
  }, [lines, discount]);
  useEffect(() => {
    if (restored.current) lsSet(LS_HELD, held);
  }, [held]);

  const byBarcode = useMemo(() => {
    const m = new Map<string, PosProduct>();
    for (const p of products ?? []) if (p.barcode) m.set(p.barcode.trim(), p);
    return m;
  }, [products]);

  // ---------------- fiş işlemleri ----------------
  const say = (ok: boolean, text: string) => {
    setFlash({ ok, text });
    beep(ok);
  };

  const addProduct = useCallback(
    (p: PosProduct, qty = 1) => {
      const price = unitPrice(p);
      let key = "";
      setLines((ls) => {
        const i = ls.findIndex((l) => l.product_id === p.id && l.price === price);
        if (i >= 0) {
          key = ls[i].key;
          const next = [...ls];
          next[i] = { ...next[i], qty: r2(next[i].qty + qty) };
          // en son eklenen en üstte
          const [it] = next.splice(i, 1);
          return [it, ...next];
        }
        key = newKey();
        return [{ key, product_id: p.id, name: p.name, barcode: p.barcode, price, qty, stock: p.stock }, ...ls];
      });
      setTimeout(() => setSelected(key), 0);
      setMultiplier(1);
      const warn = !p.is_active ? " · (satışta değil)" : p.stock <= 0 ? " · stok 0" : "";
      setFlash({ ok: true, text: `${qty > 1 ? `${qty} × ` : ""}${p.name} — ${formatTL(price)}${warn}` });
      beep(true);
    },
    [],
  );

  // Liste kapalıyken barkodla tek ürün sorgusu (aynı barkod oturum boyunca tekrar sorgulanmaz)
  const codeCache = useRef(new Map<string, PosProduct>());
  const onCode = useCallback(
    (raw: string): boolean | void => {
      const code = raw.trim();
      if (!code) return false;
      const alt = code.replace(/^0+/, "");
      if (PRODUCT_LIST_ENABLED) {
        const p = byBarcode.get(code) ?? byBarcode.get(alt);
        if (p) addProduct(p, multiplier);
        else say(false, `Barkod bulunamadı: ${code}`);
        return !!p;
      }
      const qty = multiplier;
      const cached = codeCache.current.get(code);
      if (cached) {
        addProduct(cached, qty);
        return true;
      }
      void (async () => {
        const { data } = await sb
          .from("products")
          .select(POS_COLS)
          .in("barcode", alt && alt !== code ? [code, alt] : [code])
          .limit(1)
          .maybeSingle();
        const p = (data as PosProduct | null) ?? null;
        if (p) {
          codeCache.current.set(code, p);
          addProduct(p, qty);
        } else say(false, `Barkod bulunamadı: ${code}`);
      })();
    },
    [byBarcode, addProduct, multiplier, sb],
  );

  // El barkod okuyucu: ekranın neresinde olursa olsun ürünü fişe ekler (pencere açıkken yok sayar)
  const busy = !!pay || manual || !!done || showHistory;
  useHidScanner((code) => {
    if (!busy) onCode(code);
    return true;
  });

  const setQty = (key: string, qty: number) =>
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.key !== key) : ls.map((l) => (l.key === key ? { ...l, qty: r2(qty) } : l))));
  const setPrice = (key: string, price: number) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, price: r2(price) } : l)));
  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));
  const clearSale = () => {
    setLines([]);
    setDiscount("");
    setSelected(null);
    setMultiplier(1);
  };

  const subtotal = r2(lines.reduce((a, l) => a + l.price * l.qty, 0));
  const discountAmt = useMemo(() => {
    const d = discount.trim();
    if (!d) return 0;
    if (d.endsWith("%")) {
      const p = parseNumTR(d.slice(0, -1));
      return p && p > 0 ? r2(Math.min(subtotal, (subtotal * p) / 100)) : 0;
    }
    const v = parseNumTR(d);
    return v && v > 0 ? r2(Math.min(subtotal, v)) : 0;
  }, [discount, subtotal]);
  const total = r2(subtotal - discountAmt);
  const itemCount = lines.reduce((a, l) => a + l.qty, 0);

  const holdSale = () => {
    if (!lines.length) return;
    setHeld((h) => [{ id: newKey(), at: Date.now(), lines, discount }, ...h].slice(0, 10));
    clearSale();
    say(true, "Fiş bekletmeye alındı.");
  };
  const resumeSale = (id: string) => {
    const h = held.find((x) => x.id === id);
    if (!h) return;
    if (lines.length) setHeld((hs) => [{ id: newKey(), at: Date.now(), lines, discount }, ...hs.filter((x) => x.id !== id)]);
    else setHeld((hs) => hs.filter((x) => x.id !== id));
    setLines(h.lines);
    setDiscount(h.discount);
  };

  // ---------------- arama ----------------
  // Ana kategori seçilince alt kategorilerinin ürünleri de gelir
  const catSet = useMemo(() => {
    if (!cat) return null;
    return new Set([cat, ...categories.filter((c) => c.parent_id === cat).map((c) => c.id)]);
  }, [cat, categories]);
  const topCats = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const activeTop = cat ? (categories.find((c) => c.id === cat)?.parent_id ?? cat) : "";
  const subCats = useMemo(() => (activeTop ? categories.filter((c) => c.parent_id === activeTop) : []), [activeTop, categories]);

  // Arama dizini: Türkçe-katlanmış adlar bir kez hesaplanır (her tuşta 3000+ ad yeniden işlenmez)
  const index = useMemo(() => (products ?? []).map((p) => ({ p, n: fold(p.name) })), [products]);
  // Yazarken arayüz takılmasın: arama bir sonraki karede çalışır
  const dq = useDeferredValue(q);

  const results = useMemo(() => {
    if (!products) return [];
    const q = dq;
    const m = q.trim().match(/^(\d+)\*(.*)$/);
    const text = fold(m ? m[2] : q);
    if (!text) {
      const pool = catSet ? products.filter((p) => !!p.category_id && catSet.has(p.category_id)) : products.filter((p) => p.is_active && p.stock > 0);
      return pool.slice(0, catSet ? 120 : 48);
    }
    const words = text.split(" ");
    const scored: { p: PosProduct; s: number }[] = [];
    for (const { p, n } of index) {
      if (catSet && !(p.category_id && catSet.has(p.category_id))) continue;
      if (p.barcode && p.barcode.startsWith(text)) scored.push({ p, s: 0 });
      else if (words.every((w) => n.includes(w))) scored.push({ p, s: n.startsWith(text) ? 1 : n.split(" ").some((w) => w.startsWith(words[0])) ? 2 : 3 });
    }
    scored.sort((a, b) => a.s - b.s || Number(b.p.is_active) - Number(a.p.is_active) || a.p.name.localeCompare(b.p.name, "tr"));
    return scored.slice(0, 60).map((x) => x.p);
  }, [products, index, dq, catSet]);

  // Liste kapalıyken ad araması: yazmayı bırakınca en fazla 8 ürün sorgulanır
  const [remote, setRemote] = useState<PosProduct[]>([]);
  const [remoteBusy, setRemoteBusy] = useState(false);
  useEffect(() => {
    if (PRODUCT_LIST_ENABLED) return;
    const m = q.trim().match(/^(\d+)\*(.*)$/);
    const text = (m ? m[2] : q).trim();
    if (text.length < 2 || /^\d+$/.test(text)) {
      const t = setTimeout(() => setRemote([]), 0);
      return () => clearTimeout(t);
    }
    let alive = true;
    const t = setTimeout(async () => {
      setRemoteBusy(true);
      const words = text.replace(/[%_,()]/g, " ").split(/\s+/).filter(Boolean).slice(0, 4);
      let qq = sb.from("products").select(POS_COLS);
      for (const w of words) qq = qq.ilike("name", `%${w}%`);
      const { data } = await qq.order("is_active", { ascending: false }).order("name").limit(8);
      if (!alive) return;
      setRemote((data ?? []) as PosProduct[]);
      setRemoteBusy(false);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, sb]);
  const shown = PRODUCT_LIST_ENABLED ? results : remote;

  const submitSearch = () => {
    const v = q.trim();
    const m = v.match(/^(\d+)\*(.*)$/);
    if (m) {
      setMultiplier(Math.max(1, Number(m[1])));
      if (!m[2].trim()) {
        setQ("");
        setFlash({ ok: true, text: `Sonraki ürün ${m[1]} adet eklenecek.` });
        return;
      }
    }
    const rest = m ? m[2].trim() : v;
    if (/^\d{6,}$/.test(rest)) {
      onCode(rest);
      setQ("");
      return;
    }
    if (shown[0]) {
      addProduct(shown[0], m ? Math.max(1, Number(m[1])) : multiplier);
      setQ("");
    }
  };

  // ---------------- kısayollar ----------------
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (pay || manual || done) return;
      const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        setManual(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        holdSale();
      } else if (e.key === "F8" && lines.length) {
        e.preventDefault();
        setPay("nakit");
      } else if (e.key === "F9" && lines.length) {
        e.preventDefault();
        setPay("kart");
      } else if (e.key === "F10" && lines.length) {
        e.preventDefault();
        setPay("karisik");
      } else if (!inField && selected && (e.key === "+" || e.key === "-")) {
        e.preventDefault();
        const l = lines.find((x) => x.key === selected);
        if (l) setQty(l.key, l.qty + (e.key === "+" ? 1 : -1));
      } else if (!inField && selected && e.key === "Delete") {
        e.preventDefault();
        removeLine(selected);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // ---------------- satış tamamla ----------------
  const [saving, setSaving] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const complete = async (mode: PayMode, cash: number, card: number) => {
    setSaving(true);
    setPayErr(null);
    const items = lines.map((l) => ({ product_id: l.product_id, name: l.name, barcode: l.barcode, price: l.price, qty: l.qty }));
    const { data, error } = await sb.rpc("pos_complete_sale", {
      p_items: items,
      p_payment: mode,
      p_cash: cash,
      p_card: card,
      p_discount: discountAmt,
      p_note: null,
    });
    setSaving(false);
    if (error) {
      setPayErr(posError(error.message));
      beep(false);
      return;
    }
    const r = data as { id: string; sale_no: number; total: number; paid: number; change: number };
    setDone({
      saleNo: r.sale_no,
      at: new Date().toISOString(),
      lines: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
      subtotal,
      discount: discountAmt,
      total: Number(r.total),
      payment: mode,
      cash,
      card: mode === "kart" ? Number(r.total) : card,
      change: Number(r.change),
    });
    // stokları yerelde güncelle
    setProducts((ps) =>
      ps?.map((p) => {
        const sold = lines.filter((l) => l.product_id === p.id).reduce((a, l) => a + Math.ceil(l.qty), 0);
        return sold ? { ...p, stock: Math.max(0, p.stock - sold) } : p;
      }) ?? ps,
    );
    setPay(null);
    clearSale();
    void loadToday();
    beep(true);
  };

  const selectedLine = lines.find((l) => l.key === selected);

  // ---------------- görünüm ----------------
  return (
    <div className="pos-ekrani -mx-1 space-y-3 lg:-mx-4">
      {/* Üst bar */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <ShoppingBasket className="text-brand" /> Satış ekranı
        </h1>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-muted ring-1 ring-line">
          {now ? now.toLocaleString("tr-TR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "…"}
        </span>
        {today && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
            Bugün kasa: {formatTL(today.total)} · {today.count} fiş
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowKeys((v) => !v)} className="btn-ghost py-2 text-sm">
            <Keyboard size={16} /> Kısayollar
          </button>
          <button onClick={() => setShowHistory(true)} className="btn-ghost py-2 text-sm">
            <History size={16} /> Son satışlar
          </button>
        </div>
      </div>
      {showKeys && (
        <div className="grid gap-1 rounded-2xl bg-ink p-3 text-xs text-white sm:grid-cols-4">
          {[
            ["F2", "Arama / barkod kutusu"],
            ["3*", "Sonraki ürün 3 adet (ör. 3* yazıp okut)"],
            ["F4", "Serbest tutar ekle"],
            ["F6", "Fişi beklet"],
            ["F8", "Nakit ödeme"],
            ["F9", "Kartla ödeme"],
            ["F10", "Nakit + kart"],
            ["+ / −", "Seçili satır adedi"],
            ["Delete", "Seçili satırı sil"],
            ["Enter", "Aramadaki ilk ürünü ekle"],
          ].map(([k, v]) => (
            <p key={k}>
              <kbd className="mr-1.5 rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold">{k}</kbd>
              {v}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* SOL: arama + ürünler */}
        <section className="min-w-0 space-y-3">
          {/* Arama (daraltıldı) + sağında kameradan barkod / QR okuma alanı */}
          <div className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            className="relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={22} />
            <input
              ref={searchRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQ("")}
              placeholder="Barkod veya ürün adı (F2) — Enter ekler"
              className="h-14 w-full rounded-2xl border-2 border-line bg-white pl-12 pr-20 text-lg font-semibold outline-none focus:border-brand"
            />
            {multiplier > 1 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-brand px-3 py-1 text-sm font-black text-white">× {multiplier}</span>
            )}
          </form>
            <InlineScanner onResult={onCode} />
          </div>

          {flash && (
            <p
              className={`rounded-xl px-4 py-2 text-sm font-bold ${flash.ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"}`}
            >
              {flash.text}
            </p>
          )}

          {!PRODUCT_LIST_ENABLED && (
            <div className="rounded-2xl bg-white ring-1 ring-line">
              {q.trim().length >= 2 && !/^\d+$/.test(q.trim()) ? (
                <ul className="divide-y divide-line">
                  {remote.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => {
                          addProduct(p, multiplier);
                          setQ("");
                          searchRef.current?.focus();
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-bg ${!p.is_active ? "opacity-50" : ""}`}
                      >
                        <span className="min-w-0 truncate text-sm font-bold">{p.name}</span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className={`text-[11px] font-bold ${p.stock <= 0 ? "text-red-600" : "text-muted"}`}>{p.stock <= 0 ? "stok 0" : `stok ${p.stock}`}</span>
                          <span className="font-black text-brand">{formatTL(unitPrice(p))}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {!remote.length && (
                    <li className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
                      {remoteBusy ? (
                        <>
                          <Loader2 className="animate-spin" size={16} /> Aranıyor…
                        </>
                      ) : (
                        "Ürün bulunamadı."
                      )}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-muted">Ürün listesi şimdilik kapalı. Barkodu okutun ya da ürün adını yazın — eşleşen ürünler burada çıkar.</p>
              )}
            </div>
          )}

          {PRODUCT_LIST_ENABLED && (
          <>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setCat("")} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold ${!cat ? "bg-ink text-white" : "bg-white ring-1 ring-line"}`}>
              {q ? "Tümü" : "Stoktakiler"}
            </button>
            {topCats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id === activeTop ? "" : c.id)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold ${activeTop === c.id ? "bg-ink text-white" : "bg-white ring-1 ring-line"}`}
              >
                <CategoryIcon cat={c} imgClass="h-5 w-5 -my-1" /> {c.name}
              </button>
            ))}
          </div>
          {subCats.length > 0 && (
            <div className="no-scrollbar -mt-1 flex gap-1.5 overflow-x-auto pb-1 pl-2">
              <button onClick={() => setCat(activeTop)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${cat === activeTop ? "bg-brand text-white" : "bg-white ring-1 ring-line"}`}>
                Hepsi
              </button>
              {subCats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${cat === c.id ? "bg-brand text-white" : "bg-white ring-1 ring-line"}`}
                >
                  ↳ {c.name}
                </button>
              ))}
            </div>
          )}

          {!products && !loadErr && (
            <p className="flex items-center gap-2 rounded-2xl bg-white p-6 text-muted ring-1 ring-line">
              <Loader2 className="animate-spin" size={18} /> Ürünler yükleniyor…
            </p>
          )}
          {loadErr && <p className="rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{loadErr}</p>}

          {products && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p, multiplier)}
                  className={`group flex min-h-24 flex-col justify-between rounded-2xl bg-white p-3 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-2 hover:ring-brand active:scale-[.98] ${
                    !p.is_active ? "opacity-50" : ""
                  }`}
                >
                  <span className="line-clamp-2 text-sm font-bold leading-snug">{p.name}</span>
                  <span className="mt-2 flex items-end justify-between gap-1">
                    <span className="text-lg font-black text-brand">{formatTL(unitPrice(p))}</span>
                    <span className={`text-[11px] font-bold ${p.stock <= 0 ? "text-red-600" : "text-muted"}`}>{p.stock <= 0 ? "stok 0" : `stok ${p.stock}`}</span>
                  </span>
                </button>
              ))}
              {results.length === 0 && <p className="col-span-full rounded-2xl bg-white p-6 text-center text-muted ring-1 ring-line">Ürün bulunamadı.</p>}
            </div>
          )}
          </>
          )}
        </section>

        {/* SAĞ: fiş */}
        <aside className="flex min-h-[70dvh] flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-line xl:sticky xl:top-16 xl:max-h-[calc(100dvh-5rem)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-black">
              Fiş <span className="text-sm font-semibold text-muted">· {lines.length} kalem · {r2(itemCount)} adet</span>
            </p>
            <div className="flex gap-1">
              <button onClick={() => setManual(true)} className="rounded-lg px-2 py-1.5 text-xs font-bold hover:bg-bg" title="Serbest tutar (F4)">
                <Plus size={14} className="inline" /> Serbest
              </button>
              <button onClick={holdSale} disabled={!lines.length} className="rounded-lg px-2 py-1.5 text-xs font-bold hover:bg-bg disabled:opacity-40" title="Beklet (F6)">
                <PauseCircle size={14} className="inline" /> Beklet
              </button>
              <button
                onClick={() => lines.length && confirm("Fiş temizlensin mi?") && clearSale()}
                disabled={!lines.length}
                className="rounded-lg px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 size={14} className="inline" /> Temizle
              </button>
            </div>
          </div>

          {held.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-line bg-amber-50 px-4 py-2">
              {held.map((h) => (
                <button key={h.id} onClick={() => resumeSale(h.id)} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold ring-1 ring-amber-300">
                  <PlayCircle size={13} /> {new Date(h.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                  {formatTL(h.lines.reduce((a, l) => a + l.price * l.qty, 0))}
                </button>
              ))}
            </div>
          )}

          <ul className="flex-1 divide-y divide-line overflow-y-auto">
            {lines.length === 0 && (
              <li className="grid h-full min-h-48 place-items-center p-6 text-center text-muted">
                <span>
                  <ShoppingBasket className="mx-auto mb-2 opacity-40" size={40} />
                  Barkod okut veya soldan ürün seç
                </span>
              </li>
            )}
            {lines.map((l) => (
              <li
                key={l.key}
                onClick={() => setSelected(l.key)}
                className={`cursor-pointer px-4 py-2.5 ${selected === l.key ? "bg-brand-soft" : "hover:bg-bg"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold leading-snug">{l.name}</p>
                  <p className="shrink-0 font-black tabular-nums">{formatTL(r2(l.price * l.qty))}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex items-center rounded-lg ring-1 ring-line">
                    <button onClick={(e) => (e.stopPropagation(), setQty(l.key, l.qty - 1))} className="grid h-8 w-8 place-items-center" aria-label="Azalt">
                      <Minus size={14} />
                    </button>
                    <input
                      value={String(l.qty).replace(".", ",")}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const n = parseNumTR(e.target.value);
                        if (n != null && n > 0) setQty(l.key, n);
                      }}
                      inputMode="decimal"
                      className="h-8 w-12 border-x border-line text-center font-bold tabular-nums outline-none"
                      aria-label="Adet"
                    />
                    <button onClick={(e) => (e.stopPropagation(), setQty(l.key, l.qty + 1))} className="grid h-8 w-8 place-items-center" aria-label="Artır">
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-xs text-muted">×</span>
                  <PriceEdit value={l.price} onChange={(v) => setPrice(l.key, v)} />
                  {l.stock != null && l.stock < l.qty && <span className="text-[11px] font-bold text-amber-600">stok {l.stock}</span>}
                  <button onClick={(e) => (e.stopPropagation(), removeLine(l.key))} className="ml-auto text-muted hover:text-red-600" aria-label="Satırı sil">
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="space-y-2 border-t border-line bg-bg/60 px-4 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Ara toplam</span>
              <span className="font-bold tabular-nums">{formatTL(subtotal)}</span>
            </div>
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1 text-muted">
                <Tag size={14} /> İndirim
              </span>
              <span className="flex items-center gap-2">
                {discountAmt > 0 && <span className="font-bold text-brand">−{formatTL(discountAmt)}</span>}
                <input
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="₺ veya %10"
                  className="h-8 w-24 rounded-lg border border-line bg-white px-2 text-right text-sm font-bold"
                />
              </span>
            </label>
            <div className="flex items-end justify-between">
              <span className="text-sm font-bold uppercase text-muted">Toplam</span>
              <span className="text-4xl font-black tabular-nums tracking-tight">{formatTL(total)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button disabled={!lines.length} onClick={() => setPay("nakit")} className="flex flex-col items-center gap-0.5 rounded-2xl bg-emerald-600 py-3 font-black text-white disabled:opacity-40">
                <Banknote size={22} /> Nakit <span className="text-[10px] font-semibold opacity-80">F8</span>
              </button>
              <button disabled={!lines.length} onClick={() => setPay("kart")} className="flex flex-col items-center gap-0.5 rounded-2xl bg-sky-600 py-3 font-black text-white disabled:opacity-40">
                <CreditCard size={22} /> Kart <span className="text-[10px] font-semibold opacity-80">F9</span>
              </button>
              <button disabled={!lines.length} onClick={() => setPay("karisik")} className="flex flex-col items-center gap-0.5 rounded-2xl bg-ink py-3 font-black text-white disabled:opacity-40">
                <SplitSquareHorizontal size={22} /> Karışık <span className="text-[10px] font-semibold opacity-80">F10</span>
              </button>
            </div>
            {selectedLine && <p className="text-center text-[11px] text-muted">Seçili: {selectedLine.name} · + / − adet, Delete sil</p>}
          </div>
        </aside>
      </div>

      {pay && <PayDialog mode={pay} total={total} saving={saving} error={payErr} onCancel={() => (setPay(null), setPayErr(null))} onConfirm={complete} onMode={setPay} />}
      {manual && (
        <ManualDialog
          onClose={() => setManual(false)}
          onAdd={(name, price, qty) => {
            setLines((ls) => [{ key: newKey(), product_id: null, name, barcode: null, price, qty }, ...ls]);
            setManual(false);
            say(true, `${name} — ${formatTL(price)} eklendi.`);
          }}
        />
      )}
      {done && <DoneDialog data={done} store={store} onClose={() => (setDone(null), setTimeout(() => searchRef.current?.focus(), 50))} />}
      {showHistory && <PosHistory store={store} onClose={() => setShowHistory(false)} onChanged={() => (void loadToday(), void loadProducts())} />}
    </div>
  );
}

function PriceEdit({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState("");
  if (!edit)
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setV(String(value).replace(".", ","));
          setEdit(true);
        }}
        className="rounded-md px-1.5 py-0.5 text-sm font-semibold tabular-nums hover:bg-white hover:ring-1 hover:ring-line"
        title="Fiyatı bu satış için değiştir"
      >
        {formatTL(value)}
      </button>
    );
  const save = () => {
    const n = parseNumTR(v);
    if (n != null && n >= 0) onChange(n);
    setEdit(false);
  };
  return (
    <input
      autoFocus
      value={v}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setEdit(false);
      }}
      inputMode="decimal"
      className="h-8 w-20 rounded-lg border border-brand px-2 text-sm font-bold"
    />
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-3" onClick={onClose}>
      <div className={`max-h-[92dvh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl ${wide ? "max-w-2xl" : "max-w-md"}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function PayDialog({
  mode,
  total,
  saving,
  error,
  onCancel,
  onConfirm,
  onMode,
}: {
  mode: PayMode;
  total: number;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (mode: PayMode, cash: number, card: number) => void;
  onMode: (m: PayMode) => void;
}) {
  const [cashS, setCashS] = useState(mode === "nakit" ? "" : "");
  const [cardS, setCardS] = useState("");
  const cash = parseNumTR(cashS) ?? 0;
  const cardRaw = parseNumTR(cardS);
  const card = mode === "karisik" ? (cardRaw ?? r2(Math.max(0, total - cash))) : 0;
  const received = mode === "nakit" ? (cashS ? cash : total) : mode === "kart" ? total : r2(cash + card);
  const change = mode === "kart" ? 0 : r2(Math.max(0, received - total));
  const short = r2(Math.max(0, total - received));
  const ok = !saving && short <= 0.001;
  const submit = () => {
    if (!ok) return;
    if (mode === "nakit") onConfirm("nakit", cashS ? cash : total, 0);
    else if (mode === "kart") onConfirm("kart", 0, total);
    else onConfirm("karisik", cash, card);
  };
  return (
    <Modal onClose={() => !saving && onCancel()}>
      <div className="space-y-4">
        <div className="flex gap-1 rounded-2xl bg-bg p-1">
          {(["nakit", "kart", "karisik"] as PayMode[]).map((m) => (
            <button key={m} onClick={() => onMode(m)} className={`flex-1 rounded-xl py-2 text-sm font-black ${mode === m ? "bg-white shadow ring-1 ring-line" : "text-muted"}`}>
              {m === "nakit" ? "Nakit" : m === "kart" ? "Kart" : "Nakit + Kart"}
            </button>
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm font-bold uppercase text-muted">Ödenecek</p>
          <p className="text-5xl font-black tabular-nums">{formatTL(total)}</p>
        </div>

        {mode !== "kart" && (
          <div className="space-y-2">
            <label className="block text-sm font-bold">{mode === "nakit" ? "Alınan nakit (boş = tam tutar)" : "Nakit kısmı"}</label>
            <input
              autoFocus
              value={cashS}
              onChange={(e) => setCashS(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              inputMode="decimal"
              placeholder={formatTL(total)}
              className="h-14 w-full rounded-2xl border-2 border-line px-4 text-2xl font-black tabular-nums outline-none focus:border-brand"
            />
            <div className="grid grid-cols-4 gap-1.5">
              <button onClick={() => setCashS(String(total).replace(".", ","))} className="rounded-xl bg-emerald-50 py-2 text-sm font-black text-emerald-700 ring-1 ring-emerald-200">
                Tam
              </button>
              {BILLS.filter((b) => mode === "karisik" || b >= total || b >= 50).slice(0, 7).map((b) => (
                <button key={b} onClick={() => setCashS(String(b))} className="rounded-xl bg-white py-2 text-sm font-bold ring-1 ring-line hover:ring-brand">
                  {b} ₺
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "karisik" && (
          <div className="space-y-1">
            <label className="block text-sm font-bold">Kart kısmı (boş = kalan)</label>
            <input
              value={cardS}
              onChange={(e) => setCardS(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              inputMode="decimal"
              placeholder={formatTL(r2(Math.max(0, total - cash)))}
              className="h-12 w-full rounded-2xl border-2 border-line px-4 text-xl font-black tabular-nums outline-none focus:border-brand"
            />
          </div>
        )}
        {mode === "kart" && <p className="rounded-2xl bg-sky-50 p-3 text-center text-sm font-semibold text-sky-800">Tutarı POS cihazından çek, onaylandıktan sonra satışı tamamla.</p>}

        {mode !== "kart" && (
          <div className={`rounded-2xl p-4 text-center ${short > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
            <p className="text-sm font-bold uppercase">{short > 0 ? "Eksik" : "Para üstü"}</p>
            <p className="text-4xl font-black tabular-nums">{formatTL(short > 0 ? short : change)}</p>
          </div>
        )}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={saving} className="flex-1 rounded-2xl bg-bg py-3.5 font-bold">
            Vazgeç
          </button>
          <button onClick={submit} disabled={!ok} className="btn-primary flex-[2] py-3.5 text-lg">
            {saving ? <Loader2 className="animate-spin" /> : null} Satışı tamamla
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ManualDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, price: number, qty: number) => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const p = parseNumTR(price);
  const n = parseNumTR(qty) ?? 1;
  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (p != null && p > 0 && n > 0) onAdd(name.trim() || "Çeşitli ürün", r2(p), n);
        }}
        className="space-y-3"
      >
        <p className="text-lg font-black">Serbest tutar ekle</p>
        <p className="text-sm text-muted">Sistemde olmayan ya da barkodu okunmayan ürün için. Stoktan düşmez.</p>
        <input autoFocus value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Tutar ₺" className="input text-2xl font-black" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Açıklama (ör. Ekmek, Poşet)" className="input" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="Adet" className="input" />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl bg-bg py-3 font-bold">
            Vazgeç
          </button>
          <button disabled={!(p && p > 0)} className="btn-primary flex-[2]">
            Fişe ekle
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DoneDialog({ data, store, onClose }: { data: ReceiptData; store: PosStore; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Enter" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <Modal onClose={onClose}>
      <div className="space-y-4 text-center">
        <p className="text-sm font-bold uppercase text-emerald-700">✓ Satış tamamlandı · Fiş #{data.saleNo}</p>
        <p className="text-5xl font-black tabular-nums">{formatTL(data.total)}</p>
        {data.change > 0 && (
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
            <p className="text-sm font-bold uppercase">Para üstü</p>
            <p className="text-5xl font-black tabular-nums">{formatTL(data.change)}</p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-ghost flex-1 py-3">
            <Printer size={18} /> Fiş yazdır
          </button>
          <button autoFocus onClick={onClose} className="btn-primary flex-[2] py-3 text-lg">
            Yeni satış (Enter)
          </button>
        </div>
      </div>
      <PosReceipt data={data} store={store} />
    </Modal>
  );
}
