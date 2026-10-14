export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-60 animate-pulse rounded-2xl bg-white ring-1 ring-line" />
      ))}
    </div>
  );
}
