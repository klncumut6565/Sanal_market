"use client";
// Sesli asistan araçlarının tarayıcıda çalıştırılması (ürün arama, sepet işlemleri).
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/data/fetchAll";
import { useCart, cartTotals, lineUnit } from "@/store/cart";
import { hoursState } from "@/lib/hours";
import type { Product } from "@/lib/types";
import type { VoiceSettings, VoiceAction } from "./useMarketVoice";
import { fetchDiscounts } from "./discounts";
import { shopCategories, visibleIn } from "@/lib/shopCategories";
import { halusinasyonMu, kisaYankiMi, yankiMi } from "./halusinasyon";
import { pickBudgetBasket, type BudgetSlot } from "./budgetBasket";
import { matchWords } from "@/lib/trFold";

/** Sepet onayı: öneri bekletilir, müşterinin SONRAKİ konuşmasında açık "evet" aranır. */
export type CartProposal = {
  items: { product: Product; qty: number }[];
  /** Öneri anındaki kullanıcı konuşma sırası; yalnızca daha sonraki konuşmalar onay sayılır. */
  turnSeq: number;
  /** Öneriden sonra müşterinin söyledikleri (transkript). */
  reply: string;
};
export type CartGate = {
  get: () => CartProposal | null;
  set: (p: CartProposal | null) => void;
  currentTurn: () => number;
  /** Asistanın en son seslendirdiği cümle (yankı tespiti için). */
  lastAssistant: () => string;
};

const trNorm = (t: string) => t.toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, " ").trim();
// JS \b Türkçe harflerle çalışmadığı için kelime listesiyle kontrol.
const RED_KOK = ["bekle", "dur", "hayır", "hayir", "istemiyorum", "istemem", "vazgeç", "vazgec", "iptal", "düşün", "dusun", "şimdilik", "simdilik", "sonra", "olmasın", "olmasin", "ekleme", "yok", "değil", "degil"];
const ONAY_KELIME = new Set(["evet", "ekle", "ekleyin", "ekleyebilirsin", "eklensin", "eklesene", "olur", "tamam", "tamamdır", "onaylıyorum", "onay", "tabi", "tabii", "tabiki", "aynen", "kesinlikle", "lütfen", "he", "hıhı", "peki", "yes", "ok", "okey"]);
export function replyIntent(text: string): "red" | "onay" | "belirsiz" {
  const w = trNorm(text).split(" ").filter(Boolean);
  if (w.some((x) => RED_KOK.some((k) => x.startsWith(k)))) return "red";
  if (w.some((x) => ONAY_KELIME.has(x) || (x.startsWith("ekle") && !x.startsWith("ekleme")) || x.startsWith("evet"))) return "onay";
  return "belirsiz";
}

/** Market kapalıysa müşteriye söylenecek not (sipariş verilemez, sepet hazırlanabilir). */
export function closedNote(s: VoiceSettings): string | undefined {
  const h = hoursState(Date.now(), s.open_time, s.close_time, s.is_open, s.force_open);
  if (h.open) return undefined;
  if (!s.is_open || h.secondsToOpen == null) {
    return "Market şu an sipariş almıyor. Ürünleri sepete ekleyebilirsin, sipariş market açıldığında verilebilir.";
  }
  const hh = Math.floor(h.secondsToOpen / 3600);
  const mm = Math.floor((h.secondsToOpen % 3600) / 60);
  const kalan = hh ? `${hh} saat ${mm} dakika` : `${mm} dakika`;
  return `Market şu an kapalı; siparişler saat ${s.open_time}'da açılıyor (yaklaşık ${kalan} sonra). Şimdi sepete ürün eklenebilir ama sipariş ancak açılışta verilebilir.`;
}

// ------------------------------ Kayıtlı müşteri ------------------------------
type HistOrder = {
  order_no: number;
  created_at: string;
  status: string;
  total: number;
  order_items: { product_id: string | null; product_name: string; unit_label: string | null; quantity: number; removed: boolean }[];
};

const gunFarki = (iso: string) => {
  const g = (ms: number) => Math.floor((ms + 3 * 3600_000) / 86400_000); // İstanbul günü
  const d = g(Date.now()) - g(new Date(iso).getTime());
  return d <= 0 ? "bugün" : d === 1 ? "dün" : d < 7 ? `${d} gün önce` : d < 14 ? "geçen hafta" : `${Math.round(d / 7)} hafta önce`;
};

async function loadHistory(sb: ReturnType<typeof createClient>, limit: number) {
  const { data: auth } = await sb.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return null;
  const { data } = await sb
    .from("orders")
    .select("order_no,created_at,status,total,order_items(product_id,product_name,unit_label,quantity,removed)")
    .eq("user_id", uid)
    .neq("status", "iptal")
    .order("created_at", { ascending: false })
    .limit(limit);
  return { uid, orders: (data ?? []) as HistOrder[] };
}

/** Oturum başında: kayıtlı müşterinin adı ve sipariş geçmişi özeti (yalnızca giriş yapmış müşteri). */
async function prefsSummary(sb: ReturnType<typeof createClient>, uid: string) {
  const { data } = await sb.from("customer_prefs").select("note").eq("user_id", uid).order("created_at").limit(20);
  return data?.length ? `Hatırlanan tercihler: ${data.map((p) => p.note).join(" | ")}.` : "";
}

export async function loadCustomerContext(): Promise<{ firstName: string | null; summary: string | null } | null> {
  try {
    const sb = createClient();
    const h = await loadHistory(sb, 10);
    if (!h) return null;
    const { data: prof } = await sb.from("profiles").select("full_name").eq("id", h.uid).maybeSingle();
    const full = (prof?.full_name as string | null | undefined)?.trim() || "";
    const firstName = full ? full.split(/\s+/)[0] : null;
    if (!h.orders.length) return { firstName, summary: ["Müşterinin daha önce siparişi yok (ilk alışverişi).", await prefsSummary(sb, h.uid)].filter(Boolean).join(" ") };
    const last = h.orders[0];
    const lastItems = last.order_items.filter((i) => !i.removed).map((i) => `${i.quantity} × ${i.product_name}${i.unit_label ? ` (${i.unit_label})` : ""}`);
    const freq = new Map<string, { name: string; times: number; qty: number }>();
    for (const o of h.orders)
      for (const i of o.order_items) {
        if (i.removed) continue;
        const k = i.product_id ?? i.product_name;
        const f = freq.get(k) ?? { name: i.product_name, times: 0, qty: 0 };
        f.times += 1;
        f.qty += i.quantity;
        freq.set(k, f);
      }
    const prefsLine = await prefsSummary(sb, h.uid);
    const often = [...freq.values()].filter((f) => f.times >= 2).sort((a, b) => b.times - a.times).slice(0, 5);
    const lines = [
      `Toplam ${h.orders.length}${h.orders.length >= 10 ? "+" : ""} geçmiş sipariş.`,
      `Son sipariş ${gunFarki(last.created_at)}: ${lastItems.join(", ")}.`,
    ];
    if (often.length) lines.push(`Sık aldıkları: ${often.map((f) => `${f.name} (${f.times} siparişte)`).join(", ")}.`);
    if (prefsLine) lines.push(prefsLine);
    return { firstName, summary: lines.join(" ") };
  } catch {
    return null;
  }
}

function cartLabel(p: Product, qty: number) {
  return `${qty} × ${p.name}${p.unit_label ? ` (${p.unit_label})` : ""}`;
}

export type ShownProduct = Product & { proposedQty?: number };

const PRODUCT_COLS = "id,category_id,name,slug,description,unit_label,price,sale_price,stock,critical_stock,max_per_order,image_url,emoji,is_active,is_featured,sort_order";
const num = (p: Product): Product => ({ ...p, price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price) });

export function createMarketToolRunner(deps: {
  getSettings: () => VoiceSettings;
  navigate: (path: string) => void;
  log: (text: string, kind: VoiceAction["kind"]) => void;
  gate: CartGate;
  /** Asistanın bahsettiği ürünleri panelde görselleriyle göster */
  show?: (title: string, items: ShownProduct[]) => void;
}) {
  const { getSettings, navigate, log, gate } = deps;
  const show = deps.show ?? (() => {});
  const run = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const sb = createClient();
    const cart = useCart.getState();
    const s = getSettings();

    if (name === "search_products") {
      const q = String(args.query ?? "").trim().slice(0, 60);
      if (q.length < 2) return { error: "Arama kelimesi çok kısa." };
      let { data } = await sb.rpc("search_products", { q });
      if (!data?.length && q.includes(" ")) ({ data } = await sb.rpc("search_products", { q: q.split(/\s+/).pop() }));
      const cats = await shopCategories(sb);
      const catName = new Map(cats.map((c) => [c.id, c.name]));
      const list = ((data ?? []) as Product[]).map(num).sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)).slice(0, 8);
      if (!list.length) return { results: [], note: "Bu aramayla eşleşen ürün yok." };
      show(`“${q}” için bulunanlar`, list);
      return {
        results: list.map((p) => ({
          product_id: p.id,
          name: p.name,
          unit: p.unit_label,
          price: p.price,
          sale_price: p.sale_price,
          available: p.stock > 0,
          low_stock: p.stock > 0 && p.stock <= p.critical_stock ? p.stock : undefined,
          category: p.category_id ? catName.get(p.category_id) : undefined,
          in_cart: cart.lines.find((l) => l.id === p.id)?.qty ?? 0,
        })),
      };
    }

    if (name === "list_discounted_products") {
      const allowed = new Set((await shopCategories(sb)).map((c) => c.id));
      const r = await fetchDiscounts(sb, { query: args.query ? String(args.query) : undefined, limit: 15, categoryIds: allowed });
      if ("error" in r) return r;
      if (r.products.length) {
        const ids = r.products.map((p) => p.product_id);
        const { data: rows } = await sb.from("products").select(PRODUCT_COLS).in("id", ids);
        const byId = new Map(((rows ?? []) as Product[]).map((p) => [p.id, num(p)]));
        show("İndirimdeki ürünler", ids.map((id) => byId.get(id)).filter((p): p is Product => !!p));
      }
      // Müşteriye stok adedi gösterme; yalnızca var/yok
      return {
        ...r,
        products: r.products.map((p) => ({
          product_id: p.product_id,
          name: p.name,
          unit: p.unit,
          category: p.category,
          price: p.price,
          sale_price: p.sale_price,
          discount_pct: p.discount_pct,
          available: p.in_stock,
          in_cart: cart.lines.find((l) => l.id === p.product_id)?.qty ?? 0,
        })),
      };
    }

    if (name === "list_categories") {
      const [cats, { data: prods }] = await Promise.all([
        shopCategories(sb),
        fetchAll((f, t) => sb.from("products").select("category_id").eq("is_active", true).gt("stock", 0).order("id").range(f, t)),
      ]);
      const categories = cats.map((c) => ({ name: c.name, products_in_stock: (prods ?? []).filter((p) => p.category_id === c.id).length }));
      return { count: categories.length, categories, note: "Kategorilerin hepsini adlarıyla say." };
    }

    if (name === "remember_preference" || name === "forget_preference") {
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return { error: "Müşteri giriş yapmamış; tercihler yalnızca üye girişiyle hatırlanabilir. Bunu kısaca söyle." };
      const { data: rows } = await sb.from("customer_prefs").select("id,note").eq("user_id", uid).order("created_at");
      const list = rows ?? [];
      if (name === "forget_preference") {
        const about = trNorm(String(args.about ?? ""));
        const words = about.split(" ").filter((w) => w.length >= 3);
        const hit = list.filter((p) => {
          const n = trNorm(p.note);
          return about && (n.includes(about) || words.some((w) => n.includes(w)));
        });
        if (!hit.length) return { ok: false, note: "Bu konuda kayıtlı tercih yok.", saved: list.map((p) => p.note) };
        await sb.from("customer_prefs").delete().in("id", hit.map((p) => p.id));
        log(`🧠 Unutuldu: ${hit.map((p) => p.note).join(", ")}`, "info");
        return { ok: true, forgotten: hit.map((p) => p.note) };
      }
      const note = String(args.note ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
      if (note.length < 3) return { error: "Not boş." };
      if (list.some((p) => trNorm(p.note) === trNorm(note))) return { ok: true, note: "Zaten kayıtlı." };
      if (list.length >= 20) await sb.from("customer_prefs").delete().eq("id", list[0].id); // en eskisini çıkar
      const { error } = await sb.from("customer_prefs").insert({ user_id: uid, note });
      if (error) return { error: error.message };
      log(`🧠 Not edildi: ${note}`, "info");
      return { ok: true, saved: note };
    }

    if (name === "get_order_history") {
      const h = await loadHistory(sb, 10);
      if (!h) return { error: "Müşteri giriş yapmamış; geçmiş siparişler yalnızca üye girişiyle görülebilir." };
      if (!h.orders.length) return { orders: [], note: "Daha önce sipariş yok." };
      return {
        orders: h.orders.map((o) => ({
          order_no: o.order_no,
          when: gunFarki(o.created_at),
          status: o.status,
          total: Number(o.total),
          items: o.order_items.filter((i) => !i.removed).map((i) => ({ product_id: i.product_id, name: i.product_name, unit: i.unit_label, quantity: i.quantity })),
        })),
        note: "Bir ürünü tekrar önermeden önce search_products ile güncel fiyat ve stoğu kontrol et.",
      };
    }

    if (name === "list_category_products") {
      const norm = (t: string) => t.toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, " ").trim();
      const q = norm(String(args.category ?? ""));
      if (q.length < 2) return { error: "Kategori adı söylenmedi." };
      const all = await shopCategories(sb);
      const words = q.split(" ").filter((w) => w.length >= 3);
      const cat =
        all.find((c) => norm(c.name) === q) ??
        all.find((c) => norm(c.name).includes(q) || q.includes(norm(c.name))) ??
        all.find((c) => words.some((w) => norm(c.name).includes(w.slice(0, Math.max(3, w.length - 2)))));
      if (!cat) return { error: "Bu adla kategori bulunamadı.", categories: all.map((c) => c.name) };
      const { data: prods } = await sb
        .from("products")
        .select(PRODUCT_COLS)
        .eq("is_active", true)
        .eq("category_id", cat.id)
        .order("sort_order")
        .order("name")
        .limit(60);
      const list = (prods ?? []).map((p) => ({
        product_id: p.id,
        name: p.name,
        unit: p.unit_label,
        price: Number(p.price),
        sale_price: p.sale_price == null ? null : Number(p.sale_price),
        available: p.stock > 0,
      }));
      show(cat.name, ((prods ?? []) as Product[]).map(num).sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)).slice(0, 24));
      return {
        category: cat.name,
        products_in_stock: list.filter((p) => p.available).length,
        products: list.sort((a, b) => Number(b.available) - Number(a.available)),
      };
    }

    if (name === "propose_cart_items") {
      const raw = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
      const want = new Map<string, number>();
      for (const it of raw.slice(0, 15)) {
        const id = String(it?.product_id ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
        const q = Math.max(1, Math.min(50, Math.trunc(Number(it?.quantity) || 1)));
        want.set(id, (want.get(id) ?? 0) + q);
      }
      if (!want.size) return { ok: false, error: "Geçerli ürün yok. Önce search_products ile ara." };
      const [{ data }, cats] = await Promise.all([
        sb.from("products").select(PRODUCT_COLS).in("id", [...want.keys()]).eq("is_active", true),
        shopCategories(sb),
      ]);
      const canSee = visibleIn(new Set(cats.map((c) => c.id)));
      const items: CartProposal["items"] = [];
      const problems: string[] = [];
      for (const row of ((data ?? []) as Product[]).filter(canSee)) {
        const p = num(row);
        const cur = cart.lines.find((l) => l.id === p.id)?.qty ?? 0;
        const room = Math.min(p.stock, p.max_per_order) - cur;
        const req = want.get(p.id) ?? 1;
        if (room < 1) {
          problems.push(p.stock < 1 ? `${p.name} stokta yok` : `${p.name} için sınır dolu`);
          continue;
        }
        if (req > room) problems.push(`${p.name}: en fazla ${room} eklenebilir`);
        items.push({ product: p, qty: Math.min(req, room) });
      }
      if (want.size > (data ?? []).length) problems.push("bazı ürünler bulunamadı");
      if (!items.length) {
        gate.set(null);
        return { ok: false, error: "Önerilecek uygun ürün yok.", problems };
      }
      gate.set({ items, turnSeq: gate.currentTurn(), reply: "" });
      show("Sepete eklensin mi?", items.map((i) => ({ ...i.product, proposedQty: i.qty })));
      log(`❓ Onay bekleniyor: ${items.map((i) => cartLabel(i.product, i.qty)).join(", ")}`, "info");
      const total = items.reduce((t, i) => t + (i.product.sale_price ?? i.product.price) * i.qty, 0);
      return {
        ok: true,
        status: "ONAY_BEKLENIYOR — henüz EKLENMEDİ",
        proposed: items.map((i) => ({ name: i.product.name, unit: i.product.unit_label, quantity: i.qty, unit_price: i.product.sale_price ?? i.product.price })),
        total: +total.toFixed(2),
        problems: problems.length ? problems : undefined,
        store_closed: closedNote(s),
        next: "Müşteriye bu ürünleri miktarıyla söyle ve 'Sepete eklensin mi?' diye sor. Cevabı bekle.",
      };
    }

    if (name === "build_budget_basket") {
      const budget = Number(String(args.budget_tl ?? "").replace(",", "."));
      if (!Number.isFinite(budget) || budget < 20 || budget > 20_000) return { error: "Bütçe anlaşılamadı; kaç lira olduğunu sor." };
      const raw = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
      const wanted = raw
        .map((it) => ({ query: String(it?.query ?? "").trim().slice(0, 40), qty: Math.max(1, Math.min(10, Math.trunc(Number(it?.quantity) || 1))) }))
        .filter((w) => w.query.length >= 2)
        .slice(0, 12);
      if (!wanted.length) return { error: "Sepete girecek ürün türlerini (ör. peynir, zeytin, yumurta) items olarak ver." };
      const inCart = new Set(cart.lines.map((l) => l.id));
      const byId = new Map<string, Product>();
      const slots: BudgetSlot[] = await Promise.all(
        wanted.map(async (w) => {
          let { data } = await sb.rpc("search_products", { q: w.query });
          if (!data?.length && w.query.includes(" ")) ({ data } = await sb.rpc("search_products", { q: w.query.split(/\s+/).pop() }));
          const all = ((data ?? []) as Product[]).map(num).filter((p) => p.is_active && p.stock >= w.qty && Math.min(p.stock, p.max_per_order) >= w.qty && !inCart.has(p.id));
          const strict = all.filter((p) => matchWords(p.name, w.query));
          const list = (strict.length ? strict : all).slice(0, 12);
          list.forEach((p) => byId.set(p.id, p));
          return { query: w.query, qty: w.qty, options: list.map((p) => ({ id: p.id, name: p.name, unit: p.sale_price ?? p.price })).sort((a, b) => a.unit - b.unit) };
        }),
      );
      // Aynı ürün iki türe birden seçilmesin
      const seen = new Set<string>();
      for (const sl of slots) sl.options = sl.options.filter((o) => !seen.has(o.id) && (seen.add(o.id), true));
      const r = pickBudgetBasket(slots, budget);
      if (!r.picks.length) return { error: "Bu bütçeyle uygun ürün bulunamadı.", not_found: r.notFound, dropped: r.dropped };
      const proposal = (await run("propose_cart_items", { items: r.picks.map((p) => ({ product_id: p.option.id, quantity: p.qty })) })) as Record<string, unknown>;
      if (proposal?.ok) show(`${Math.round(budget)} TL bütçeli sepet — eklensin mi?`, r.picks.map((p) => ({ ...byId.get(p.option.id)!, proposedQty: p.qty })));
      return {
        ...proposal,
        budget_tl: budget,
        basket_total_tl: r.total,
        remaining_tl: Math.round((budget - r.total) * 100) / 100,
        left_out_for_budget: r.dropped.length ? r.dropped : undefined,
        not_found_in_store: r.notFound.length ? r.notFound : undefined,
        next: "Sepeti kısaca özetle: kaç ürün, toplam ve bütçeden kalan; bütçe yüzünden çıkarılan veya markette olmayan tür varsa söyle. Ürünlerin tamamını tek tek okuma, 'ekranda görebilirsin' de. Sonra 'Sepete eklensin mi?' diye sor ve bekle.",
      };
    }

    if (name === "confirm_cart_items") {
      const pend = gate.get();
      if (!pend) return { ok: false, added: [], error: "Bekleyen öneri yok. Önce propose_cart_items çağır ve müşteriye sor." };
      // Müşterinin konuşmasının yazıya dökümü araç çağrısından SONRA gelebilir — kısa süre bekle.
      for (let i = 0; i < 20 && !trNorm(pend.reply); i++) await new Promise((r) => setTimeout(r, 150));
      if (trNorm(pend.reply)) {
        // Cümlenin geri kalanı da gelsin ("evet … ama bekle" gibi)
        let last = pend.reply;
        for (let i = 0; i < 4; i++) {
          await new Promise((r) => setTimeout(r, 150));
          if (pend.reply === last) break;
          last = pend.reply;
        }
      }
      // Halüsinasyon / yankı filtresi (TMGD Asistan'daki önlemler): uydurma kalıplar
      // ("izlediğiniz için teşekkürler"), anlamsız tekrar veya asistanın kendi
      // sesinin mikrofona sızması ("sepete eklensin mi") müşteri cevabı SAYILMAZ.
      const asst = gate.lastAssistant();
      const sahte = halusinasyonMu(pend.reply) || yankiMi(pend.reply, asst) || kisaYankiMi(pend.reply, asst);
      if (sahte && trNorm(pend.reply)) {
        const duyulan = pend.reply.trim();
        pend.reply = "";
        return {
          ok: false,
          added: [],
          error: `EKLENMEDİ: duyulan ses ("${duyulan}") müşterinin cevabı gibi değil (gürültü/yankı olabilir). 'Sepete eklensin mi, evet mi hayır mı?' diye net bir cevap iste.`,
        };
      }
      const reply = trNorm(pend.reply);
      if (!reply) {
        return { ok: false, added: [], error: "EKLENMEDİ: müşteri henüz cevap vermedi. 'Sepete eklensin mi?' diye sor ve bekle." };
      }
      const intent = replyIntent(reply);
      if (intent === "red") {
        gate.set(null);
        return { ok: false, added: [], error: `EKLENMEDİ: müşteri onay vermedi ("${pend.reply.trim()}"). 'Tamam, bekliyorum' de.` };
      }
      if (intent !== "onay") {
        return { ok: false, added: [], error: `EKLENMEDİ: müşterinin cevabı açık bir onay değil ("${pend.reply.trim()}"). 'Sepete eklensin mi?' diye tekrar sor.` };
      }
      const added: { name: string; unit: string | null; quantity: number }[] = [];
      const limited: string[] = [];
      for (const { product: p, qty } of pend.items) {
        const st = useCart.getState();
        const cur = st.lines.find((l) => l.id === p.id)?.qty ?? 0;
        const target = Math.min(cur + qty, Math.min(p.stock, p.max_per_order));
        if (target <= cur) {
          limited.push(p.name);
          continue;
        }
        if (cur === 0) st.add(p);
        useCart.getState().setQty(p.id, target);
        added.push({ name: p.name, unit: p.unit_label, quantity: target - cur });
        if (target - cur < qty) limited.push(p.name);
      }
      gate.set(null);
      if (added.length) log(`🛒 Eklendi: ${added.map((a) => `${a.quantity} × ${a.name}`).join(", ")}`, "add");
      return {
        ok: added.length > 0,
        added,
        limited: limited.length ? limited : undefined,
        store_closed: closedNote(s),
        say: added.length ? "Müşteriye 'Sepete şu ürünler eklendi: …' diyerek added listesini miktarlarıyla söyle." : "Hiçbir ürün eklenemedi; nedenini söyle.",
      };
    }

    if (name === "remove_from_cart") {
      const id = String(args.product_id ?? "");
      const line = cart.lines.find((l) => l.id === id);
      if (!line) return { error: "Bu ürün sepette yok." };
      const q = args.quantity == null ? line.qty : Math.max(1, Math.trunc(Number(args.quantity)));
      const left = Math.max(0, line.qty - q);
      cart.setQty(id, left);
      log(`➖ ${Math.min(q, line.qty)} × ${line.name} çıkarıldı`, "remove");
      return { ok: true, product: line.name, removed: Math.min(q, line.qty), left };
    }

    if (name === "get_cart") {
      const lines = useCart.getState().lines;
      const t = cartTotals(lines, s.delivery_fee, s.free_delivery_threshold);
      return {
        items: lines.map((l) => ({ product_id: l.id, name: l.name, unit: l.unit_label, quantity: l.qty, line_total: +(lineUnit(l) * l.qty).toFixed(2) })),
        subtotal: +t.subtotal.toFixed(2),
        delivery_fee: t.delivery,
        total: +t.total.toFixed(2),
        remaining_for_free_delivery: Math.max(0, +(s.free_delivery_threshold - t.subtotal).toFixed(2)),
        remaining_for_min_order: Math.max(0, +(s.min_order_amount - t.subtotal).toFixed(2)),
        store_closed: closedNote(s),
      };
    }

    if (name === "get_store_info") {
      const h = hoursState(Date.now(), s.open_time, s.close_time, s.is_open, s.force_open);
      return {
        store: s.store_name,
        hours: `${s.open_time} - ${s.close_time}`,
        open_now: h.open,
        store_closed: closedNote(s),
        minutes_to_close: h.secondsToClose != null ? Math.floor(h.secondsToClose / 60) : undefined,
        delivery_fee: s.delivery_fee,
        free_delivery_over: s.free_delivery_threshold,
        min_order: s.min_order_amount,
        payment: "Kapıda nakit veya kapıda kartla (POS) ödeme",
        delivery_area: "Tekirdağ / Çorlu (köy mahalleleri, Silahtarağa ve Yenice hariç)",
      };
    }

    if (name === "go_to_checkout") {
      const lines = useCart.getState().lines;
      if (!lines.length) return { error: "Sepet boş." };
      const kapali = closedNote(s);
      if (kapali) return { ok: false, error: `Sipariş verilemez: ${kapali} Sepet kayıtlı kalır.` };
      const t = cartTotals(lines, s.delivery_fee, s.free_delivery_threshold);
      if (t.subtotal < s.min_order_amount) return { error: `Minimum sipariş tutarı ${s.min_order_amount} TL; ${(s.min_order_amount - t.subtotal).toFixed(2)} TL daha ürün eklenmeli.` };
      navigate("/odeme");
      log("➡️ Ödeme sayfası açıldı", "info");
      return { ok: true, navigated: true };
    }

    return { error: "Bilinmeyen araç." };
  };
  return run;
}
