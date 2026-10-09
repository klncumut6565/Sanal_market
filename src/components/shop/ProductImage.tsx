import Image from "next/image";

export function ProductImage({
  src,
  emoji,
  alt,
  size = "md",
}: {
  src: string | null;
  emoji: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "sm" ? "h-14 w-14 rounded-lg text-2xl" : size === "lg" ? "aspect-square w-full rounded-2xl text-8xl" : "aspect-square w-full rounded-xl text-5xl";
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-white ${box}`}>
        <Image src={src} alt={alt} fill sizes={size === "lg" ? "(max-width:768px) 100vw, 480px" : "200px"} className="object-contain p-1" />
      </div>
    );
  }
  return (
    <div className={`grid place-items-center bg-gradient-to-br from-brand-soft to-white ${box}`} aria-hidden>
      <span>{emoji ?? "🛒"}</span>
    </div>
  );
}
