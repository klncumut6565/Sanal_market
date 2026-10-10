import Image from "next/image";

/** Logo işareti + "Sanal Market" yazısı (logo renkleriyle). */
export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const h = size === "lg" ? 56 : size === "sm" ? 34 : 42;
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-[22px]";
  return (
    <span className="flex items-center gap-1.5">
      <Image src="/logo-mark.png" alt="" width={Math.round(h * 1.4)} height={h} priority className="h-auto" style={{ height: h, width: "auto" }} />
      <span className={`${text} font-black leading-none tracking-tight`}>
        <span className="text-ink">Sanal</span>
        <span className="text-brand">Market</span>
      </span>
    </span>
  );
}
