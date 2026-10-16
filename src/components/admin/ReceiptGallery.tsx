import Link from "next/link";
import { CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { formatDate, formatTL } from "@/lib/format";
import { reviewReceipt } from "@/app/admin/kuryeler/actions";

export type ReceiptRow = {
  id: number;
  order_id: string;
  path: string;
  amount: number | null;
  created_at: string;
  review_status: "bekliyor" | "onaylandi" | "sorunlu";
  review_note: string | null;
  /** Liste görünümünde üst satır (ör. "#105 · Ali · POS 250 ₺") ve sipariş bağlantısı */
  caption?: string;
  href?: string;
};

const BADGE: Record<ReceiptRow["review_status"], string> = {
  bekliyor: "bg-amber-100 text-amber-800",
  onaylandi: "bg-emerald-100 text-emerald-700",
  sorunlu: "bg-red-100 text-red-700",
};
const LABEL: Record<ReceiptRow["review_status"], string> = { bekliyor: "Kontrol bekliyor", onaylandi: "Onaylandı", sorunlu: "Sorunlu" };

/** POS fişi fotoğrafları (gizli depodan 1 saatlik imzalı bağlantı) + yönetici kontrol butonları */
export async function ReceiptGallery({ receipts, back, compact = false }: { receipts: ReceiptRow[]; back: string; compact?: boolean }) {
  if (!receipts.length) return null;
  const { supabase } = await requireAdmin();
  const { data: signed } = await supabase.storage.from("pos-receipts").createSignedUrls(receipts.map((r) => r.path), 3600);
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
      {receipts.map((r) => {
        const url = urlOf.get(r.path);
        return (
          <div key={r.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-line">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" title="Büyük aç">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="POS fişi" className="aspect-[3/4] w-full bg-bg object-cover" />
              </a>
            ) : (
              <div className="grid aspect-[3/4] place-items-center bg-bg text-xs text-muted">Görsel yok</div>
            )}
            <div className="space-y-1 p-2 text-xs">
              {r.caption &&
                (r.href ? (
                  <Link href={r.href} className="block truncate font-bold text-brand underline">
                    {r.caption}
                  </Link>
                ) : (
                  <p className="truncate font-bold">{r.caption}</p>
                ))}
              <div className="flex items-center justify-between gap-1">
                <b className="tabular-nums">{r.amount != null ? formatTL(r.amount) : "tutar yok"}</b>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${BADGE[r.review_status]}`}>{LABEL[r.review_status]}</span>
              </div>
              <p className="text-muted">{formatDate(r.created_at)}</p>
              {r.review_note && <p className="text-red-700">{r.review_note}</p>}
              <div className="flex gap-1 pt-0.5">
                {r.review_status !== "onaylandi" && (
                  <form action={reviewReceipt} className="flex-1">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="onaylandi" />
                    <input type="hidden" name="back" value={back} />
                    <button className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 font-bold text-white">
                      <CheckCircle2 size={13} /> Onayla
                    </button>
                  </form>
                )}
                {r.review_status !== "sorunlu" ? (
                  <form action={reviewReceipt} className="flex-1">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="sorunlu" />
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="note" value="Fiş tutarı / okunurluğu uygun değil" />
                    <button className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 font-bold text-red-700 ring-1 ring-red-200">
                      <AlertTriangle size={13} /> Sorunlu
                    </button>
                  </form>
                ) : (
                  <form action={reviewReceipt} className="flex-1">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="bekliyor" />
                    <input type="hidden" name="back" value={back} />
                    <button className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 font-bold text-muted ring-1 ring-line">
                      <RotateCcw size={13} /> Geri al
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
