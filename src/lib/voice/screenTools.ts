// Sesli asistanın EKRAN araçları: sayfayı kaydırma, ekranda GÖRÜNEN ürün / kategori / sekmeleri okuma ve tıklama.
// Veritabanına gitmez (veri çıkışı yok); yalnızca o an tarayıcıda görünen sayfa öğeleriyle çalışır.
// Asistan penceresi ve küresi ([data-asistan-ui]) yok sayılır.

export const norm = (t: string) =>
  t
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9çğıöşü%]+/g, " ")
    .trim();

export type ScreenItem = { no: number; type: "ürün" | "kategori" | "alt kategori" | "düğme" | "bağlantı"; name: string; el: HTMLElement };

function labelOf(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label")?.trim();
  const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  return (text || aria || el.getAttribute("title") || "").slice(0, 90);
}

/** Öğenin gerçekten ekranda (görünür alanda) olup olmadığı */
function onScreen(el: HTMLElement, panelTop: number): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const bottomLimit = Math.min(window.innerHeight, panelTop);
  if (r.bottom <= 0 || r.top >= bottomLimit || r.right <= 0 || r.left >= window.innerWidth) return false;
  // Ortası başka bir öğenin (ör. asistan paneli) altında kalıyorsa sayma
  const cx = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2));
  const cy = Math.min(bottomLimit - 1, Math.max(0, r.top + Math.min(r.height / 2, 20)));
  const top = document.elementFromPoint(cx, cy);
  if (top && top.closest("[data-asistan-ui]")) return false;
  const st = getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) > 0.05;
}

/** Ekranda görünen tıklanabilir öğeler (ürünler önce). */
export function visibleItems(): ScreenItem[] {
  const panel = document.querySelector<HTMLElement>("[data-asistan-panel]");
  const panelTop = panel ? panel.getBoundingClientRect().top : Infinity;
  const seen = new Set<string>();
  const out: Omit<ScreenItem, "no">[] = [];
  const add = (type: ScreenItem["type"], name: string, el: HTMLElement, key: string) => {
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push({ type, name, el });
  };

  // Ürün kartları: aynı ürüne giden görsel + ad bağlantısı tek sayılır; ad metni olanı tercih edilir
  const urun = new Map<string, HTMLElement>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>('main a[href^="/urun/"], a[href^="/urun/"]')) {
    if (a.closest("[data-asistan-ui]") || !onScreen(a, panelTop)) continue;
    const href = a.getAttribute("href")!;
    const prev = urun.get(href);
    // Ad yazısı olan bağlantıyı tercih et (görsel bağlantısında yalnızca emoji / boş metin olur)
    const harfli = (e: HTMLElement) => /[a-zçğıöşü]{2}/i.test(labelOf(e));
    if (!prev || (!harfli(prev) && harfli(a))) urun.set(href, a);
  }
  for (const [href, a] of urun) add("ürün", /[a-zçğıöşü]{2}/i.test(labelOf(a)) ? labelOf(a) : a.querySelector("img")?.getAttribute("alt") || href.slice(6).replace(/-/g, " "), a, href);

  for (const t of document.querySelectorAll<HTMLElement>('[role="tab"]')) {
    if (t.closest("[data-asistan-ui]") || !onScreen(t, panelTop)) continue;
    add("alt kategori", labelOf(t).replace(/\s*\d[\d.]*$/, ""), t, `tab:${labelOf(t)}`);
  }
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href^="/kategori/"]')) {
    if (a.closest("[data-asistan-ui]") || !onScreen(a, panelTop)) continue;
    const href = a.getAttribute("href")!.split("?")[0];
    const name = labelOf(a).replace(/\s*[\d.]+\s*ürün\s*$/i, "");
    add(a.closest('[aria-label="Alt kategoriler"]') ? "alt kategori" : "kategori", name, a, href);
  }
  for (const el of document.querySelectorAll<HTMLElement>("main a[href], main button")) {
    if (el.closest("[data-asistan-ui]") || !onScreen(el, panelTop)) continue;
    const href = el.getAttribute("href");
    if (href?.startsWith("/urun/") || href?.startsWith("/kategori/") || el.getAttribute("role") === "tab") continue;
    const name = labelOf(el);
    if (name.length < 2) continue;
    // Ürün kartındaki adet / favori düğmeleri ekran listesini kalabalıklaştırmasın
    if (/^(azalt|artır|[‹›<>])$|sepete ekle|favori/i.test(name) || /sepete ekle|favori/i.test(el.getAttribute("aria-label") ?? "")) continue;
    add(el.tagName === "A" ? "bağlantı" : "düğme", name, el, `${el.tagName}:${href ?? ""}:${name}`);
  }
  return out.slice(0, 40).map((x, i) => ({ ...x, no: i + 1 }));
}

/** Söylenen ada / sıraya en uygun görünen öğe. */
export function matchItem(items: ScreenItem[], query: string): { item?: ScreenItem; options?: string[] } {
  const q = norm(query);
  if (!q) return {};
  // "üçüncü ürün", "2. ürün", "ilk ürün"
  const sira: Record<string, number> = { ilk: 1, birinci: 1, ikinci: 2, üçüncü: 3, dördüncü: 4, beşinci: 5, altıncı: 6, yedinci: 7, sekizinci: 8, son: -1 };
  const m = q.match(/^(\d+)\s*(?:\.|nci|inci|uncu|üncü)?\s*(ürün|kategori)?/) ?? null;
  const w = q.split(" ")[0];
  const n = m ? Number(m[1]) : sira[w];
  if (n) {
    const wantProduct = !/kategori/.test(q);
    const pool = items.filter((i) => (wantProduct ? i.type === "ürün" : i.type !== "ürün"));
    const list = pool.length ? pool : items;
    const it = n === -1 ? list[list.length - 1] : list[n - 1];
    if (it) return { item: it };
  }
  const words = q.split(" ").filter((x) => x.length >= 2);
  let best: ScreenItem | undefined;
  let bestScore = 0;
  const ties: ScreenItem[] = [];
  for (const it of items) {
    const name = norm(it.name);
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 70;
    else {
      const hit = words.filter((x) => name.includes(x) || name.split(" ").some((nw) => nw.startsWith(x.slice(0, Math.max(3, x.length - 2)))));
      score = words.length ? (hit.length / words.length) * 60 : 0;
    }
    if (it.type === "ürün") score += 1; // eşitlikte ürünü tercih et
    if (score > bestScore + 0.5) {
      best = it;
      bestScore = score;
      ties.length = 0;
      ties.push(it);
    } else if (Math.abs(score - bestScore) <= 0.5 && score > 0) ties.push(it);
  }
  if (!best || bestScore < 35) return {};
  if (bestScore < 70 && ties.length > 1) return { options: ties.slice(0, 5).map((t) => t.name) };
  return { item: best };
}

export function scrollPage(direction: string, amount: string): { ok: true; at: string } {
  const h = window.innerHeight;
  const step = amount === "az" ? h * 0.4 : h * 0.8;
  if (direction === "top") window.scrollTo({ top: 0, behavior: "smooth" });
  else if (direction === "bottom") window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  else window.scrollBy({ top: direction === "up" ? -step : step, behavior: "smooth" });
  const max = document.documentElement.scrollHeight - h;
  const y = direction === "top" ? 0 : direction === "bottom" ? max : Math.min(max, Math.max(0, window.scrollY + (direction === "up" ? -step : step)));
  return { ok: true, at: y <= 2 ? "sayfanın en üstü" : y >= max - 2 ? "sayfanın en altı" : "sayfanın ortası" };
}

/** Kaydırma animasyonu bitsin diye kısa bekleme (ekrandaki öğeler güncel okunsun) */
export const settle = (ms = 450) => new Promise((r) => setTimeout(r, ms));
