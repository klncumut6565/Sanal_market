// Kategori kutuları için 3D simgeler (Microsoft Fluent Emoji 3D, MIT lisansı — public/kategori3d/<kod>.webp, 160px).
// Kategorinin emojisine göre seçilir; kenar menüsünde ve çiplerde düz emoji kullanılmaya devam eder.
const AVAILABLE = new Set(["1f330", "1f336", "1f33d", "1f33e", "1f344", "1f345", "1f347", "1f349", "1f34a", "1f34b", "1f34c", "1f34e", "1f353", "1f354", "1f355", "1f357", "1f35a", "1f35c", "1f35d", "1f35e", "1f364", "1f366", "1f368", "1f369", "1f36a", "1f36b", "1f36c", "1f36d", "1f36f", "1f373", "1f375", "1f376", "1f377", "1f378", "1f379", "1f37a", "1f37b", "1f37c", "1f37d", "1f37e", "1f37f", "1f381", "1f382", "1f3a7", "1f41f", "1f431", "1f436", "1f43e", "1f48a", "1f4a1", "1f4a7", "1f4e6", "1f4f1", "1f50b", "1f50c", "1f56f", "1f6ac", "1f6cd", "1f6d2", "1f942", "1f943", "1f944", "1f950", "1f951", "1f952", "1f954", "1f955", "1f956", "1f957", "1f958", "1f95a", "1f95b", "1f95c", "1f95e", "1f961", "1f964", "1f965", "1f966", "1f968", "1f969", "1f96a", "1f96b", "1f96c", "1f990", "1f9c0", "1f9c1", "1f9c2", "1f9c3", "1f9c4", "1f9c5", "1f9c7", "1f9c8", "1f9c9", "1f9ca", "1f9cb", "1f9e6", "1f9ef", "1f9f4", "1f9f7", "1f9f8", "1f9f9", "1f9fa", "1f9fb", "1f9fc", "1f9fd", "1fa79", "1fa92", "1faa3", "1faa5", "1fad2", "1fad6", "1fad8", "1fad9", "2615", "26a1"]);

const codeOf = (emoji: string) =>
  [...emoji]
    .filter((c) => c !== "\ufe0f")
    .map((c) => c.codePointAt(0)!.toString(16))
    .join("-");

/** Emojinin 3D görseli varsa yolunu döndürür. */
export function art3d(emoji: string | null | undefined): string | null {
  if (!emoji) return null;
  const k = codeOf(emoji.trim());
  return AVAILABLE.has(k) ? `/kategori3d/${k}.webp` : null;
}
