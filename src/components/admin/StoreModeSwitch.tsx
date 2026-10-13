// Siparişler ekranı: mağaza modu (Otomatik / Açık / Kapalı)
import { Clock, DoorClosed, DoorOpen } from "lucide-react";
import { setStoreMode } from "@/app/admin/actions";

type Props = { isOpen: boolean; forceOpen: boolean; openTime: string; closeTime: string };

export function StoreModeSwitch({ isOpen, forceOpen, openTime, closeTime }: Props) {
  const mode = !isOpen ? "kapali" : forceOpen ? "acik" : "otomatik";
  const opts = [
    { v: "otomatik", label: "Otomatik", sub: `${openTime}–${closeTime} arası`, Icon: Clock, on: "bg-ink text-white" },
    { v: "acik", label: "Açık", sub: "saat dışında da sipariş", Icon: DoorOpen, on: "bg-emerald-600 text-white" },
    { v: "kapali", label: "Kapalı", sub: "sipariş alınmaz", Icon: DoorClosed, on: "bg-red-600 text-white" },
  ] as const;
  return (
    <div className="space-y-1.5 rounded-2xl bg-white p-3 ring-1 ring-line">
      <p className="text-sm font-bold">Mağaza modu</p>
      <form action={setStoreMode} className="grid grid-cols-3 gap-1.5">
        {opts.map(({ v, label, sub, Icon, on }) => (
          <button
            key={v}
            name="mode"
            value={v}
            aria-pressed={mode === v}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-center transition ${mode === v ? on : "bg-bg text-muted hover:text-ink"}`}
          >
            <span className="flex items-center gap-1.5 text-sm font-black"><Icon size={16} /> {label}</span>
            <span className="text-[11px] leading-tight opacity-80">{sub}</span>
          </button>
        ))}
      </form>
      {mode === "acik" && (
        <p className="rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-800">
          Mağaza çalışma saatleri dışında da sipariş alıyor. Normale dönmek için <b>Otomatik</b>&apos;i seç.
        </p>
      )}
      {mode === "kapali" && <p className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">Mağaza kapalı: müşteriler sipariş veremez (sepete ekleyebilir).</p>}
    </div>
  );
}
