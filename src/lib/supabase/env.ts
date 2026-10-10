// Supabase proje adresi ve publishable (herkese açık) anahtar.
// Bu iki değer tarayıcıya zaten gönderilir; gizli değildir. Vercel'de değişken
// eksik/hatalı girilse bile site çalışsın diye proje değerleri yedek olarak burada.
const FALLBACK_URL = "https://enyrrmnpwfdmfxrjurlv.supabase.co";
const FALLBACK_KEY = "sb_publishable_eA4qi8E8eupLlG5-_nnyWA_iRp6B-QN";

const clean = (v: string | undefined) => (v ?? "").trim();

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL) || FALLBACK_URL;
export const SUPABASE_KEY =
  clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  FALLBACK_KEY;
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
