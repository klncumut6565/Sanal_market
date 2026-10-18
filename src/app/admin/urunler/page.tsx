import Link from "next/link";
import { Camera, Check, Plus, ScanBarcode, Rows3 } from "lucide-react";
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
import { fold } from "@/lib/trFold";
import { categoryOptions, childrenOf, topLevel, withDescendants } from "@/lib/categoryTree";
import { CategoryFilter } from "@/components/admin/CategoryFilter";

const PAGE = 100;

export const metadata = { title: "Ürünler" };

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; kategori?: string; alt?: string; stok?: string; marj?: string; s?: string; sira?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const now = new Date().getTime();
  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");
  const cats = (categories ?? []) as Category[];
  const treeOpts = categoryOptions(cats);
  const catOpts = treeOpts.map((o) => ({ id: o.id, name: o.label }));
  // Kategori + alt kategori: eski bağlantılarda kategori=alt kategori id'si olabilir → üstünü ana, kendisini alt say
  const byId = new Map(cats.map((c) => [c.id, c]));
  const picked = sp.kategori ? byId.get(sp.kategori) : undefined;
  const topId = picked ? (picked.parent_id && byId.has(picked.parent_id) ? picked.parent_id : picked.id) : "";
  const subId = picked && picked.id !== topId ? picked.id : sp.alt && byId.get(sp.alt)?.parent_id === topId ? sp.alt : "";
  const catFilter = subId ? withDescendants(cats, subId) : topId ? withDescendants(cats, topId) : null;
  const rawQ = (sp.q ?? "").trim();
  const q = fold(rawQ);
  const filtered = !!(q || sp.kategori || sp.stok || sp.marj);

  // Filtreleme / sıralama / sayfalama veritabanında (admin_product_page): her açılışta tüm ürünler
  // yerine yalnızca bu sayfanın 100 satırı + özet bilgiler gelir (Supabase veri çıkışı tasarrufu).
  const { data: res, error: listErr } = await supabase.rpc("admin_product_page", {
    p_q: rawQ,
    p_cats: catFilter ? [...catFilter] : null,
    p_stok: sp.stok ?? "",
    p_marj: sp.marj ?? "",
    p_sira: sp.sira ?? "",
    p_page: Math.max(1, Number(sp.s) || 1),
    p_size: PAGE,
    p_want_ids: filtered,
  });
  type Row = Product & { cost: number | null; dup_n: number; dup_b: number };
  const r = (res ?? {}) as {
    total?: number;
    page?: number;
    rows?: Row[];
    ids?: string[] | null;
    cat_counts?: Record<string, number>;
    dup_groups?: number;
    with_cost?: number;
    avg_margin?: number | null;
  };
  const shown = (r.rows ?? []).map((p) => ({ ...p, price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price) }));
  const total = r.total ?? 0;
  const costOf = new Map(shown.filter((p) => p.cost != null).map((p) => [p.id, Number(p.cost)]));
  const marginOf = (p: Product) => calcMargin(Number(p.sale_price ?? p.price), costOf.get(p.id));
  const dupOf = (p: Row) => (p.dup_n > 0 || p.dup_b > 0 ? { n: p.dup_n, b: p.dup_b } : null);
  const perCat = new Map(Object.entries(r.cat_counts ?? {}));
  const catTops = topLevel(cats).map((c) => ({
    id: c.id,
    name: c.name,
    count: [...withDescendants(cats, c.id)].reduce((a, id) => a + (perCat.get(id) ?? 0), 0),
  }));
  const catSubs: Record<string, { id: string; name: string; count: number }[]> = {};
  for (const t of catTops) catSubs[t.id] = childrenOf(cats, t.id).map((c) => ({ id: c.id, name: c.name, count: perCat.get(c.id) ?? 0 }));
  const dupGroups = r.dup_groups ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE));
  const pageNo = r.page ?? 1;
  const pageHref = (n: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "s") u.set(k, v);
    if (n > 1) u.set("s", String(n));
    const qs = u.toString();
    return `/admin/urunler${qs ? `?${qs}` : ""}`;
  };
  // Düzenleme sayfasından kaydedince aynı filtre + sayfaya dönülsün
  const backHref = pageHref(pageNo);
  const withCostCount = r.with_cost ?? 0;
  const avgMargin = r.avg_margin ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Ürünler & stok</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/barkod" className="btn-ghost py-2.5"><ScanBarcode size={18} /> Barkodla güncelle</Link>
          <Link href="/admin/urunler/foto" className="btn-ghost py-2.5"><Camera size={18} /> Fotoğrafla tanı</Link>
          <Link href="/admin/urunler/hizli" className="btn-ghost py-2.5"><Rows3 size={18} /> Hızlı ekle (liste)</Link>
          <Link href="/admin/urunler/yeni" className="btn-primary py-2.5"><Plus size={18} /> Yeni ürün</Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <Suspense fallback={<input name="q" defaultValue={sp.q} placeholder="Ürün adı veya barkod" className="input max-w-xs" />}>
          <LiveSearchInput placeholder="Ürün adı veya barkod — yazdıkça arar" className="w-full sm:max-w-xs" />
        </Suspense>
        <CategoryFilter tops={catTops} subsByTop={catSubs} top={topId} sub={subId} />
        <select name="stok" defaultValue={sp.stok ?? ""} className="input max-w-44">
          <option value="">Tüm stoklar</option>
          <option value="kritik">Kritik stok</option>
          <option value="mukerrer">Mükerrer şüphesi (aynı ad / barkod)</option>
          <option value="barkodsuz">Barkodsuz ürünler</option>
          <option value="gorselsiz">Görseli olmayanlar</option>
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
        {filtered ? "Bulunan" : "Toplam"} ürün: <b className="text-ink">{total}</b>
        {" "}· Alış fiyatı girilmiş ürün: <b className="text-ink">{withCostCount}</b>
        {dupGroups > 0 && sp.stok !== "mukerrer" && (
          <>
            {" "}·{" "}
            <Link href="/admin/urunler?stok=mukerrer" className="font-bold text-amber-700 underline">
              ⚠ Mükerrer şüphesi: {dupGroups} grup
            </Link>
          </>
        )}
        {avgMargin != null && (
          <>
            {" "}· Ortalama kâr marjı: <b className="text-ink">{pctTR(Math.round(avgMargin * 10) / 10)}</b>
          </>
        )}
      </p>

      <BulkSelectProvider
        pageIds={shown.map((p) => p.id)}
        allIds={filtered && r.ids ? r.ids : null}
        names={Object.fromEntries(shown.map((p) => [p.id, p.name]))}
      >
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[1000px] table-fixed text-sm">
          <colgroup>
            <col className="w-8" />
            <col className="w-10" />
            <col />
            <col className="w-[150px]" />
            <col className="w-[132px]" />
            <col className="w-[104px]" />
            <col className="w-[100px]" />
            <col className="w-[88px]" />
            <col className="w-[70px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead className="bg-bg text-left text-xs uppercase text-muted">
            <tr><th className="w-8 py-3 pl-3"><SelectPageCheckbox /></th><th className="w-10 py-3 pl-2 text-right">#</th><th className="p-3">Ürün</th><th>Kategori</th><th>Fiyat</th><th>Alış / Marj</th><th>Stok</th><th title="Ad, barkod, fiyat, birim veya görselin en son değiştiği tarih (stok değişimi sayılmaz)">Güncelleme</th><th>Durum</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((p, i) => (
              <tr key={p.id} className={`${p.is_active ? "" : "opacity-55"} ${p.barcode?.trim() ? "" : "bg-yellow-50"}`} title={p.barcode?.trim() ? undefined : "Barkodsuz ürün"}>
                <td className="py-3 pl-3"><RowCheckbox id={p.id} /></td>
                <td className="py-3 pl-2 text-right text-xs font-bold tabular-nums text-muted">{(pageNo - 1) * PAGE + i + 1}</td>
                <td className="p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="shrink-0">
                      <ProductImage src={p.image_url} emoji={p.emoji} alt={p.name} size="sm" />
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 break-words font-bold leading-snug" title={p.name}>{p.name}</p>
                      <p className="truncate text-xs text-muted">
                        {p.unit_label}
                        {p.barcode?.trim() ? ` · ${p.barcode}` : <span className="font-bold text-yellow-700">{p.unit_label ? " · " : ""}Barkod yok</span>}
                      </p>
                      {(() => {
                        const d = dupOf(p);
                        if (!d) return null;
                        return (
                          <Link
                            href={`/admin/urunler?stok=mukerrer&q=${encodeURIComponent(d.b > 0 ? (p.barcode ?? "") : p.name)}`}
                            className="mt-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200"
                          >
                            ⚠ {d.b > 0 ? `Aynı barkod: ${d.b + 1} kayıt` : `Aynı adla ${d.n + 1} kayıt`}
                          </Link>
                        );
                      })()}
                    </div>
                  </div>
                </td>
                <td className="pr-2">
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
                          className={`w-[76px] rounded-lg border border-line px-1.5 py-1.5 font-bold ${p.sale_price != null ? "text-xs text-muted line-through" : ""}`}
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
                          className={`w-[76px] rounded-lg border px-1.5 py-1 text-xs ${p.sale_price != null ? "border-brand font-bold text-brand" : "border-dashed border-line"}`}
                        />
                      </label>
                    </div>
                    <button title="Kaydet" aria-label="Kaydet" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-brand hover:bg-brand-soft"><Check size={16} strokeWidth={3} /></button>
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
                      className={`w-[60px] rounded-lg border px-1.5 py-1.5 font-bold ${p.stock === 0 ? "border-brand text-brand" : p.stock <= p.critical_stock ? "border-warn text-warn" : "border-line"}`}
                    />
                    <button title="Kaydet" aria-label="Kaydet" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-brand hover:bg-brand-soft"><Check size={16} strokeWidth={3} /></button>
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
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <Link href={`/admin/urunler/${p.id}?geri=${encodeURIComponent(backHref)}`} className="font-bold text-brand">Düzenle</Link>
                    <DeleteProductButton id={p.id} name={p.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {listErr && <p className="p-6 text-center font-semibold text-red-700">Ürünler yüklenemedi: {listErr.message}</p>}
        {!listErr && total === 0 && <p className="p-6 text-center text-muted">Ürün bulunamadı.</p>}
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
            {(pageNo - 1) * PAGE + 1}–{Math.min(pageNo * PAGE, total)} / {total}
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
