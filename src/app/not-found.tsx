import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <p className="text-6xl">🧺</p>
        <h1 className="mt-3 text-2xl font-black">Sayfa bulunamadı</h1>
        <Link href="/" className="btn-primary mt-5">Markete dön</Link>
      </div>
    </div>
  );
}
