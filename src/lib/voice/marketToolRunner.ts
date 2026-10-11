"use client";
// Sesli asistan araçlarının tarayıcıda çalıştırılması (ürün arama, sepet işlemleri).
import { createClient } from "@/lib/supabase/client";
import { useCart, cartTotals, lineUnit } from "@/store/cart";
import { hoursState } from "@/lib/hours";
import type { Product } from "@/lib/types";
import type { VoiceSettings, VoiceAction } from "./useMarketVoice";

const PRODUCT_COLS = "id,category_id,name,slug,description,unit_label,price,sale_price,stock,critical_stock,max_per_order,image_url,emoji,is_active,is_featured,sort_order";
const num = (p: Product): Product => ({ ...p, price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price) });

export function createMarketToolRunner(deps: {
  getSettings: () => VoiceSettings;
  navigate: (path: string) => void;
  log: (text: string, kind: VoiceAction["kind"]) => void;
}) {
  const { getSettings, navigate, log } = deps;
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
      return { categories: (cats ?? []).map((c) => ({ name: c.name, products_in_stock: (prods ?? []).filter((p) => p.category_id === c.id).length })) };
    }

    if (name === "add_to_cart") {
      const id = String(args.product_id ?? "");
      const qty = Math.max(1, Math.min(50, Math.trunc(Number(args.quantity) || 1)));
      if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Geçersiz ürün. Önce search_products ile ara." };
      const { data } = await sb.from("products").select(PRODUCT_COLS).eq("id", id).eq("is_active", true).maybeSingle();
      if (!data) return { error: "Ürün bulunamadı veya satışta değil." };
      const p = num(data as Product);
      const max = Math.min(p.stock, p.max_per_order);
      if (max < 1) return { error: `${p.name} şu an stokta yok.`, available: false };
      const cur = cart.lines.find((l) => l.id === p.id)?.qty ?? 0;
      const target = Math.min(cur + qty, max);
      if (cur === 0) cart.add(p);
      useCart.getState().setQty(p.id, target);
      const added = target - cur;
      if (added > 0) log(`🛒 ${added} × ${p.name}${p.unit_label ? ` (${p.unit_label})` : ""} eklendi`, "add");
      return {
        ok: added > 0,
        product: p.name,
        unit: p.unit_label,
        requested: qty,
        added,
        in_cart: target,
        unit_price: p.sale_price ?? p.price,
        limited_by: added < qty ? (p.stock <= p.max_per_order ? `stok (${p.stock})` : `sipariş başına en fazla ${p.max_per_order}`) : undefined,
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
      };
    }

    if (name === "get_store_info") {
      const h = hoursState(Date.now(), s.open_time, s.close_time, s.is_open);
      return {
        store: s.store_name,
        hours: `${s.open_time} - ${s.close_time}`,
        open_now: h.open,
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
      const t = cartTotals(lines, s.delivery_fee, s.free_delivery_threshold);
      if (t.subtotal < s.min_order_amount) return { error: `Minimum sipariş tutarı ${s.min_order_amount} TL; ${(s.min_order_amount - t.subtotal).toFixed(2)} TL daha ürün eklenmeli.` };
      navigate("/odeme");
      log("➡️ Ödeme sayfası açıldı", "info");
      return { ok: true, navigated: true };
    }

    return { error: "Bilinmeyen araç." };
    }
}
