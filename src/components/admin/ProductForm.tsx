"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ImagePlus, Loader2, ScanBarcode, X } from "lucide-react";
import { BarcodeScanner } from "./BarcodeScanner";
import { createClient } from "@/lib/supabase/client";
import { saveProduct, type ActionState } from "@/app/admin/actions";
import type { Category, Product } from "@/lib/types";
import { ProductImage } from "@/components/shop/ProductImage";

export function ProductForm({ product, categories, initialBarcode }: { product?: Product; categories: Category[]; initialBarcode?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProduct, {});
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState(product?.barcode ?? initialBarcode ?? "");
  const [scanning, setScanning] = useState(false);

  async function upload(file: File) {
    setUploadError(null);
    if (file.size > 3 * 1024 * 1024) return setUploadError("Görsel en fazla 3 MB olmalı.");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "31536000", contentType: file.type });
    if (error) setUploadError("Yükleme başarısız: " + error.message);
    else setImageUrl(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
    setUploading(false);
  }

  return (
    <form action={action} className="space-y-4">
      {scanning && (
        <BarcodeScanner
          onResult={(code) => {
            setBarcode(code);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="image_url" value={imageUrl} />

      <section className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-line sm:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          <ProductImage src={imageUrl || null} emoji={product?.emoji ?? null} alt="Ürün görseli" />
          <label className="btn-ghost w-full cursor-pointer py-2 text-sm">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} Görsel yükle
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {imageUrl && (
            <button type="button" onClick={() => setImageUrl("")} className="flex w-full items-center justify-center gap-1 text-xs font-semibold text-muted hover:text-brand">
              <X size={14} /> Görseli kaldır
            </button>
          )}
          {uploadError && <p className="text-xs font-semibold text-brand">{uploadError}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Ürün adı *" className="sm:col-span-2"><input name="name" required defaultValue={product?.name} className="input" /></F>
          <F label="Kategori">
            <select name="category_id" defaultValue={product?.category_id ?? ""} className="input">
              <option value="">— Seçin —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </F>
          <F label="Birim (ör. 1 kg, 500 g, 1 L)"><input name="unit_label" defaultValue={product?.unit_label ?? ""} className="input" /></F>
          <F label="Emoji (görsel yoksa)"><input name="emoji" defaultValue={product?.emoji ?? ""} maxLength={4} className="input" /></F>
          <F label="Bağlantı adı (slug)"><input name="slug" defaultValue={product?.slug ?? ""} placeholder="Boşsa addan üretilir" className="input" /></F>
          <F label="Barkod" className="sm:col-span-2">
            <div className="flex gap-2">
              <input name="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} inputMode="numeric" placeholder="Ör. 8690504012345" className="input font-mono" />
              <button type="button" onClick={() => setScanning(true)} className="btn-ghost shrink-0 px-3" aria-label="Kamerayla barkod okut">
                <ScanBarcode size={20} /> Okut
              </button>
            </div>
          </F>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:grid-cols-3">
        <F label="Fiyat (₺) *"><input name="price" required inputMode="decimal" defaultValue={product?.price ?? ""} className="input" /></F>
        <F label="İndirimli fiyat (₺)"><input name="sale_price" inputMode="decimal" defaultValue={product?.sale_price ?? ""} placeholder="Boş = indirim yok" className="input" /></F>
        <F label="Sıralama"><input name="sort_order" type="number" defaultValue={product?.sort_order ?? 0} className="input" /></F>
        <F label="Stok *"><input name="stock" type="number" min={0} required defaultValue={product?.stock ?? 0} className="input" /></F>
        <F label="Kritik stok uyarısı"><input name="critical_stock" type="number" min={0} defaultValue={product?.critical_stock ?? 5} className="input" /></F>
        <F label="Sipariş başına en fazla"><input name="max_per_order" type="number" min={1} defaultValue={product?.max_per_order ?? 20} className="input" /></F>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <F label="Açıklama"><textarea name="description" defaultValue={product?.description ?? ""} className="input min-h-24" /></F>
        <div className="flex flex-wrap gap-5 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} className="h-4 w-4 accent-brand" /> Satışta</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="is_featured" defaultChecked={product?.is_featured ?? false} className="h-4 w-4 accent-brand" /> Çok satanlarda göster</label>
        </div>
      </section>

      {state.error && <p className="rounded-lg bg-brand-soft p-3 text-sm font-semibold text-brand">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending || uploading} className="btn-primary">{pending && <Loader2 size={16} className="animate-spin" />} Kaydet</button>
        <Link href="/admin/urunler" className="btn-ghost">Vazgeç</Link>
      </div>
    </form>
  );
}

function F({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
