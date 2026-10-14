import Link from "next/link";
import { Plus, ScanBarcode, Rows3 } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { ProductImage } from "@/components/shop/ProductImage";
import { formatTL } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { quickUpdateProduct } from "../actions";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { InlineCategorySelect } from "@/components/admin/InlineCategorySelect";
import { calcMargin, marginTone, pctTR } from "@/lib/margin";
import { LiveSearchInput } from "@/components/admin/LiveSearchInput";
import { AutoSubmitSelect } from "@/components/admin/AutoSubmitSelect";
import { BulkSelectProvider, RowCheckbox, SelectPageCheckbox } from "@/components/admin/BulkSelect";
import { Suspense } from "react";
import { fetchAll } from "@/lib/data/fetchAll";
import { fold, matchWords } from "@/lib/trFold";
import { categoryOptions, withDescendants } from "@/lib/categoryTree";

const PAGE = 100;

export const metadata = { title: "Ürünler" };

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; kategori?: string; stok?: string; marj?: string; s?: string; sira?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const now = new Date().getTime();
  const [{ data: products }, { data: categories }, { data: costs }] = await Promise.all([
    fetchAll((f, t) => supabase.from("products").select("*").order("name").order("id").range(f, t)),
    supabase.from("categories").select("*").order("sort_order"),
    fetchAll((f, t) => supabase.from("product_costs").select("product_id,cost_price").order("product_id").range(f, t)),
  ]);
  const costOf = new Map((costs ?? []).map((c) => [c.product_id as string, Number(c.cost_price)]));
  const marginOf = (p: Product) => calcMargin(Number(p.sale_price ?? p.price), costOf.get(p.id));
  const cats = (categories ?? []) as Category[];
  const treeOpts = categoryOptions(cats);
  const catOpts = treeOpts.map((o) => ({ id: o.id, name: o.label }));
  const catFilter = sp.kategori ? withDescendants(cats, sp.kategori) : null;
  // Türkçe karakter ve büyük/küçük harf duyarsız, kelime bazlı ("yeni raki 70" → YENİ RAKI 70CL)
  const rawQ = (sp.q ?? "").trim();
  const q = fold(rawQ);
  const list = ((products ?? []) as Product[]).filter(
    (p) =>
      (!q || matchWords(p.name, rawQ) || (p.barcode ?? "").includes(rawQ.replace(/\s/g, ""))) &&
      (!catFilter || (!!p.category_id && catFilter.has(p.category_id))) &&
      (sp.stok !== "kritik" || p.stock <= p.critical_stock) &&
      (sp.marj !== "dusuk" || ((m) => !!m && m.marginPct < 10)(marginOf(p))) &&
      (sp.marj !== "girilmemis" || !costOf.has(p.id)),
  );
  if (q) {
    // Ada göre en iyi eşleşme en üstte: tam eşleşme > başlıyor > kelime başı > içeriyor
    const rank = (p: Product) => {
      const n = fold(p.name);
      if (n === q || p.barcode === rawQ) return 0;
      if (n.startsWith(q)) return 1;
      if (n.split(/\s+/).some((w) => w.startsWith(q))) return 2;
      return 3;
    };
    list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "tr"));
  }
  if (sp.marj === "dusuk") list.sort((a, b) => (marginOf(a)?.marginPct ?? 0) - (marginOf(b)?.marginPct ?? 0));
  // Sıralama seçimi (seçilirse arama/marj sıralamasının yerine geçer); fiyat = geçerli satış fiyatı (indirimliyse indirimli)
  const priceOf = (p: Product) => Number(p.sale_price ?? p.price);
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, "tr");
  if (sp.sira === "fiyat-artan") list.sort((a, b) => priceOf(a) - priceOf(b) || byName(a, b));
  else if (sp.sira === "fiyat-azalan") list.sort((a, b) => priceOf(b) - priceOf(a) || byName(a, b));
  else if (sp.sira === "ad-za") list.sort((a, b) => byName(b, a));
  else if (sp.sira === "eski") list.sort((a, b) => (a.info_updated_at ?? "").localeCompare(b.info_updated_at ?? "") || byName(a, b));
  else if (sp.sira === "yeni") list.sort((a, b) => (b.info_updated_at ?? "").localeCompare(a.info_updated_at ?? "") || byName(a, b));
  else if (!q && sp.marj !== "dusuk") list.sort(byName);
  // Genel ortalama marj (alış fiyatı girilmiş aktif ürünler)
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE));
  const pageNo = Math.min(pageCount, Math.max(1, Number(sp.s) || 1));
  const shown = list.slice((pageNo - 1) * PAGE, pageNo * PAGE);
  const pageHref = (n: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "s") u.set(k, v);
    if (n > 1) u.set("s", String(n));
    const qs = u.toString();
    return `/admin/urunler${qs ? `?${qs}` : ""}`;
  };
  const withCost = ((products ?? []) as Product[]).filter((p) => p.is_active && costOf.has(p.id));
  const avgMargin = withCost.length ? withCost.reduce((a, p) => a + (marginOf(p)?.marginPct ?? 0), 0) / withCost.length : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Ürünler & stok</h1>
        <div className="flex gap-2">
          <Link href="/admin/barkod" className="btn-ghost py-2.5"><ScanBarcode size={18} /> Barkodla güncelle</Link>
          <Link href="/admin/urunler/hizli" className="btn-ghost py-2.5"><Rows3 size={18} /> Hızlı ekle (liste)</Link>
          <Link href="/admin/urunler/yeni" className="btn-primary py-2.5"><Plus size={18} /> Yeni ürün</Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <Suspense fallback={<input name="q" defaultValue={sp.q} placeholder="Ürün adı veya barkod" className="input max-w-xs" />}>
          <LiveSearchInput placeholder="Ürün adı veya barkod — yazdıkça arar" className="w-full sm:max-w-xs" />
        </Suspense>
        <select name="kategori" defaultValue={sp.kategori ?? ""} className="input max-w-52">
          <option value="">Tüm kategoriler</option>
          {treeOpts.map((o) => <option key={o.id} value={o.id}>{o.depth ? `  ↳ ${o.label}` : o.label}</option>)}
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
        <AutoSubmitSelect name="sira" defaultValue={sp.sira ?? ""} className="input max-w-52" aria-label="Sıralama">
          <option value="">Sırala: Ada göre (A → Z)</option>
          <option value="ad-za">Sırala: Ada göre (Z → A)</option>
          <option value="fiyat-artan">Sırala: Fiyat (ucuzdan pahalıya)</option>
          <option value="fiyat-azalan">Sırala: Fiyat (pahalıdan ucuza)</option>
          <option value="eski">Sırala: Güncelleme (en eski önce)</option>
          <option value="yeni">Sırala: Güncelleme (en yeni önce)</option>
        </AutoSubmitSelect>
        <button className="btn-ghost">Filtrele</button>
      </form>
      <p className="text-sm text-muted">
        {q || sp.kategori || sp.stok || sp.marj ? "Bulunan" : "Toplam"} ürün: <b className="text-ink">{list.length}</b>
        {" "}· Alış fiyatı girilmiş ürün: <b className="text-ink">{withCost.length}</b>
        {avgMargin != null && (
          <>
            {" "}· Ortalama kâr marjı: <b className="text-ink">{pctTR(Math.round(avgMargin * 10) / 10)}</b>
          </>
        )}
      </p>

      <BulkSelectProvider
        pageIds={shown.map((p) => p.id)}
        allIds={(q || sp.kategori || sp.stok || sp.marj) && list.length <= 3000 ? list.map((p) => p.id) : null}
        names={Object.fromEntries(shown.map((p) => [p.id, p.name]))}
      >
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[1160px] text-sm">
          <thead className="bg-bg text-left text-xs uppercase text-muted">
            <tr><th className="w-8 py-3 pl-3"><SelectPageCheckbox /></th><th className="w-10 py-3 pl-2 text-right">#</th><th className="p-3">Ürün</th><th>Kategori</th><th>Fiyat</th><th>Alış / Marj</th><th>Stok</th><th title="Ad, barkod, fiyat, birim veya görselin en son değiştiği tarih (stok değişimi sayılmaz)">Güncelleme</th><th>Durum</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((p, i) => (
              <tr key={p.id} className={p.is_active ? "" : "opacity-55"}>
                <td className="py-3 pl-3"><RowCheckbox id={p.id} /></td>
                <td className="py-3 pl-2 text-right text-xs font-bold tabular-nums text-muted">{(pageNo - 1) * PAGE + i + 1}</td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <ProductImage src={p.image_url} emoji={p.emoji} alt={p.name} size="sm" />
                    <div>
                      <p className="font-bold">{p.name}</p>
                      <p className="text-xs text-muted">{p.unit_label}{p.barcode ? ` · ${p.barcode}` : ""}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <InlineCategorySelect id={p.id} value={p.category_id} options={catOpts} />
                </td>
                <td>
                  <form action={quickUpdateProduct} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    <div className="space-y-1">
                      <label className="flex items-center gap-1">
                        <span className="w-3 text-xs text-muted">₺</span>
                        <input
                          name="price"
                          inputMode="decimal"
                          defaultValue={String(p.price).replace(".", ",")}
                          aria-label="Satış fiyatı"
                          className={`w-24 rounded-lg border border-line px-2 py-1.5 font-bold ${p.sale_price != null ? "text-xs text-muted line-through" : ""}`}
                        />
                      </label>
                      <label className="flex items-center gap-1" title="İndirimli fiyat (boş = indirim yok)">
                        <span className="w-3 text-[10px] font-bold text-brand">%</span>
                        <input
                          name="sale_price"
                          inputMode="decimal"
                          defaultValue={p.sale_price != null ? String(p.sale_price).replace(".", ",") : ""}
                          placeholder="İndirim"
                          aria-label="İndirimli fiyat"
                          className={`w-24 rounded-lg border px-2 py-1 text-xs ${p.sale_price != null ? "border-brand font-bold text-brand" : "border-dashed border-line"}`}
                        />
                      </label>
                    </div>
                    <button className="rounded-lg px-2 py-1.5 text-xs font-bold text-brand hover:bg-brand-soft">Kaydet</button>
                  </form>
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
                  <UpdatedAge iso={p.info_updated_at} now={now} />
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
                <td className="pr-3 text-right">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    <Link href={`/admin/urunler/${p.id}`} className="font-bold text-brand">Düzenle</Link>
                    <DeleteProductButton id={p.id} name={p.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-6 text-center text-muted">Ürün bulunamadı.</p>}
      </div>
      </BulkSelectProvider>
      {pageCount > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1.5 text-sm">
          {pageNo > 1 && <Link href={pageHref(pageNo - 1)} className="btn-ghost px-3 py-1.5">← Önceki</Link>}
          {Array.from({ length: pageCount }, (_, k) => k + 1)
            .filter((n) => n === 1 || n === pageCount || Math.abs(n - pageNo) <= 2)
            .map((n, k, arr) => (
              <span key={n} className="flex items-center gap-1.5">
                {k > 0 && n - arr[k - 1] > 1 && <span className="text-muted">…</span>}
                <Link href={pageHref(n)} className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 font-bold ${n === pageNo ? "bg-brand text-white" : "bg-white ring-1 ring-line hover:ring-brand"}`}>
                  {n}
                </Link>
              </span>
            ))}
          {pageNo < pageCount && <Link href={pageHref(pageNo + 1)} className="btn-ghost px-3 py-1.5">Sonraki →</Link>}
          <span className="ml-2 text-muted">
            {(pageNo - 1) * PAGE + 1}–{Math.min(pageNo * PAGE, list.length)} / {list.length}
          </span>
        </nav>
      )}
    </div>
  );
}

const DAY = 86_400_000;
/** Son bilgi güncellemesi: "bugün / 12 gün önce / 4 ay önce"; 90+ gün turuncu, 180+ gün kırmızı. */
function UpdatedAge({ iso, now }: { iso?: string; now: number }) {
  if (!iso) return <span className="text-xs text-muted">—</span>;
  const t = Date.parse(iso);
  const days = Math.floor((now - t) / DAY);
  const rel =
    days < 1 ? "Bugün" : days < 2 ? "Dün" : days < 31 ? `${days} gün önce` : days < 365 ? `${Math.floor(days / 30)} ay önce` : `${Math.floor(days / 365)} yıl önce`;
  const tone = days >= 180 ? "bg-red-50 text-red-700 ring-red-200" : days >= 90 ? "bg-amber-50 text-amber-700 ring-amber-200" : "text-muted ring-transparent";
  const date = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(t));
  return (
    <span title={`Son güncelleme: ${date}`} className={`inline-block whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold ring-1 ${tone}`}>
      {date}
      <span className="block text-[11px] font-normal">{rel}</span>
    </span>
  );
}
