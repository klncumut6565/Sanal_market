"use client";
import { Heart } from "lucide-react";
import { toggleFavorite, useFavorites } from "@/store/favorites";

export function FavoriteButton({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  const favs = useFavorites();
  const on = favs.includes(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(id);
      }}
      aria-pressed={on}
      aria-label={on ? `${name} favorilerden çıkar` : `${name} favorilere ekle`}
      className={`grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-sm ring-1 ring-line transition active:scale-90 ${className}`}
    >
      <Heart size={17} className={on ? "fill-brand text-brand" : "text-ink/60"} />
    </button>
  );
}
