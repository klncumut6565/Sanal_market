// Yönetim paneli: sağ üstte sabit mağaza modu (Otomatik / Açık / Kapalı) — tüm sayfalarda görünür
import { Clock, DoorClosed, DoorOpen } from "lucide-react";
import { setStoreMode } from "@/app/admin/actions";

type Props = { isOpen: boolean; forceOpen: boolean; openTime: string; closeTime: string };

export function StoreModeSwitch({ isOpen, forceOpen, openTime, closeTime }: Props) {
  const mode = !isOpen ? "kapali" : forceOpen ? "acik" : "otomatik";
  const opts = [
    { v: "otomatik", label: "Otomatik", title: `Çalışma saatlerine göre (${openTime}–${closeTime})`, Icon: Clock, on: "bg-ink text-white" },
    { v: "acik", label: "Açık", title: "Saat dışında da sipariş alınır", Icon: DoorOpen, on: "bg-emerald-600 text-white" },
    { v: "kapali", label: "Kapalı", title: "Sipariş alınmaz", Icon: DoorClosed, on: "bg-red-600 text-white" },
  ] as const;
  return (
    <form action={setStoreMode} className="flex items-center gap-2 rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-line backdrop-blur">
      <span className="hidden pl-2 text-xs font-bold text-muted sm:inline">Mağaza</span>
      {opts.map(({ v, label, title, Icon, on }) => (
        <button
          key={v}
          name="mode"
          value={v}
          title={title}
          aria-pressed={mode === v}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-black transition sm:text-sm ${
            mode === v ? on : "text-muted hover:bg-bg hover:text-ink"
          }`}
        >
          <Icon size={15} /> {label}
          {mode === v && v === "acik" && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
        </button>
      ))}
    </form>
  );
}
