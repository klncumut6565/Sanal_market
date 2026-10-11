"use client";
import { useState } from "react";
import { MessageCircle, PackageX, Repeat } from "lucide-react";
import { orderItemOut } from "@/app/admin/actions";
import { formatTL } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import type { Order, OrderItem } from "@/lib/types";

export type Alt = { id: string; name: string; unit_label: string | null; price: number; stock: number };

type Props = {
  order: Pick<Order, "id" | "order_no" | "customer_name" | "phone">;
  items: OrderItem[];
  alternatives: Record<string, Alt[]>; // item.id → benzer ürünler
  editable: boolean;
};

const unit = (u: string | null) => (u ? ` (${u})` : "");

export function OrderItems({ order, items, alternatives, editable }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const first = order.customer_name.split(" ")[0];
  const active = items.filter((i) => !i.removed);
  const removed = items.filter((i) => i.removed);

  return (
    <div className="divide-y divide-line">
      {[...active, ...removed].map((it) => {
        const alts = alternatives[it.id] ?? [];
        const msg =
          `Merhaba ${first}, #${order.order_no} numaralı siparişinizdeki ${it.product_name}${unit(it.unit_label)} maalesef stokta kalmadı. ` +
          (alts.length
            ? `Yerine ${alts
                .slice(0, 3)
                .map((a) => `${a.name}${unit(a.unit_label)} – ${formatTL(a.price)}`)
                .join(" veya ")} gönderebiliriz. Hangisini tercih edersiniz, yoksa ürünü siparişten çıkaralım mı?`
            : "Ürünü siparişinizden çıkarmamızı onaylıyor musunuz? Tutar buna göre güncellenecek.");
        return (
          <div key={it.id} className="py-2.5">
            <div className={`flex items-center gap-2 text-sm ${it.removed ? "text-muted" : ""}`}>
              <span className={`w-10 shrink-0 text-lg font-black ${it.removed ? "line-through" : ""}`}>{it.quantity}×</span>
              <span className="min-w-0 flex-1">
                <span className={it.removed ? "line-through" : "font-semibold"}>{it.product_name}</span>{" "}
                <span className="text-muted">{it.unit_label}</span>
                {it.replaced_from && <span className="block text-xs font-semibold text-sky-700">↻ {it.replaced_from} yerine</span>}
                {it.removed && <span className="block text-xs font-bold text-brand">Stokta yok · siparişten çıkarıldı</span>}
              </span>
              <span className={`shrink-0 text-right font-bold ${it.removed ? "line-through" : ""}`}>{formatTL(it.line_total)}</span>
              {editable && !it.removed && (
                <button
                  onClick={() => setOpenId(openId === it.id ? null : it.id)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 ${openId === it.id ? "bg-brand text-white ring-brand" : "text-brand ring-line"}`}
                >
                  Yok
                </button>
              )}
            </div>

            {openId === it.id && (
              <div className="mt-2 space-y-3 rounded-xl bg-brand-soft p-3">
                <p className="text-sm font-bold">“{it.product_name}” rafta yok — ne yapalım?</p>

                <a
                  href={waLink(order.phone, msg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-sm font-bold text-white"
                >
                  <MessageCircle size={16} /> 1) Müşteriye WhatsApp&apos;tan sor
                </a>
                <p className="-mt-1 text-xs text-muted">Mesajda ürün adı{alts.length ? " ve benzer ürünler" : ""} yazılı gider. Müşterinin cevabına göre aşağıdan devam et.</p>

                {alts.length > 0 && (
                <form action={orderItemOut} className="space-y-2">
                  <input type="hidden" name="item_id" value={it.id} />
                  <input type="hidden" name="order_id" value={order.id} />
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input type="checkbox" name="mark_out" defaultChecked className="h-4 w-4 accent-brand" />
                    Ürünü sitede “Tükendi” yap (stok 0) — başka müşteri sipariş edemesin
                  </label>

                  {(
                    <div className="space-y-1.5 rounded-lg bg-white p-2.5">
                      <p className="text-xs font-bold">2a) Benzer ürünle değiştir</p>
                      {alts.map((a, i) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="replacement" value={a.id} defaultChecked={i === 0} className="accent-brand" />
                          <span className="min-w-0 flex-1 truncate">
                            {a.name} <span className="text-muted">{a.unit_label}</span>
                          </span>
                          <span className="shrink-0 font-semibold">{formatTL(a.price)}</span>
                          <span className="shrink-0 text-xs text-muted">stok {a.stock}</span>
                        </label>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs font-semibold">Adet</span>
                        <input name="qty" type="number" min={1} defaultValue={it.quantity} className="input w-20 py-1.5" />
                        <button className="btn-primary flex-1 py-2 text-sm">
                          <Repeat size={15} /> Değiştir
                        </button>
                      </div>
                    </div>
                  )}
                </form>
                )}

                <form action={orderItemOut}>
                  <input type="hidden" name="item_id" value={it.id} />
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="mark_out" value="on" />
                  <button className="btn-ghost w-full py-2 text-sm text-brand">
                    <PackageX size={15} /> {alts.length ? "2b) " : "2) "}Siparişten çıkar (tükendi yap)
                  </button>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
