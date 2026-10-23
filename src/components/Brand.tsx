import Image from "next/image";

/** Çorlu Sanal Market logosu: drone + devre "S" sepet işareti, "ÇORLU / SANAL MARKET" yazısı (lacivert → turkuaz). */
export function Brand({ size = "md", tagline = false }: { size?: "sm" | "md" | "lg"; tagline?: boolean }) {
  const h = size === "lg" ? 58 : size === "sm" ? 34 : 42;
  const city = size === "lg" ? "text-[30px]" : size === "sm" ? "text-[17px]" : "text-[21px]";
  const name = size === "lg" ? "text-[17px]" : size === "sm" ? "text-[9.5px]" : "text-[11.5px]";
  return (
    <span className="flex items-center gap-2">
      <Image src="/logo-mark.svg" alt="" width={Math.round(h * 1.2)} height={h} priority unoptimized style={{ height: h, width: "auto" }} />
      <span className="flex flex-col leading-none">
        <span className={`${city} font-black tracking-[0.04em] text-navy`}>ÇORLU</span>
        <span
          className={`${name} mt-0.5 bg-gradient-to-r from-navy to-accent bg-clip-text font-extrabold tracking-[0.12em] text-transparent`}
        >
          SANAL MARKET
        </span>
        {tagline && <span className="mt-1 text-[8px] font-bold tracking-[0.22em] text-muted">GELECEĞİN MARKET DENEYİMİ</span>}
      </span>
    </span>
  );
}
