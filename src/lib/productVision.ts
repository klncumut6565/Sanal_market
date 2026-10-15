import "server-only";
// Fotoğraftan ürün tanıma: Gemini görseli okur (ad, marka, gramaj, barkod, kategori tahmini),
// sonra katalogdaki kayıtlarla puanlanarak eşleştirilir. Hiçbir şey otomatik kaydedilmez —
// yönetici adayı seçer, görsel ancak o zaman eklenir.
import { fold, barcodeKey } from "@/lib/trFold";

const MODEL = process.env.VISION_MODEL?.trim() || "gemini-2.5-flash";

export type VisionGuess = {
  name: string; // ör. "Ülker Çikolatalı Gofret 36 g"
  brand: string;
  size: string; // "36 g", "1 L", "10'lu"
  barcode: string; // okunabildiyse
  category: string; // listeden en uygun kategori adı
  keywords: string[];
  confidence: "yuksek" | "orta" | "dusuk";
  is_product: boolean;
};

const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_product: { type: "BOOLEAN" },
    name: { type: "STRING" },
    brand: { type: "STRING" },
    size: { type: "STRING" },
    barcode: { type: "STRING" },
    category: { type: "STRING" },
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    confidence: { type: "STRING", enum: ["yuksek", "orta", "dusuk"] },
  },
  required: ["is_product", "name", "brand", "size", "barcode", "category", "keywords", "confidence"],
};

export async function identifyProduct(base64: string, mimeType: string, categoryNames: string[]): Promise<VisionGuess> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY tanımlı değil");
  const prompt = `Bu fotoğraf Türkiye'deki bir marketin rafından/ürününden. Ambalajı oku ve ürünü tanı.
- name: Türk market kasasında yazılacağı gibi tam ad: Marka + ürün + çeşit + gramaj/hacim (ör. "Ülker Çikolatalı Gofret 36 g", "Pınar Süt 1 L"). Ambalajda yazmayan bilgi UYDURMA.
- brand: marka; size: gramaj/hacim/adet ("500 g", "1,5 L", "10'lu"), okunmuyorsa boş.
- barcode: barkod rakamları NET okunuyorsa yaz, yoksa boş.
- category: yalnızca şu listeden en uygun olanı: ${categoryNames.join(" | ")}
- keywords: aramada işe yarayacak 3-6 küçük harfli kelime (ürün türü, çeşit).
- Fotoğrafta tanınabilir bir ürün yoksa is_product=false.`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const g = JSON.parse(text) as Partial<VisionGuess>;
  return {
    is_product: g.is_product !== false,
    name: String(g.name ?? "").trim(),
    brand: String(g.brand ?? "").trim(),
    size: String(g.size ?? "").trim(),
    barcode: String(g.barcode ?? "").replace(/\D/g, ""),
    category: String(g.category ?? "").trim(),
    keywords: Array.isArray(g.keywords) ? g.keywords.map(String).slice(0, 8) : [],
    confidence: g.confidence === "yuksek" || g.confidence === "orta" ? g.confidence : "dusuk",
  };
}

/** EAN-13 / EAN-8 kontrol hanesi doğru mu (yanlış okunan barkodla eşleştirmeyelim) */
export function validEan(code: string) {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** "1,5 lt" / "1.5L" / "500gr" / "10'lu" → karşılaştırılabilir sayı listesi */
const sizeNums = (s: string) => (fold(s.replace(/(\d),(\d)/g, "$1.$2")).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

export type Candidate = { id: string; name: string; barcode: string | null; image_url: string | null; emoji: string | null; unit_label: string | null; price: number; sale_price: number | null; is_active: boolean; score: number; reason: string };

type Row = Omit<Candidate, "score" | "reason">;

/** Katalogdaki ürünleri tahmine göre puanlar; en iyi `limit` adayı döndürür. */
export function rankCandidates(g: VisionGuess, rows: Row[], limit = 6): Candidate[] {
  const bc = g.barcode && validEan(g.barcode) ? barcodeKey(g.barcode) : "";
  const brand = fold(g.brand);
  const words = [...new Set(fold([g.name, ...g.keywords].join(" ")).split(" ").filter((w) => w.length >= 2 && !/^\d/.test(w)))];
  const nums = sizeNums(`${g.size} ${g.name}`);
  const out: Candidate[] = [];
  for (const r of rows) {
    if (bc && barcodeKey(r.barcode) === bc) {
      out.push({ ...r, score: 1000, reason: "Barkod aynı" });
      continue;
    }
    const n = fold(`${r.name} ${r.unit_label ?? ""}`);
    const toks = n.split(" ");
    let s = 0;
    for (const w of words) {
      if (toks.includes(w)) s += w.length >= 4 ? 3 : 2;
      else if (w.length >= 4 && toks.some((t) => t.startsWith(w.slice(0, Math.max(4, w.length - 2))))) s += 1;
    }
    const brandHit = !!brand && brand.split(" ").every((b) => toks.includes(b));
    if (brandHit) s += 4;
    const rn = sizeNums(n);
    const sizeHit = nums.length > 0 && nums.some((x) => rn.includes(x));
    if (sizeHit) s += 3;
    if (s >= 4) out.push({ ...r, score: s, reason: [brandHit && "marka", sizeHit && "gramaj", "ad"].filter(Boolean).join(" + ") + " benzer" });
  }
  return out.sort((a, b) => b.score - a.score || Number(!b.image_url) - Number(!a.image_url)).slice(0, limit);
}
