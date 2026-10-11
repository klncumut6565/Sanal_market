"use client";
// Sesli asistan araçlarının tarayıcıda çalıştırılması (ürün arama, sepet işlemleri).
import { createClient } from "@/lib/supabase/client";
import { useCart, cartTotals, lineUnit } from "@/store/cart";
import { hoursState } from "@/lib/hours";
import type { Product } from "@/lib/types";
import type { VoiceSettings, VoiceAction } from "./useMarketVoice";

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
};

const trNorm = (t: string) => t.toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, " ").trim();
// JS \b Türkçe harflerle çalışmadığı için kelime listesiyle kontrol.
const RED_KOK = ["bekle", "dur", "hayır", "hayir", "istemiyorum", "istemem", "vazgeç", "vazgec", "iptal", "düşün", "dusun", "şimdilik", "simdilik", "sonra", "olmasın", "olmasin", "ekleme", "yok", "değil", "degil"];
const ONAY_KELIME = new Set(["evet", "ekle", "ekleyin", "ekleyebilirsin", "eklensin", "eklesene", "olur", "tamam", "tamamdır", "onaylıyorum", "onay", "tabi", "tabii", "tabiki", "aynen", "kesinlikle", "lütfen", "he", "hıhı", "peki", "yes", "ok", "okey"]);
export function replyIntent(text: string): "red" | "onay" | "belirsiz" {
  const w = trNorm(text).split(" ").filter(Boolean);
  if (w.some((x) => RED_KOK.some((k) => x.startsWith(k)))) return "red";
  if (w.some((x) => ONAY_KELIME.has(x))) return "onay";
  return "belirsiz";
}

/** Market kapalıysa müşteriye söylenecek not (sipariş verilemez, sepet hazırlanabilir). */
export function closedNote(s: VoiceSettings): string | undefined {
  const h = hoursState(Date.now(), s.open_time, s.close_time, s.is_open);
  if (h.open) return undefined;
  if (!s.is_open || h.secondsToOpen == null) {
    return "Market şu an sipariş almıyor. Ürünleri sepete ekleyebilirsin, sipariş market açıldığında verilebilir.";
  }
  const hh = Math.floor(h.secondsToOpen / 3600);
  const mm = Math.floor((h.secondsToOpen % 3600) / 60);
  const kalan = hh ? `${hh} saat ${mm} dakika` : `${mm} dakika`;
  return `Market şu an kapalı; siparişler saat ${s.open_time}'da açılıyor (yaklaşık ${kalan} sonra). Şimdi sepete ürün eklenebilir ama sipariş ancak açılışta verilebilir.`;
}

function cartLabel(p: Product, qty: number) {
  return `${qty} × ${p.name}${p.unit_label ? ` (${p.unit_label})` : ""}`;
}

const PRODUCT_COLS = "id,category_id,name,slug,description,unit_label,price,sale_price,stock,critical_stock,max_per_order,image_url,emoji,is_active,is_featured,sort_order";
const num = (p: Product): Product => ({ ...p, price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price) });

export function createMarketToolRunner(deps: {
  getSettings: () => VoiceSettings;
  navigate: (path: string) => void;
  log: (text: string, kind: VoiceAction["kind"]) => void;
  gate: CartGate;
}) {
  const { getSettings, navigate, log, gate } = deps;
  return async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const sb = createClient();
    const cart = useCart.getState();
    const s = getSettings();

    if (name === "search_products") {
      const q = String(args.query ?? "").trim().slice(0, 60);
      if (q.length < 2) return { error: "Arama kelimesi çok kısa." };
      let { data } = await sb.rpc("search_products", { q });
      if (!data?.length && q.includes(" ")) ({ data } = await sb.rpc("search_products", { q: q.split(/\s+/).pop() }));
      const { data: cats } = await sb.from("categories").select("id,name");
      const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
      const list = ((data ?? []) as Product[]).map(num).sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)).slice(0, 8);
      if (!list.length) return { results: [], note: "Bu aramayla eşleşen ürün yok." };
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

    if (name === "list_categories") {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        sb.from("categories").select("id,name").eq("is_active", true).order("sort_order"),
        sb.from("products").select("category_id").eq("is_active", true).gt("stock", 0),
      ]);
      const categories = (cats ?? []).map((c) => ({ name: c.name, products_in_stock: (prods ?? []).filter((p) => p.category_id === c.id).length }));
      return { count: categories.length, categories, note: "Kategorilerin hepsini adlarıyla say." };
    }

    if (name === "list_category_products") {
      const norm = (t: string) => t.toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, " ").trim();
      const q = norm(String(args.category ?? ""));
      if (q.length < 2) return { error: "Kategori adı söylenmedi." };
      const { data: cats } = await sb.from("categories").select("id,name").eq("is_active", true).order("sort_order");
      const all = cats ?? [];
      const words = q.split(" ").filter((w) => w.length >= 3);
      const cat =
        all.find((c) => norm(c.name) === q) ??
        all.find((c) => norm(c.name).includes(q) || q.includes(norm(c.name))) ??
        all.find((c) => words.some((w) => norm(c.name).includes(w.slice(0, Math.max(3, w.length - 2)))));
      if (!cat) return { error: "Bu adla kategori bulunamadı.", categories: all.map((c) => c.name) };
      const { data: prods } = await sb
        .from("products")
        .select("id,name,unit_label,price,sale_price,stock")
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
      const { data } = await sb.from("products").select(PRODUCT_COLS).in("id", [...want.keys()]).eq("is_active", true);
      const items: CartProposal["items"] = [];
      const problems: string[] = [];
      for (const row of (data ?? []) as Product[]) {
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

    if (name === "confirm_cart_items") {
      const pend = gate.get();
      if (!pend) return { ok: false, added: [], error: "Bekleyen öneri yok. Önce propose_cart_items çağır ve müşteriye sor." };
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
      const h = hoursState(Date.now(), s.open_time, s.close_time, s.is_open);
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
        delivery_area: "Tekirdağ / Çorlu",
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
    }
}
