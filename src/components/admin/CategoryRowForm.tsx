"use client";
import { useActionState, useRef, useState } from "react";
import { ClipboardPaste, ImagePlus, Loader2, X } from "lucide-react";
import { imageFromClipboard, imageFromPaste, uploadImageBlob, uploadImageFromUrl, type UploadResult } from "@/lib/imageUpload";
import { CATEGORY_EMOJIS } from "@/lib/categoryEmoji";
import { deleteCategory, saveCategory, setCategoryImage, type ActionState } from "@/app/admin/actions";
import type { Category } from "@/lib/types";

export function CategoryRowForm({
  category,
  productCount,
  total,
  parents = [],
  parentId,
  parentName,
  subCount,
}: {
  category?: Category;
  productCount?: number;
  total?: number;
  /** Ana kategoriler (alt kategoriyi taşımak için) */
  parents?: { id: string; name: string }[];
  /** Yeni alt kategori formu: hangi ana kategorinin altına */
  parentId?: string;
  parentName?: string;
  /** Ana kategori satırında: alt kategorilerdeki ürün sayısı */
  subCount?: number;
}) {
  const isSub = !!(parentId || category?.parent_id);
  const hasParentSelect = !!category && !!category.parent_id; // alt kategoriyi başka ana kategoriye taşıyabil
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCategory, {});
  const [emoji, setEmoji] = useState(category?.emoji ?? "");
  const [pick, setPick] = useState(false);
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? "");
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyImage = async (p: Promise<UploadResult> | null, remove = false) => {
    setImgErr(null);
    let url: string | null = null;
    if (!remove && p) {
      setImgBusy(true);
      const r = await p;
      setImgBusy(false);
      if (!r.ok) return setImgErr(r.error);
      url = r.url;
    }
    setImageUrl(url ?? "");
    // Kayıtlı kategoride hemen kaydet; yenisinde "Ekle" ile kaydedilir
    if (category) {
      const r = await setCategoryImage(category.id, url);
      if (!r.ok) setImgErr(r.error ?? "Kaydedilemedi");
    }
  };
  const fromBlob = (b: Blob) => applyImage(uploadImageBlob(b, "kategori", 640));
  const fromUrl = (u: string) => applyImage(uploadImageFromUrl(u, "kategori", 640));
  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-2" key={category ? undefined : state.ok}>
        {category && <input type="hidden" name="id" value={category.id} />}
        {parentId && <input type="hidden" name="parent_id" value={parentId} />}
        <input type="hidden" name="emoji" value={emoji} />
        <input type="hidden" name="image_url" value={imageUrl} />
        {/* Görsel kutusu: tıkla + Ctrl/⌘+V ile yapıştır, sürükle-bırak */}
        <div
          tabIndex={0}
          role="button"
          aria-label="Kategori kapak fotoğrafı — tıklayıp yapıştırın"
          title="Ana sayfadaki kategori kutusunun kapak fotoğrafı. Tıkla ve Ctrl+V ile yapıştır ya da sürükle. (Kenar menüsünde emoji kullanılır.)"
          onPaste={(e) => {
            const x = imageFromPaste(e.clipboardData);
            if (!x) return;
            e.preventDefault();
            void (x.file ? fromBlob(x.file) : fromUrl(x.url!));
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
            if (f) void fromBlob(f);
            else {
              const u = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")).split("\n")[0].trim();
              if (u) void fromUrl(u);
            }
          }}
          className="relative grid h-14 w-14 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          {imgBusy ? (
            <Loader2 size={18} className="animate-spin text-brand" />
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-center text-[9px] font-semibold leading-tight text-muted">
              kapak
              <br />
              fotoğrafı
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={() => fileRef.current?.click()} title="Dosyadan görsel yükle" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-bg hover:text-brand">
            <ImagePlus size={14} />
          </button>
          <button
            type="button"
            title="Panodan yapıştır"
            onClick={async () => {
              const r = await imageFromClipboard();
              if ("error" in r) return setImgErr(r.error);
              void (r.blob ? fromBlob(r.blob) : fromUrl(r.url!));
            }}
            className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-bg hover:text-brand"
          >
            <ClipboardPaste size={14} />
          </button>
          {imageUrl && (
            <button type="button" title="Kapak fotoğrafını kaldır (3D simge kullanılır)" onClick={() => void applyImage(null, true)} className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-bg hover:text-red-600">
              <X size={14} />
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void fromBlob(e.target.files[0])} />
        </div>
        <button
          type="button"
          onClick={() => setPick((p) => !p)}
          title="Simge seç"
          className="input grid w-16 place-items-center text-2xl"
          aria-label="Simge seç"
        >
          {emoji || <span className="text-xs text-muted">simge</span>}
        </button>
        <input name="name" required defaultValue={category?.name} placeholder={parentName ? `Alt kategori adı (${parentName} altında)` : "Kategori adı"} className="input min-w-40 flex-1" />
        {hasParentSelect && (
          <select name="parent_id" defaultValue={category?.parent_id ?? ""} title="Ana kategori" className="input w-auto py-2 text-sm">
            {parents
              .filter((p) => p.id !== category?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  ↳ {p.name}
                </option>
              ))}
            <option value="">— Ana kategori yap —</option>
          </select>
        )}
        {category ? (
          <label className="flex items-center gap-1.5 text-sm font-semibold" title="Diziliş sırası">
            Sıra
            <input name="sort_order" type="number" min={1} defaultValue={category.sort_order} className="input w-20" />
          </label>
        ) : (
          <label className="flex w-full items-center gap-2 text-sm font-semibold">
            Diziliş sırası
            <input
              name="sort_order"
              type="number"
              min={1}
              max={(total ?? 0) + 1}
              defaultValue={(total ?? 0) + 1}
              className="input w-24"
            />
            <span className="text-xs font-normal text-muted">Yazdığın sıradaki ve sonraki kategoriler bir sıra aşağı kayar.</span>
          </label>
        )}
        {isSub ? (
          <span className="text-xs text-muted" title="Alt kategori görünürlük ve 22–06 ayarını ana kategoriden alır">
            👁 Ana kategoriden
          </span>
        ) : (
        <>
        <select
          name="visibility"
          defaultValue={category?.visibility ?? "herkes"}
          title="Bu kategoriyi kimler görebilir?"
          className="input w-auto py-2 text-sm"
        >
          <option value="herkes">👁 Herkes görür</option>
          <option value="uye">👤 Yalnızca üyeler</option>
          <option value="onayli">🔵 Mavi tikli üyeler</option>
          <option value="ozel">🚬 Sigara tikli üyeler</option>
          <option value="kapali">🚫 Müşteriye kapalı (mevzuat)</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm font-semibold" title="Türkiye'de 22:00–06:00 arası alkol perakende satışı yasak">
          <input type="checkbox" name="night_ban" defaultChecked={category?.night_ban ?? false} className="h-4 w-4 accent-brand" /> 22–06 satış yok
        </label>
        </>
        )}
        <label className="flex items-center gap-1.5 text-sm font-semibold">
          <input type="checkbox" name="is_active" defaultChecked={category?.is_active ?? true} className="h-4 w-4 accent-brand" /> Aktif
        </label>
        <button disabled={pending} className="btn-primary py-2">{category ? "Kaydet" : "Ekle"}</button>
        {category && (
          <button
            formAction={deleteCategory}
            formNoValidate
            onClick={(e) => {
              if (!confirm(`"${category.name}" silinsin mi? Ürünleri kategorisiz kalır${category.parent_id ? "" : "; alt kategorileri ana kategori olur"}.`)) e.preventDefault();
            }}
            className="px-2 text-sm font-semibold text-muted hover:text-brand"
          >
            Sil
          </button>
        )}
        {pick && (
          <div className="flex w-full flex-wrap gap-1 rounded-xl bg-bg p-2 ring-1 ring-line">
            {CATEGORY_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setEmoji(e);
                  setPick(false);
                }}
                className={`grid h-10 w-10 place-items-center rounded-lg text-xl hover:bg-white ${emoji === e ? "bg-white ring-2 ring-brand" : ""}`}
              >
                {e}
              </button>
            ))}
            <button type="button" onClick={() => { setEmoji(""); setPick(false); }} className="h-10 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-white">
              Otomatik
            </button>
          </div>
        )}
      </form>
      <div className="mt-1 flex gap-3 text-xs">
        {category && (
          <span className="text-muted">
            {productCount} ürün{subCount != null ? ` (+ alt kategorilerde ${subCount})` : ""} · /kategori/{category.slug}
          </span>
        )}
        {state.error && <span className="font-semibold text-brand">{state.error}</span>}
        {imgErr && <span className="font-semibold text-brand">{imgErr}</span>}
        {state.ok && <span className="font-semibold text-ok">{state.ok}</span>}
      </div>
    </div>
  );
}
