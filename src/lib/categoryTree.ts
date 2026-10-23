// Kategori ağacı yardımcıları (en fazla 2 seviye: ana kategori → alt kategori)
type C = { id: string; name: string; sort_order: number; parent_id?: string | null };

const byOrder = (a: C, b: C) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "tr");

/** Ana kategoriler (üstü olmayan ya da üstü listede bulunmayan) */
export function topLevel<T extends C>(cats: T[]): T[] {
  const ids = new Set(cats.map((c) => c.id));
  return cats.filter((c) => !c.parent_id || !ids.has(c.parent_id)).sort(byOrder);
}

export function childrenOf<T extends C>(cats: T[], id: string): T[] {
  return cats.filter((c) => c.parent_id === id).sort(byOrder);
}

/** Ana kategori ve altındaki tüm kategori id'leri */
export function withDescendants(cats: C[], id: string): Set<string> {
  return new Set([id, ...cats.filter((c) => c.parent_id === id).map((c) => c.id)]);
}

/** Açılır listeler için: ana kategori, hemen altında "Ana › Alt" seçenekleri */
export function categoryOptions<T extends C>(cats: T[]): { id: string; label: string; depth: 0 | 1; cat: T }[] {
  const out: { id: string; label: string; depth: 0 | 1; cat: T }[] = [];
  for (const p of topLevel(cats)) {
    out.push({ id: p.id, label: p.name, depth: 0, cat: p });
    for (const ch of childrenOf(cats, p.id)) out.push({ id: ch.id, label: `${p.name} › ${ch.name}`, depth: 1, cat: ch });
  }
  return out;
}

/** Ana kategori id → (alt kategoriler dahil) ürün sayısı */
export function topCounts(cats: C[], products: { category_id: string | null }[]): Record<string, number> {
  const parentOf = new Map(cats.map((c) => [c.id, c.parent_id && cats.some((x) => x.id === c.parent_id) ? c.parent_id : c.id]));
  const out: Record<string, number> = {};
  for (const p of products) {
    const t = p.category_id ? parentOf.get(p.category_id) : undefined;
    if (t) out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}
