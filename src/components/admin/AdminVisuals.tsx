"use client";
import { tlv, type AdminVisual } from "@/lib/voice/adminVisual";

/** Sesli raporun panelde gösterdiği özet kutuları, çubuk grafikler ve tablolar (koyu panel teması). */
export function AdminVisuals({ visuals }: { visuals: AdminVisual[] }) {
  if (!visuals.length) return null;
  return (
    <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-0.5">
      {visuals.map((v, i) => (
        <div key={i} className="rounded-2xl bg-white/[0.07] p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/60">{v.title}</p>
          {v.kind === "kpis" && <Kpis v={v} />}
          {v.kind === "bars" && <Bars v={v} />}
          {v.kind === "table" && <Table v={v} />}
        </div>
      ))}
    </div>
  );
}

function Kpis({ v }: { v: Extract<AdminVisual, { kind: "kpis" }> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {v.items.map((k) => (
        <div key={k.label} className="rounded-xl bg-white/[0.06] px-2.5 py-2">
          <p className="text-[11px] text-white/60">{k.label}</p>
          <p className="text-base font-black tabular-nums leading-tight">{k.value}</p>
          {(k.delta != null || k.hint) && (
            <p className="mt-0.5 text-[11px] tabular-nums">
              {k.delta != null && (
                <span className={`font-bold ${k.delta > 0 ? "text-emerald-300" : k.delta < 0 ? "text-red-300" : "text-white/60"}`}>
                  {k.delta > 0 ? "▲" : k.delta < 0 ? "▼" : "•"} %{Math.abs(k.delta).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                </span>
              )}
              {k.hint && <span className="ml-1 text-white/50">{k.hint}</span>}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Bars({ v }: { v: Extract<AdminVisual, { kind: "bars" }> }) {
  const max = Math.max(1, ...v.items.map((x) => x.value));
  const fmt = (n: number) => (v.unit === "tl" ? tlv(n) : n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }));
  // Çok sayıda kısa etiket (günler) → dikey sütun grafiği; az sayıda uzun etiket (ürün/müşteri) → yatay çubuklar
  const vertical = v.items.length > 6 && v.items.every((x) => x.label.length <= 8);
  if (vertical)
    return (
      <div>
        <div className="flex h-28 items-end gap-[3px]">
          {v.items.map((x, i) => (
            <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" title={`${x.label}: ${fmt(x.value)}`}>
              <div className="rounded-t-[3px] bg-gradient-to-t from-fuchsia-500 to-violet-400 transition group-hover:bg-white" style={{ height: `${Math.max(x.value > 0 ? 3 : 0, (x.value / max) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-white/50">
          <span>{v.items[0]?.label}</span>
          <span>en yüksek {fmt(max)}</span>
          <span>{v.items[v.items.length - 1]?.label}</span>
        </div>
      </div>
    );
  return (
    <ul className="space-y-1.5">
      {v.items.map((x, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-semibold">{x.label}</span>
            <span className="shrink-0 tabular-nums">
              <b>{fmt(x.value)}</b>
              {x.sub && <span className="ml-1 text-white/50">{x.sub}</span>}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${(x.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Table({ v }: { v: Extract<AdminVisual, { kind: "table" }> }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-white/50">
          {v.columns.map((c, i) => (
            <th key={c} className={`pb-1 font-semibold ${i ? "text-right" : ""}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {v.rows.map((r, i) => (
          <tr key={i} className={v.alert?.[i] ? "text-red-300" : ""}>
            {r.map((c, j) => (
              <td key={j} className={`py-1 ${j ? "whitespace-nowrap pl-2 text-right tabular-nums" : "pr-1"}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
