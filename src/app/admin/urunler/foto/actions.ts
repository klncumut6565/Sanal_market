"use server";
import { invalidateCatalog } from "@/lib/data/invalidate";
import { requireAdmin } from "@/lib/data/auth";
import { fetchAll } from "@/lib/data/fetchAll";
import { matchWords } from "@/lib/trFold";
import { identifyProduct, rankCandidates, type Candidate, type VisionGuess } from "@/lib/productVision";

const COLS = "id,name,barcode,image_url,emoji,unit_label,price,sale_price,is_active";
type Row = Omit<Candidate, "score" | "reason">;

async function catalog(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  const { data } = await fetchAll<Row>((a, b) => supabase.from("products").select(COLS).order("name").order("id").range(a, b));
  return data.map((r) => ({ ...r, price: Number(r.price), sale_price: r.sale_price == null ? null : Number(r.sale_price) }));
}

export type IdentifyResult =
  | { ok: true; guess: VisionGuess; categoryId: string | null; candidates: Candidate[] }
  | { ok: false; error: string };

/** Fotoğrafı yapay zekâya tanıtır ve katalogdaki olası eşleşmeleri döndürür. Hiçbir şey kaydetmez. */
export async function identifyPhoto(base64: string, mimeType: string): Promise<IdentifyResult> {
  const { supabase } = await requireAdmin();
  if (!/^image\/(webp|jpeg|png)$/.test(mimeType) || base64.length > 900_000) return { ok: false, error: "Görsel çok büyük ya da desteklenmiyor." };
  const { data: cats } = await supabase.from("categories").select("id,name");
  const names = (cats ?? []).map((c) => c.name as string);
  let guess: VisionGuess;
  try {
    guess = await identifyProduct(base64, mimeType, names);
  } catch (e) {
    return { ok: false, error: "Yapay zekâ şu an yanıt vermedi: " + (e instanceof Error ? e.message.slice(0, 120) : "") };
  }
  if (!guess.is_product || !guess.name) return { ok: false, error: "Fotoğrafta tanınabilir bir ürün bulunamadı. Ambalajın ön yüzünü yakından çekin." };
  const rows = await catalog(supabase);
  const categoryId = (cats ?? []).find((c) => c.name === guess.category)?.id ?? null;
  return { ok: true, guess, categoryId, candidates: rankCandidates(guess, rows) };
}

/** Eşleşme çıkmazsa elle arama (ad veya barkod) */
export async function searchForPhoto(q: string): Promise<Candidate[]> {
  const { supabase } = await requireAdmin();
  const t = q.trim();
  if (t.length < 2) return [];
  const rows = await catalog(supabase);
  const digits = t.replace(/\s/g, "");
  return rows
    .filter((r) => matchWords(r.name, t) || (/^\d{4,}$/.test(digits) && (r.barcode ?? "").includes(digits)))
    .slice(0, 12)
    .map((r) => ({ ...r, score: 0, reason: "Arama" }));
}

/** Seçilen ürüne görseli bağlar (yönetici onayıyla). */
export async function attachProductImage(id: string, url: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^https:\/\//.test(url)) return { ok: false, error: "Geçersiz istek." };
  const { error } = await supabase.from("products").update({ image_url: url }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await invalidateCatalog([id]);
  return { ok: true };
}
