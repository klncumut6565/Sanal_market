// Supabase (PostgREST) tek istekte en fazla 1000 satır döndürür. Bu yardımcı sorguyu
// 1000'lik sayfalarla (range) tekrar çalıştırıp tüm satırları toplar.
// Sıralama benzersiz olmalı (ör. .order("name").order("id")), yoksa sayfalar arasında satır kayabilir.
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = [];
  for (let from = 0; from < 200_000; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return { data: out, error: null };
}
