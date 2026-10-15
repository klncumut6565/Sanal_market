import "server-only";
// WhatsApp sipariş botu: müşteri bot numarasına yazar; Gemini (metin) araçlarla ürün arar, sepeti kurar,
// adres/ödeme bilgisini alır, özeti gösterip "EVET" onayıyla siparişi açar. Sipariş, sitedeki ödemeyle
// aynı veritabanı fonksiyonundan (place_order) geçer — stok, fiyat, çalışma saati, bölge kontrolleri aynıdır.
import { createPublicClient } from "@/lib/supabase/public";
import { sendWhatsAppCloudText } from "@/lib/notify";
import { notifyOrderPlaced } from "@/lib/orderNotify";
import { orderErrorMessage } from "@/lib/format";
import { fold } from "@/lib/trFold";

type Sb = ReturnType<typeof createPublicClient>;
type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: { name: string; response: unknown }; thoughtSignature?: string };
type Content = { role: "user" | "model"; parts: Part[] };
type CartLine = { product_id: string; name: string; unit: string | null; price: number; qty: number };
type Customer = {
  name?: string;
  neighborhood_id?: number;
  neighborhood?: string;
  district_id?: number;
  street_id?: number | null;
  street?: string;
  door_no?: string;
  inner_no?: string;
  building?: string;
  address_note?: string;
  payment_method?: "kapida_nakit" | "kapida_pos";
  delivery_slot?: string;
  note?: string;
  /** Müşterinin kalıcı tercihleri (ör. "Süt: tam yağlı 1 L") */
  prefs?: string[];
  /** Onay özeti gösterildi: sepet+bilgi imzası (değişirse yeniden özet gerekir) */
  reviewed?: string;
};
type Chat = { phone: string; name: string | null; contents: Content[]; cart: CartLine[]; customer: Customer };

const SITE = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://sanalmarket.vercel.app").replace(/\/$/, "");
const MODEL = process.env.WA_BOT_MODEL?.trim() || "gemini-2.5-flash";
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(n) || 0);
const PAY = { kapida_nakit: "Kapıda nakit", kapida_pos: "Kapıda kart (POS)" } as const;
const YES = /^(evet|evt|onay|onayl[ıi]yorum|tamam|tmm|olur|ok|okey|kabul|g[öo]nder|siparişi ver|ver)\b/i;

// ------------------------------------------------------------------ araçlar
const TOOLS = [
  {
    name: "search_products",
    description: "Marketteki GERÇEK ürünleri arar (ad, marka, tür). Ürün/fiyat/stok hakkında konuşmadan ÖNCE mutlaka çağır. Kelimeyi yalın ver: 'domatesten' → 'domates'.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "set_cart_item",
    description: "Sepetteki bir ürünün adedini AYARLAR (ekleme değil, son adet). quantity=0 ürünü çıkarır. product_id yalnızca search_products sonucundan. Adet = paket/adet sayısı.",
    parameters: {
      type: "object",
      properties: { product_id: { type: "string" }, quantity: { type: "integer" } },
      required: ["product_id", "quantity"],
    },
  },
  { name: "view_cart", description: "Sepeti, ara toplamı, teslimat ücretini ve kayıtlı müşteri bilgilerini döndürür.", parameters: { type: "object", properties: {} } },
  {
    name: "find_neighborhood",
    description: "Teslimat yapılan mahalleleri arar (müşterinin yazdığı mahalle adıyla). Boş bırakılırsa tüm teslimat mahallelerini listeler.",
    parameters: { type: "object", properties: { query: { type: "string" } } },
  },
  {
    name: "set_customer",
    description:
      "Müşteri bilgilerini kaydeder (yalnızca verilen alanlar güncellenir). neighborhood_id find_neighborhood sonucundan. payment_method: 'kapida_nakit' veya 'kapida_pos'. delivery_slot get_store_info'daki saatlerden biri (varsayılan ilk seçenek).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Ad soyad" },
        neighborhood_id: { type: "integer" },
        street: { type: "string", description: "Cadde / sokak adı" },
        door_no: { type: "string", description: "Dış kapı no" },
        inner_no: { type: "string", description: "Daire no" },
        building: { type: "string", description: "Bina / site adı" },
        address_note: { type: "string", description: "Adres tarifi" },
        payment_method: { type: "string", enum: ["kapida_nakit", "kapida_pos"] },
        delivery_slot: { type: "string" },
        note: { type: "string", description: "Siparişe not" },
      },
    },
  },
  {
    name: "remember_preference",
    description:
      "Müşterinin KALICI alışveriş tercihini not eder (sonraki siparişlerde hatırlanır): 'sütü hep tam yağlı alırım' → 'Süt: tam yağlı tercih eder'. Tek seferlik istekleri yazma. Sağlık, din, siyaset gibi hassas bilgileri ASLA yazma. forget=true ile 'about' konusundaki notu siler.",
    parameters: { type: "object", properties: { note: { type: "string" }, forget: { type: "boolean" }, about: { type: "string" } } },
  },
  { name: "get_store_info", description: "Çalışma saatleri, açık mı, teslimat ücreti, ücretsiz teslimat sınırı, teslimat saatleri, minimum tutar.", parameters: { type: "object", properties: {} } },
  {
    name: "review_order",
    description: "Sipariş özetini hazırlar ve eksik bilgileri söyler. Sipariş vermeden önce ÇAĞIR, dönen 'summary' metnini müşteriye AYNEN gönder ve onay iste.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "place_order",
    description: "Siparişi oluşturur. YALNIZCA review_order özeti gösterildikten SONRA müşteri açıkça 'evet/onaylıyorum' derse çağır.",
    parameters: { type: "object", properties: {} },
  },
];

const SYSTEM = (store: string) => `Sen ${store}'in WhatsApp sipariş asistanısın (Çorlu). Müşteriyle WhatsApp'tan yazışıyorsun.
ÜSLUP: Türkçe, samimi, KISA mesajlar (en fazla 6-8 satır). WhatsApp biçimi: *kalın*, liste için "•". Emoji az. Asla uydurma ürün/fiyat söyleme.
AKIŞ:
1) Müşteri ürün isterse search_products ile ara; bulunanları "• Ürün adı (birim) — fiyat" diye en fazla 6 tane listele. Tek açık eşleşme ve adet belliyse doğrudan set_cart_item ile ekle ve söyle. Birden çok seçenek varsa hangisini istediğini sor.
2) Stokta olmayanı ekleme, alternatif öner.
3) Müşteri "bu kadar / sipariş ver / tamam" derse eksik bilgileri SIRAYLA ve TEK mesajda topla: ad soyad (biliniyorsa sorma), mahalle (find_neighborhood ile doğrula), cadde/sokak, dış kapı no, daire no, ödeme (kapıda nakit / kapıda kart). Teslimat saati varsayılan "en kısa sürede".
4) Bilgiler tamamsa review_order çağır, dönen özeti AYNEN gönder ve "Onaylıyor musunuz? (EVET yazın)" diye sor.
5) Müşteri EVET derse place_order çağır; sipariş numarasını ve takip bağlantısını gönder.
TERCİHLER: Müşteri "hep/her zaman" diye kalıcı bir tercih söylerse remember_preference ile not et ve "Not ettim" de; kayıtlı tercihlerine ürün önerirken uy.
KURALLAR: Yalnızca Çorlu'da teslimat mahallelerine teslimat var. Ödeme yalnızca kapıda (nakit veya kart). Alkol ve tütün WhatsApp'tan satılmaz; sitede üye girişiyle sipariş verilebileceğini söyle. Market kapalıysa get_store_info ile saatleri söyle. Konu dışı sorulara kısa cevap verip alışverişe dön. Müşterinin telefon numarası zaten biliniyor, sorma.
Sitemiz: ${SITE}`;

// ------------------------------------------------------------------ yardımcılar
const cartSig = (c: Chat) => JSON.stringify([c.cart.map((l) => [l.product_id, l.qty]), c.customer.neighborhood_id, c.customer.street, c.customer.door_no, c.customer.inner_no, c.customer.payment_method, c.customer.name]);

async function storeInfo(sb: Sb) {
  const { data } = await sb
    .from("store_settings")
    .select("store_name,is_open,open_time,close_time,delivery_fee,free_delivery_threshold,min_order_amount,delivery_slots,working_hours,phone")
    .eq("id", 1)
    .single();
  return data as {
    store_name: string;
    is_open: boolean;
    open_time: string;
    close_time: string;
    delivery_fee: number;
    free_delivery_threshold: number;
    min_order_amount: number;
    delivery_slots: string[];
    working_hours: string | null;
    phone: string | null;
  };
}

function totals(cart: CartLine[], s: { delivery_fee: number; free_delivery_threshold: number }) {
  const sub = cart.reduce((a, l) => a + l.price * l.qty, 0);
  const fee = sub === 0 || sub >= Number(s.free_delivery_threshold) ? 0 : Number(s.delivery_fee);
  return { sub, fee, total: sub + fee };
}

function missing(c: Customer) {
  const m: string[] = [];
  if (!c.name || c.name.trim().length < 3) m.push("ad soyad");
  if (!c.neighborhood_id) m.push("mahalle");
  if (!c.street || c.street.trim().length < 2) m.push("cadde/sokak");
  if (!c.door_no) m.push("dış kapı no");
  if (!c.payment_method) m.push("ödeme şekli (kapıda nakit / kapıda kart)");
  return m;
}

const addressText = (c: Customer) =>
  [c.neighborhood && `${c.neighborhood} Mah.`, c.street, c.door_no && `No:${c.door_no}`, c.inner_no && `D:${c.inner_no}`, c.building && `(${c.building})`].filter(Boolean).join(" ");

// ------------------------------------------------------------------ araç çalıştırıcı
async function runTool(sb: Sb, chat: Chat, name: string, args: Record<string, unknown>, lastUserText: string): Promise<unknown> {
  if (name === "search_products") {
    const q = String(args.query ?? "").trim().slice(0, 60);
    if (q.length < 2) return { error: "Arama kelimesi çok kısa." };
    let { data } = await sb.rpc("search_products", { q });
    if (!data?.length && q.includes(" ")) ({ data } = await sb.rpc("search_products", { q: q.split(/\s+/).pop() }));
    const list = ((data ?? []) as { id: string; name: string; unit_label: string | null; price: number; sale_price: number | null; stock: number; max_per_order: number }[])
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
      .slice(0, 8);
    if (!list.length) return { results: [], note: "Eşleşen ürün yok." };
    return {
      results: list.map((p) => ({
        product_id: p.id,
        name: p.name,
        unit: p.unit_label,
        price: Number(p.sale_price ?? p.price),
        old_price: p.sale_price != null ? Number(p.price) : undefined,
        available: p.stock > 0,
        in_cart: chat.cart.find((l) => l.product_id === p.id)?.qty ?? 0,
      })),
    };
  }

  if (name === "set_cart_item") {
    const id = String(args.product_id ?? "");
    const qty = Math.max(0, Math.min(50, Math.trunc(Number(args.quantity) || 0)));
    if (qty === 0) {
      const had = chat.cart.find((l) => l.product_id === id);
      chat.cart = chat.cart.filter((l) => l.product_id !== id);
      return { ok: true, removed: had?.name ?? null, cart_items: chat.cart.length };
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Geçersiz ürün. Önce search_products ile ara." };
    const { data: p } = await sb.from("products").select("id,name,unit_label,price,sale_price,stock,max_per_order,is_active").eq("id", id).maybeSingle();
    if (!p || !p.is_active) return { error: "Bu ürün satışta değil." };
    if (p.stock < 1) return { error: `${p.name} stokta yok.` };
    const max = Math.min(p.stock, p.max_per_order);
    const q = Math.min(qty, max);
    const line: CartLine = { product_id: p.id, name: p.name, unit: p.unit_label, price: Number(p.sale_price ?? p.price), qty: q };
    const i = chat.cart.findIndex((l) => l.product_id === id);
    if (i >= 0) chat.cart[i] = line;
    else chat.cart.push(line);
    return { ok: true, name: p.name, quantity: q, note: q < qty ? `En fazla ${max} adet eklenebildi.` : undefined, line_total: +(q * line.price).toFixed(2) };
  }

  if (name === "view_cart") {
    const s = await storeInfo(sb);
    const t = totals(chat.cart, s);
    return {
      items: chat.cart.map((l) => ({ name: l.name, unit: l.unit, qty: l.qty, price: l.price, line_total: +(l.qty * l.price).toFixed(2) })),
      subtotal: +t.sub.toFixed(2),
      delivery_fee: t.fee,
      total: +t.total.toFixed(2),
      free_delivery_from: Number(s.free_delivery_threshold),
      customer: { ...chat.customer, reviewed: undefined },
      missing_info: missing(chat.customer),
    };
  }

  if (name === "find_neighborhood") {
    const { data } = await sb.from("delivery_neighborhoods").select("id,name,district_id,delivery_districts!inner(name,is_active)").eq("is_active", true).eq("delivery_districts.is_active", true);
    const all = (data ?? []) as unknown as { id: number; name: string; district_id: number; delivery_districts: { name: string } }[];
    const q = fold(String(args.query ?? "").replace(/mah(alle(si)?)?\.?/gi, ""));
    const hit = q ? all.filter((n) => fold(n.name).includes(q) || q.includes(fold(n.name))) : all;
    return { neighborhoods: (hit.length ? hit : all).map((n) => ({ neighborhood_id: n.id, name: n.name, district: n.delivery_districts.name })), exact: hit.length === 1 };
  }

  if (name === "set_customer") {
    const c = chat.customer;
    const str = (k: string, max = 120) => (typeof args[k] === "string" && (args[k] as string).trim() ? (args[k] as string).trim().slice(0, max) : undefined);
    if (str("name")) c.name = str("name");
    for (const k of ["door_no", "inner_no"] as const) if (str(k, 10)) c[k] = str(k, 10);
    if (str("building", 80)) c.building = str("building", 80);
    if (str("address_note", 200)) c.address_note = str("address_note", 200);
    if (str("note", 300)) c.note = str("note", 300);
    if (args.payment_method === "kapida_nakit" || args.payment_method === "kapida_pos") c.payment_method = args.payment_method;
    if (str("delivery_slot")) {
      const s = await storeInfo(sb);
      const want = fold(str("delivery_slot")!);
      c.delivery_slot = s.delivery_slots.find((x) => fold(x) === want) ?? s.delivery_slots.find((x) => fold(x).includes(want)) ?? c.delivery_slot;
    }
    if (args.neighborhood_id != null) {
      const { data: n } = await sb.from("delivery_neighborhoods").select("id,name,district_id,is_active").eq("id", Number(args.neighborhood_id)).maybeSingle();
      if (!n || !n.is_active) return { error: "Bu mahalleye teslimat yok. find_neighborhood ile kontrol et." };
      if (c.neighborhood_id !== n.id) c.street_id = null;
      c.neighborhood_id = n.id;
      c.neighborhood = n.name;
      c.district_id = n.district_id;
    }
    if (str("street")) {
      c.street = str("street");
      c.street_id = null;
      if (c.neighborhood_id) {
        const { data: streets } = await sb.from("delivery_streets").select("id,name").eq("neighborhood_id", c.neighborhood_id).eq("is_active", true).limit(2000);
        const want = fold(c.street!).replace(/\b(sokak|sok|sk|cadde|cad|cd|bulvar|bulvari|blv)\b/g, "").trim();
        const hit = (streets ?? []).find((s) => fold(s.name).replace(/\b(sokak|sok|sk|cadde|cad|cd|bulvar|bulvari|blv)\b/g, "").trim() === want);
        if (hit) {
          c.street_id = hit.id;
          c.street = hit.name;
        }
      }
    }
    return { ok: true, customer: { ...c, reviewed: undefined }, missing_info: missing(c) };
  }

  if (name === "remember_preference") {
    const prefs = chat.customer.prefs ?? [];
    if (args.forget) {
      const a = fold(String(args.about ?? ""));
      const keep = prefs.filter((p) => !a || !fold(p).includes(a));
      const removed = prefs.length - keep.length;
      chat.customer.prefs = keep;
      return { ok: removed > 0, removed };
    }
    const note = String(args.note ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (note.length < 3) return { error: "Not boş." };
    if (!prefs.some((p) => fold(p) === fold(note))) chat.customer.prefs = [...prefs, note].slice(-15);
    return { ok: true, saved: note };
  }

  if (name === "get_store_info") {
    const s = await storeInfo(sb);
    const { data: open } = await sb.rpc("store_is_open_now", { p_grace_min: 0 });
    return {
      name: s.store_name,
      open_now: s.is_open && open !== false,
      hours: s.working_hours || `${s.open_time}–${s.close_time}`,
      delivery_fee: Number(s.delivery_fee),
      free_delivery_from: Number(s.free_delivery_threshold),
      min_order: Number(s.min_order_amount),
      delivery_slots: s.delivery_slots,
      payment: "Kapıda nakit veya kapıda kart",
    };
  }

  if (name === "review_order") {
    if (!chat.cart.length) return { error: "Sepet boş." };
    const m = missing(chat.customer);
    if (m.length) return { error: "Eksik bilgi var", missing_info: m };
    const s = await storeInfo(sb);
    if (!chat.customer.delivery_slot) chat.customer.delivery_slot = s.delivery_slots[0];
    const t = totals(chat.cart, s);
    const c = chat.customer;
    const summary = [
      "🧾 *Sipariş özeti*",
      ...chat.cart.map((l) => `• ${l.qty} × ${l.name}${l.unit ? ` (${l.unit})` : ""} — ${tl(l.qty * l.price)}`),
      `Ara toplam: ${tl(t.sub)}`,
      `Teslimat: ${t.fee ? tl(t.fee) : "Ücretsiz"}`,
      `*Toplam: ${tl(t.total)}*`,
      "",
      `👤 ${c.name}`,
      `📍 ${addressText(c)}, Çorlu${c.address_note ? ` — ${c.address_note}` : ""}`,
      `💳 ${PAY[c.payment_method!]} · 🕒 ${c.delivery_slot}`,
      c.note ? `📝 ${c.note}` : "",
      "",
      `Onaylıyorsanız *EVET* yazın. (Sipariş vererek mesafeli satış sözleşmesini ve KVKK metnini kabul etmiş olursunuz: ${SITE}/kvkk)`,
    ]
      .filter((x) => x !== "")
      .join("\n");
    c.reviewed = cartSig(chat);
    return { summary, note: "Bu özeti müşteriye AYNEN gönder, başka bir şey ekleme." };
  }

  if (name === "place_order") {
    const c = chat.customer;
    if (!chat.cart.length) return { error: "Sepet boş." };
    if (!c.reviewed || c.reviewed !== cartSig(chat)) return { error: "Önce review_order ile güncel özeti göster ve onay al." };
    if (!YES.test(lastUserText.trim())) return { error: "Müşteri açıkça onay vermedi. 'EVET' yazmasını iste." };
    const { data, error } = await sb.rpc("place_order", {
      p_items: chat.cart.map((l) => ({ product_id: l.product_id, quantity: l.qty })),
      p_customer: {
        name: c.name,
        phone: chat.phone,
        district_id: String(c.district_id ?? ""),
        neighborhood_id: String(c.neighborhood_id ?? ""),
        street_id: c.street_id ? String(c.street_id) : "",
        street_text: c.street_id ? "" : c.street,
        door_no: c.door_no,
        inner_no: c.inner_no ?? "",
        building: c.building ?? "",
        address_note: c.address_note ?? "",
        delivery_slot: c.delivery_slot,
        payment_method: c.payment_method,
        note: [c.note, "WhatsApp siparişi"].filter(Boolean).join(" · ").slice(0, 300),
        accepted_terms: true,
        terms_version: "2026-10-11",
        client_order_id: crypto.randomUUID(),
      },
    });
    if (error) {
      c.reviewed = undefined;
      return { error: orderErrorMessage(error.message) };
    }
    const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; access_token: string; order_no: number };
    await notifyOrderPlaced(row, c.name ?? "WhatsApp müşterisi", "WhatsApp");
    const link = `${SITE}/siparis/${row.order_id}?t=${row.access_token}`;
    chat.cart = [];
    c.reviewed = undefined;
    c.note = undefined;
    return { ok: true, order_no: row.order_no, tracking_link: link, note: "Sipariş numarasını ve takip bağlantısını gönder, teşekkür et." };
  }

  return { error: `Bilinmeyen araç: ${name}` };
}

// ------------------------------------------------------------------ Gemini
async function gemini(contents: Content[], system: string): Promise<Content> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY tanımlı değil");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(25_000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: TOOLS }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { candidates?: { content?: Content }[] };
  const c = j.candidates?.[0]?.content;
  if (!c?.parts?.length) return { role: "model", parts: [{ text: "Kusura bakmayın, tam anlayamadım. Tekrar yazar mısınız?" }] };
  return { role: "model", parts: c.parts };
}

/** Geçmişi kısalt: en fazla ~30 öğe, her zaman müşterinin düz yazısıyla başlasın (araç çağrısı yarım kalmasın). */
function trim(contents: Content[], max = 30) {
  let c = contents.slice(-max);
  const start = c.findIndex((x) => x.role === "user" && x.parts.some((p) => p.text));
  c = start > 0 ? c.slice(start) : c;
  return c;
}

// ------------------------------------------------------------------ giriş noktası
export type InboundMessage = { from: string; id: string; name?: string; text?: string; type: string };

export async function handleBotMessage(m: InboundMessage) {
  const secret = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!secret) return;
  const sb = createPublicClient();
  const phone = `+${m.from.replace(/\D/g, "")}`;
  const { data: row, error } = await sb.rpc("wa_bot_begin", { p_secret: secret, p_phone: phone, p_wamid: m.id, p_name: m.name ?? "" });
  if (error) return console.error("[wa bot] begin:", error.message);
  if (!row || (row as { skip?: string }).skip) return; // tekrar gelen mesaj / bot kapalı / işletme numarası

  const send = (t: string) => sendWhatsAppCloudText(phone, t).then((r) => !r.ok && console.error("[wa bot] gönderim:", r.error));
  if (!m.text?.trim()) {
    await send("Şimdilik yalnızca yazılı mesajları anlayabiliyorum 🙏 Ne almak istediğinizi yazar mısınız? (ör. \"2 ekmek, 1 litre süt\")");
    return;
  }

  const r = row as { phone: string; name: string | null; contents: Content[]; cart: CartLine[]; customer: Customer };
  const chat: Chat = { phone, name: r.name, contents: Array.isArray(r.contents) ? r.contents : [], cart: Array.isArray(r.cart) ? r.cart : [], customer: r.customer ?? {} };
  if (!chat.customer.name && chat.name) chat.customer.name = chat.name;
  const s = await storeInfo(sb);
  const ctx = [
    `[Bilgi] Müşterinin WhatsApp adı: ${chat.name ?? "bilinmiyor"} (ad soyadı doğrulamadan siparişe yazma).`,
    chat.cart.length ? `[Bilgi] Sepette ${chat.cart.length} çeşit ürün var.` : "",
    chat.customer.neighborhood ? `[Bilgi] Kayıtlı adres: ${addressText(chat.customer)}.` : "",
    chat.customer.prefs?.length ? `[Bilgi] Hatırlanan tercihleri: ${chat.customer.prefs.join(" | ")}. Ürün önerirken bunlara uy.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const userText = m.text.trim().slice(0, 1000);
  chat.contents.push({ role: "user", parts: [{ text: chat.contents.length ? userText : `${ctx}\n\nMüşteri: ${userText}` }] });

  let reply = "";
  try {
    for (let step = 0; step < 8; step++) {
      const out = await gemini(trim(chat.contents), SYSTEM(s.store_name || "Sanal Market"));
      chat.contents.push(out);
      const calls = out.parts.filter((p) => p.functionCall);
      if (!calls.length) {
        reply = out.parts.map((p) => p.text ?? "").join("").trim();
        break;
      }
      const responses: Part[] = [];
      for (const p of calls) {
        const fc = p.functionCall!;
        let res: unknown;
        try {
          res = await runTool(sb, chat, fc.name, fc.args ?? {}, userText);
        } catch (e) {
          res = { error: (e as Error).message };
        }
        responses.push({ functionResponse: { name: fc.name, response: { result: res } } });
      }
      chat.contents.push({ role: "user", parts: responses });
    }
  } catch (e) {
    console.error("[wa bot]", e);
    reply = `Şu an küçük bir sorun yaşıyoruz 🙏 Siparişinizi ${SITE} adresinden verebilir ya da biraz sonra tekrar yazabilirsiniz.`;
  }
  if (!reply) reply = "Bir saniye, tekrar yazar mısınız? 🙏";
  await send(reply);
  await sb.rpc("wa_bot_save", {
    p_secret: secret,
    p_phone: phone,
    p_contents: trim(chat.contents, 40),
    p_cart: chat.cart,
    p_customer: chat.customer,
    p_last_order: null,
  });
}
