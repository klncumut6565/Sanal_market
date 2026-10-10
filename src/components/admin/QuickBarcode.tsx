"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, PackagePlus, ScanBarcode, Search } from "lucide-react";
import { findByBarcode, quickPriceUpdate, type BarcodeProduct } from "@/app/admin/actions";
import { ProductImage } from "@/components/shop/ProductImage";
import { formatTL } from "@/lib/format";
import { BarcodeScanner } from "./BarcodeScanner";

type Form = { price: string; sale_price: string; stock: string };
const toForm = (p: BarcodeProduct): Form => ({
  price: String(p.price).replace(".", ","),
  sale_price: p.sale_price == null ? "" : String(p.sale_price).replace(".", ","),
  stock: String(p.stock),
});

export function QuickBarcode() {
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ price: "", sale_price: "", stock: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [history, setHistory] = useState<{ name: string; price: number; sale: number | null }[]>([]);
  const [pending, start] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const lookup = useCallback((raw: string) => {
    const c = raw.replace(/\s+/g, "");
    if (!c) return;
    setCode(c);
    setMsg(null);
    setNotFound(null);
    setProduct(null);
    start(async () => {
      const p = await findByBarcode(c);
      if (p) {
        setProduct(p);
        setForm(toForm(p));
        setTimeout(() => priceRef.current?.select(), 50);
      } else setNotFound(c);
    });
  }, []);

  const onScan = useCallback(
    (c: string) => {
      setScanning(false);
      lookup(c);
    },
    [lookup],
  );

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    start(async () => {
      const res = await quickPriceUpdate({ id: product.id, ...form });
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setHistory((h) => [{ name: res.product.name, price: res.product.price, sale: res.product.sale_price }, ...h].slice(0, 10));
      setMsg({ ok: true, text: `${res.product.name} kaydedildi.` });
      setProduct(null);
      setCode("");
      setTimeout(() => codeRef.current?.focus(), 50);
    });
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {scanning && <BarcodeScanner onResult={onScan} onClose={() => setScanning(false)} />}

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <button onClick={() => setScanning(true)} className="btn-primary w-full py-4 text-lg">
          <ScanBarcode size={24} /> Kamerayla barkod okut
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(code);
          }}
          className="flex gap-2"
        >
          <input
            ref={codeRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="veya barkodu yaz / el okuyucuyla okut"
            className="input font-mono"
          />
          <button className="btn-ghost shrink-0 px-3" aria-label="Ara">
            {pending && !product ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
        </form>
        {msg && (
          <p className={`flex items-center gap-2 rounded-lg p-2.5 text-sm font-semibold ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-brand-soft text-brand"}`}>
            {msg.ok && <CheckCircle2 size={16} />} {msg.text}
          </p>
        )}
      </section>

      {notFound && (
        <section className="space-y-3 rounded-2xl bg-white p-4 text-center ring-1 ring-line">
          <p className="font-bold">
            <span className="font-mono">{notFound}</span> barkodlu ürün bulunamadı.
          </p>
          <p className="text-sm text-muted">Yeni ürün olarak ekleyebilir ya da mevcut bir ürünün düzenleme sayfasından bu barkodu atayabilirsin.</p>
          <Link href={`/admin/urunler/yeni?barkod=${encodeURIComponent(notFound)}`} className="btn-primary mx-auto w-fit">
            <PackagePlus size={18} /> Yeni ürün olarak ekle
          </Link>
        </section>
      )}

      {product && (
        <form onSubmit={save} className="space-y-4 rounded-2xl bg-white p-4 ring-2 ring-brand">
          <div className="flex items-center gap-3">
            <ProductImage src={product.image_url} emoji={product.emoji} alt={product.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="font-black leading-tight">{product.name}</p>
              <p className="text-xs text-muted">
                {product.unit_label} · <span className="font-mono">{product.barcode}</span>
                {!product.is_active && <span className="ml-1 font-bold text-brand">(pasif)</span>}
              </p>
              <p className="text-sm">
                Şu an:{" "}
                {product.sale_price != null ? (
                  <>
                    <s className="text-muted">{formatTL(product.price)}</s> <b className="text-brand">{formatTL(product.sale_price)}</b>
                  </>
                ) : (
                  <b>{formatTL(product.price)}</b>
                )}{" "}
                · stok <b>{product.stock}</b>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-bold">Fiyat (₺)</span>
              <input ref={priceRef} value={form.price} onChange={set("price")} inputMode="decimal" required className="input text-lg font-bold" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold">İndirimli (₺)</span>
              <input value={form.sale_price} onChange={set("sale_price")} inputMode="decimal" placeholder="yok" className="input text-lg font-bold" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold">Stok</span>
              <input value={form.stock} onChange={set("stock")} inputMode="numeric" required className="input text-lg font-bold" />
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={pending} className="btn-primary flex-1">
              {pending && <Loader2 size={18} className="animate-spin" />} Kaydet
            </button>
            <Link href={`/admin/urunler/${product.id}`} className="btn-ghost">Tüm bilgiler</Link>
          </div>
        </form>
      )}

      {history.length > 0 && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="mb-2 text-sm font-extrabold">Bu oturumda güncellenenler</h2>
          <ul className="divide-y divide-line text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span>{h.name}</span>
                <b>{formatTL(h.sale ?? h.price)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
