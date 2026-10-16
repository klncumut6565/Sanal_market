import Image from "next/image";

/** Logo işareti + "Çorlu Sanal Market" yazısı (logo renkleriyle). */
export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const h = size === "lg" ? 56 : size === "sm" ? 34 : 42;
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-[22px]";
  const city = size === "lg" ? "text-xs" : size === "sm" ? "text-[8px]" : "text-[10px]";
  return (
    <span className="flex items-center gap-1.5">
      <Image src="/logo-mark.png" alt="" width={Math.round(h * 1.4)} height={h} priority className="h-auto" style={{ height: h, width: "auto" }} />
      <span className="flex flex-col leading-none">
        <span className={`${city} mb-0.5 font-extrabold tracking-[0.35em] text-ink`}>ÇORLU</span>
        <span className={`${text} font-black leading-none tracking-tight`}>
          <span className="text-ink">Sanal</span>
          <span className="text-brand">Market</span>
        </span>
      </span>
    </span>
  );
}
