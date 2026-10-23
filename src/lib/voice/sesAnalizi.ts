// src/lib/voice/sesAnalizi.ts
//
// Ses görselleştirmeleri (VoiceOrb) için ortak, saf
// yardımcılar. Ses akışına hiçbir şey eklemez; yalnızca AnalyserNode'dan
// OKUNAN veriyi seviyeye çevirir.

/** Byte zaman-alanı verisinden RMS (0..~1). */
export function rmsHesapla(veri: Uint8Array): number {
  let t = 0;
  for (let i = 0; i < veri.length; i++) {
    const v = (veri[i] - 128) / 128;
    t += v * v;
  }
  return Math.sqrt(t / veri.length);
}

/** Frekans verisinde [altHz, ustHz) bandının ortalama enerjisi (0..1). */
export function bantEnerjisi(veri: Uint8Array, binHz: number, altHz: number, ustHz: number): number {
  const a = Math.max(0, Math.floor(altHz / binHz));
  const b = Math.min(veri.length, Math.max(a + 1, Math.ceil(ustHz / binHz)));
  let t = 0;
  for (let i = a; i < b; i++) t += veri[i];
  return t / ((b - a) * 255);
}

/** Zaman tabanlı yumuşatma: hızlı yükselir, yavaş söner (titreme olmaz). */
export function yumusat(mevcut: number, hedef: number, dt: number, yukselme: number, sonme: number): number {
  const tau = hedef > mevcut ? yukselme : sonme;
  return mevcut + (hedef - mevcut) * (1 - Math.exp(-dt / tau));
}

export type AsistanOlcumu = { seviye: number; alcak: number; orta: number; yuksek: number };

/** AnalyserNode'u okuyan küçük yardımcı; tamponları düğüm değişince yeniden ayırır. */
export class AnalizOkuyucu {
  private dugum: AnalyserNode | null = null;
  private zaman = new Uint8Array(0);
  private frek = new Uint8Array(0);

  oku(analiz: AnalyserNode | null): AsistanOlcumu | null {
    if (!analiz) return null;
    if (analiz !== this.dugum) {
      this.dugum = analiz;
      this.zaman = new Uint8Array(analiz.fftSize);
      this.frek = new Uint8Array(analiz.frequencyBinCount);
    }
    analiz.getByteTimeDomainData(this.zaman);
    analiz.getByteFrequencyData(this.frek);
    const rms = rmsHesapla(this.zaman);
    // Çok düşük seviye = sessizlik / hece arası.
    const seviye = Math.min(1, Math.max(0, (rms - 0.008) * 4.5));
    const binHz = analiz.context.sampleRate / analiz.fftSize;
    return {
      seviye,
      alcak: bantEnerjisi(this.frek, binHz, 80, 400),
      orta: bantEnerjisi(this.frek, binHz, 400, 1600),
      yuksek: bantEnerjisi(this.frek, binHz, 1600, 4000),
    };
  }

  birak() {
    this.dugum = null;
  }
}
