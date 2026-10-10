import type { Order, OrderStatus, StoreSettings } from "./types";

export type SlaTargets = Pick<StoreSettings, "sla_accept_min" | "sla_prepare_min" | "sla_delivery_min">;

/** Açık aşamalar: her birinin başlangıç zamanı, hedef süresi ve sonraki adımı */
export const STAGES: Record<"alindi" | "hazirlaniyor" | "yolda", {
  title: string;
  waitingFor: string;
  next: OrderStatus;
  action: string;
}> = {
  alindi: { title: "Yeni sipariş", waitingFor: "Onay bekliyor", next: "hazirlaniyor", action: "Onayla · Hazırlamaya başla" },
  hazirlaniyor: { title: "Hazırlanıyor", waitingFor: "Hazırlık süresi", next: "yolda", action: "Hazır · Kuryeye ver" },
  yolda: { title: "Kurye yolda", waitingFor: "Teslimat süresi", next: "teslim_edildi", action: "Teslim edildi" },
};

export const isOpen = (s: OrderStatus): s is "alindi" | "hazirlaniyor" | "yolda" =>
  s === "alindi" || s === "hazirlaniyor" || s === "yolda";

export function stageStart(o: Pick<Order, "status" | "created_at" | "preparing_at" | "dispatched_at">): string {
  if (o.status === "hazirlaniyor") return o.preparing_at ?? o.created_at;
  if (o.status === "yolda") return o.dispatched_at ?? o.preparing_at ?? o.created_at;
  return o.created_at;
}

export function stageTargetMin(status: OrderStatus, t: SlaTargets): number {
  if (status === "alindi") return t.sla_accept_min;
  if (status === "hazirlaniyor") return t.sla_prepare_min;
  if (status === "yolda") return t.sla_delivery_min;
  return 0;
}
