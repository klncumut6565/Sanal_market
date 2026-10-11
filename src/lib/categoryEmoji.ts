// Kategori adından simge tahmini (admin emoji girmezse kullanılır).
const KURALLAR: [RegExp, string][] = [
  [/alkol|şarap|sarap|bira|rakı|raki|viski|votka|içki|icki/i, "🍷"],
  [/elektronik|şarj|sarj|kulaklık|kulaklik|pil|kablo|telefon/i, "🎧"],
  [/sigara|tütün|tutun/i, "🚬"],
  [/meyve|sebze|manav/i, "🍎"],
  [/süt|sut|kahvaltı|kahvalti|peynir|yoğurt|yogurt/i, "🥛"],
  [/fırın|firin|ekmek|unlu/i, "🥖"],
  [/(^|\s)et(\s|,|$)|tavuk|balık|balik|kasap|şarküteri|sarkuteri/i, "🍗"],
  [/dondurma|donuk|dondurulmuş/i, "🍦"],
  [/temel|bakliyat|makarna|un |yağ|yag/i, "🍝"],
  [/atıştırmalık|atistirmalik|cips|çikolata|cikolata|şeker|seker|bisküvi|biskuvi/i, "🍫"],
  [/içecek|icecek|su |meşrubat|mesrubat|kola|meyve suyu/i, "🥤"],
  [/kahve|çay|cay/i, "☕"],
  [/temizlik|deterjan/i, "🧽"],
  [/kişisel|kisisel|bakım|bakim|kozmetik|şampuan|sampuan/i, "🧴"],
  [/bebek/i, "🍼"],
  [/evcil|kedi|köpek|kopek|mama/i, "🐾"],
  [/kağıt|kagit|peçete|pecete|havlu/i, "🧻"],
  [/ev|mutfak|gereç|gerec/i, "🏠"],
  [/kırtasiye|kirtasiye/i, "✏️"],
];

export function guessCategoryEmoji(name: string): string | null {
  for (const [re, e] of KURALLAR) if (re.test(name)) return e;
  return null;
}

/** Admin formunda dokunarak seçilebilecek hazır simgeler */
export const CATEGORY_EMOJIS = ["🍎", "🥛", "🥖", "🍗", "🍝", "🍫", "🥤", "☕", "🍷", "🍺", "🚬", "🎧", "🔋", "🧽", "🧴", "🧻", "🍼", "🐾", "🍦", "🏠", "✏️", "🎁"];
