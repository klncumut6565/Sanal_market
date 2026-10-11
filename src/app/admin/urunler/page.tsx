import Link from "next/link";
import { Plus, ScanBarcode } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { ProductImage } from "@/components/shop/ProductImage";
import { formatTL } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { quickUpdateProduct } from "../actions";
import { calcMargin, marginTone, pctTR } from "@/lib/margin";

export const metadata = { title: "Ürünler" };

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; kategori?: string; stok?: string; marj?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: products }, { data: categories }, { data: costs }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("product_costs").select("product_id,cost_price"),
  ]);
  const costOf = new Map((costs ?? []).map((c) => [c.product_id as string, Number(c.cost_price)]));
  const marginOf = (p: Product) => calcMargin(Number(p.sale_price ?? p.price), costOf.get(p.id));
  const cats = (categories ?? []) as Category[];
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const q = (sp.q ?? "").toLocaleLowerCase("tr");
  const list = ((products ?? []) as Product[]).filter(
    (p) =>
      (!q || p.name.toLocaleLowerCase("tr").includes(q) || (p.barcode ?? "").includes(q)) &&
      (!sp.kategori || p.category_id === sp.kategori) &&
      (sp.stok !== "kritik" || p.stock <= p.critical_stock) &&
      (sp.marj !== "dusuk" || ((m) => !!m && m.marginPct < 10)(marginOf(p))) &&
      (sp.marj !== "girilmemis" || !costOf.has(p.id)),
  );
  if (sp.marj === "dusuk") list.sort((a, b) => (marginOf(a)?.marginPct ?? 0) - (marginOf(b)?.marginPct ?? 0));
  // Genel ortalama marj (alış fiyatı girilmiş aktif ürünler)
  const withCost = ((products ?? []) as Product[]).filter((p) => p.is_active && costOf.has(p.id));
  const avgMargin = withCost.length ? withCost.reduce((a, p) => a + (marginOf(p)?.marginPct ?? 0), 0) / withCost.length : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Ürünler & stok</h1>
        <div className="flex gap-2">
          <Link href="/admin/barkod" className="btn-ghost py-2.5"><ScanBarcode size={18} /> Barkodla güncelle</Link>
          <Link href="/admin/urunler/yeni" className="btn-primary py-2.5"><Plus size={18} /> Yeni ürün</Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Ürün adı veya barkod" className="input max-w-xs" />
        <select name="kategori" defaultValue={sp.kategori ?? ""} className="input max-w-52">
          <option value="">Tüm kategoriler</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="stok" defaultValue={sp.stok ?? ""} className="input max-w-44">
          <option value="">Tüm stoklar</option>
          <option value="kritik">Kritik stok</option>
        </select>
        <select name="marj" defaultValue={sp.marj ?? ""} className="input max-w-52">
          <option value="">Tüm marjlar</option>
          <option value="dusuk">Düşük marj / zarar (%10 altı)</option>
          <option value="girilmemis">Alış fiyatı girilmemiş</option>
        </select>
        <button className="btn-ghost">Filtrele</button>
      </form>
      <p className="text-sm text-muted">
        Alış fiyatı girilmiş ürün: <b className="text-ink">{withCost.length}</b>
        {avgMargin != null && (
          <>
            {" "}· Ortalama kâr marjı: <b className="text-ink">{pctTR(Math.round(avgMargin * 10) / 10)}</b>
          </>
        )}
      </p>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-bg text-left text-xs uppercase text-muted">
            <tr><th className="p-3">Ürün</th><th>Kategori</th><th>Fiyat</th><th>Alış / Marj</th><th>Stok</th><th>Durum</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((p) => (
              <tr key={p.id} className={p.is_active ? "" : "opacity-55"}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <ProductImage src={p.image_url} emoji={p.emoji} alt={p.name} size="sm" />
                    <div>
                      <p className="font-bold">{p.name}</p>
                      <p className="text-xs text-muted">{p.unit_label}{p.barcode ? ` · ${p.barcode}` : ""}</p>
                    </div>
                  </div>
                </td>
                <td className="text-muted">{(p.category_id && catName.get(p.category_id)) ?? "—"}</td>
                <td>
                  {p.sale_price != null ? (
                    <><span className="text-xs text-muted line-through">{formatTL(p.price)}</span><br /><b className="text-brand">{formatTL(p.sale_price)}</b></>
                  ) : (
                    <b>{formatTL(p.price)}</b>
                  )}
                </td>
                <td>
                  {(() => {
                    const m = marginOf(p);
                    return m ? (
                      <>
                        <span className="text-xs text-muted">{formatTL(m.cost)}</span>
                        <br />
                        <b className={marginTone(m)}>
                          {pctTR(m.marginPct)} · {formatTL(m.profit)}
                        </b>
                      </>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    );
                  })()}
                </td>
                <td>
                  <form action={quickUpdateProduct} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      name="stock"
                      type="number"
                      min={0}
                      defaultValue={p.stock}
                      className={`w-20 rounded-lg border px-2 py-1.5 font-bold ${p.stock === 0 ? "border-brand text-brand" : p.stock <= p.critical_stock ? "border-warn text-warn" : "border-line"}`}
                    />
                    <button className="rounded-lg px-2 py-1.5 text-xs font-bold text-brand hover:bg-brand-soft">Kaydet</button>
                  </form>
                </td>
                <td>
                  <form action={quickUpdateProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="toggle_active" value={p.is_active ? "0" : "1"} />
                    <button className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                      {p.is_active ? "Satışta" : "Pasif"}
                    </button>
                  </form>
                </td>
                <td className="pr-3 text-right"><Link href={`/admin/urunler/${p.id}`} className="font-bold text-brand">Düzenle</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-6 text-center text-muted">Ürün bulunamadı.</p>}
      </div>
    </div>
  );
}
