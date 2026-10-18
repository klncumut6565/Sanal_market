"use client";
// Ürünler & stok: sıkıştırılmamış (WebP olmayan) görselleri tek tuşla WebP'ye çevirir. Parça parça çalışır, ilerlemeyi gösterir.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageDown, Loader2 } from "lucide-react";
import { compressNextImages, type CompressStatus } from "@/app/admin/imageActions";

export function ImageCompressor({ status }: { status: CompressStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [left, setLeft] = useState(status.count);
  const [saved, setSaved] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  if (status.count === 0 && !msg) return null;

  const run = async () => {
    setBusy(true);
    setMsg(null);
    let total = 0;
    let kb = 0;
    let failedTotal = 0;
    try {
      for (let i = 0; i < 100; i++) {
        const r = await compressNextImages(6);
        if (!r.ok) {
          setMsg("Hata: " + (r.error ?? "bilinmiyor"));
          break;
        }
        total += r.done;
        kb += r.savedKb;
        failedTotal += r.failed;
        setDone(total);
        setSaved(kb);
        setLeft(r.remaining);
        if (r.remaining === 0 || r.done === 0) break;
      }
      setMsg(`${total} görsel sıkıştırıldı · ${(kb / 1024).toFixed(1)} MB azaldı${failedTotal ? ` · ${failedTotal} görsel dönüştürülemedi` : ""}`);
      router.refresh();
    } catch {
      setMsg("Bağlantı kesildi; tekrar basarak kaldığı yerden devam edebilirsiniz.");
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-200">
      <ImageDown className="shrink-0 text-amber-700" size={20} />
      <p className="min-w-0 flex-1">
        {msg ? (
          <b>{msg}</b>
        ) : (
          <>
            <b>{left} ürün görseli sıkıştırılmamış</b> ({status.mb.toLocaleString("tr-TR")} MB). WebP&apos;ye çevirince ~%85–90 küçülür, veri çıkışı azalır; görünüm değişmez.
            {busy && (
              <span className="ml-1 text-muted">
                {done} tamam · {(saved / 1024).toFixed(1)} MB kazanıldı
              </span>
            )}
          </>
        )}
      </p>
      {left > 0 && (
        <button type="button" disabled={busy} onClick={run} className="btn-primary py-2 text-sm disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ImageDown size={16} />} {busy ? "Sıkıştırılıyor…" : "Görselleri sıkıştır"}
        </button>
      )}
    </div>
  );
}
