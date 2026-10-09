import { formatTL } from "@/lib/format";

export function Price({ price, sale, large = false }: { price: number; sale: number | null; large?: boolean }) {
  if (sale != null) {
    return (
      <div className="flex flex-col leading-tight">
        <span className={`text-muted line-through ${large ? "text-sm" : "text-xs"}`}>{formatTL(price)}</span>
        <span className={`font-extrabold text-brand ${large ? "text-2xl" : "text-[15px]"}`}>{formatTL(sale)}</span>
      </div>
    );
  }
  return <span className={`font-extrabold ${large ? "text-2xl" : "text-[15px]"}`}>{formatTL(price)}</span>;
}
