import { FavoritesClient } from "./FavoritesClient";

export const metadata = { title: "Favorilerim" };

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5">
      <h1 className="mb-4 text-2xl font-black">Favorilerim</h1>
      <FavoritesClient />
    </div>
  );
}
