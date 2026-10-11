/** Admin menüleri arasında geçerken anında görünen iskelet ekran. */
export default function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Yükleniyor">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-200" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-line" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-line" />
    </div>
  );
}
