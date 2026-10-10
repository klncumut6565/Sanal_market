import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { setOrderStatus } from "@/app/admin/actions";
import { STATUS_FLOW, STATUS_LABEL, formatTL } from "@/lib/format";
import { STAGES, isOpen, stageStart, stageTargetMin, type SlaTargets } from "@/lib/sla";
import type { Order } from "@/lib/types";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { SlaBar } from "./SlaBar";

const STEP_LABEL: Record<string, string> = {
  alindi: "Alındı",
  hazirlaniyor: "Hazırlanıyor",
  yolda: "Kurye yolda",
  teslim_edildi: "Teslim edildi",
};

/** Aşama adımları (●──●──○──○) */
export function OrderSteps({ order }: { order: Order }) {
  const idx = STATUS_FLOW.indexOf(order.status);
  const cancelled = order.status === "iptal";
  return (
    <ol className="flex items-start">
      {STATUS_FLOW.map((st, i) => {
        const done = !cancelled && i < idx;
        const current = !cancelled && i === idx;
        return (
          <li key={st} className="flex flex-1 flex-col items-center text-center last:flex-none">
            <div className="flex w-full items-center">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                  done ? "bg-emerald-600 text-white" : current ? "bg-brand text-white ring-4 ring-brand/25" : "bg-zinc-200 text-zinc-500"
                }`}
              >
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              {i < STATUS_FLOW.length - 1 && <span className={`mx-1 h-1 flex-1 rounded-full ${done ? "bg-emerald-600" : "bg-zinc-200"}`} />}
            </div>
            <span className={`mt-1 w-16 -translate-x-[18px] text-[11px] font-bold leading-tight ${current ? "text-brand" : done ? "" : "text-muted"}`}>
              {STEP_LABEL[st]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Sonraki adım butonu + iptal */
export function NextStepForm({ order, back, big = false }: { order: Order; back: string; big?: boolean }) {
  if (!isOpen(order.status)) return null;
  const stage = STAGES[order.status];
  return (
    <div className="flex gap-2">
      <form action={setOrderStatus} className="flex-1">
        <input type="hidden" name="id" value={order.id} />
        <input type="hidden" name="status" value={stage.next} />
        <input type="hidden" name="back" value={back} />
        <button className={`btn-primary w-full ${big ? "py-4 text-lg" : "py-2.5"}`}>
          {stage.action} <ChevronRight size={18} />
        </button>
      </form>
      <form action={setOrderStatus}>
        <input type="hidden" name="id" value={order.id} />
        <input type="hidden" name="status" value="iptal" />
        <input type="hidden" name="back" value={back} />
        <ConfirmSubmit
          message={`#${order.order_no} numaralı sipariş iptal edilsin mi? Ürünler stoğa geri eklenecek.`}
          className={`btn-ghost h-full px-3 text-sm text-muted hover:text-brand ${big ? "py-4" : ""}`}
        >
          İptal
        </ConfirmSubmit>
      </form>
    </div>
  );
}

/** Sipariş panosu kartı */
export function OrderCard({ order, sla }: { order: Order; sla: SlaTargets }) {
  const st = order.status;
  return (
    <article className="space-y-3 rounded-2xl bg-white p-3.5 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/siparisler/${order.id}`} className="min-w-0">
          <p className="font-black text-brand">#{order.order_no}</p>
          <p className="truncate text-sm font-bold">{order.customer_name}</p>
          <p className="truncate text-xs text-muted">{order.address}</p>
        </Link>
        <div className="shrink-0 text-right">
          <p className="font-black">{formatTL(order.total)}</p>
          <p className="text-xs text-muted">{order.payment_method === "kapida_pos" ? "Kapıda POS" : "Kapıda nakit"}</p>
          <p className="text-xs font-semibold">{order.delivery_slot}</p>
        </div>
      </div>
      {isOpen(st) ? (
        <SlaBar since={stageStart(order)} targetMin={stageTargetMin(st, sla)} label={STAGES[st].waitingFor} compact />
      ) : (
        <p className="text-sm font-bold text-muted">{STATUS_LABEL[st]}</p>
      )}
      <NextStepForm order={order} back="/admin/siparisler" />
    </article>
  );
}
