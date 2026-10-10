/**
 * Tarayıcıda üretilen zil sesleri (dosya indirmeye gerek yok).
 * Ses WAV olarak üretilip <audio> ile çalınır: iPhone'da sessiz moddayken de duyulur
 * (Web Audio sessiz moda takılır, medya oynatma takılmaz).
 */
export type RingtoneId = "dingdong" | "telefon" | "alarm" | "kasa";

export const RINGTONES: { id: RingtoneId; label: string; desc: string }[] = [
  { id: "dingdong", label: "Kapı zili", desc: "Ding-dong, yumuşak" },
  { id: "telefon", label: "Klasik telefon", desc: "Trrrin trrrin" },
  { id: "alarm", label: "Acil alarm", desc: "Hızlı bip, en dikkat çekici" },
  { id: "kasa", label: "Kasa", desc: "Çın-çın, kısa" },
];

const RATE = 22050;

type Note = { f: number; start: number; dur: number; vol?: number; harm?: number[]; decay?: number; square?: boolean };

function render(notes: Note[], length: number): Float32Array {
  const out = new Float32Array(Math.ceil(length * RATE));
  for (const n of notes) {
    const s0 = Math.floor(n.start * RATE);
    const len = Math.floor(n.dur * RATE);
    const harm = n.harm ?? [1];
    for (let i = 0; i < len && s0 + i < out.length; i++) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.008);
      const env = attack * (n.decay ? Math.exp(-t * n.decay) : Math.min(1, (n.dur - t) / 0.02));
      let v = 0;
      harm.forEach((h, k) => {
        const ph = 2 * Math.PI * n.f * (k + 1) * t;
        v += h * (n.square ? Math.sign(Math.sin(ph)) * 0.6 : Math.sin(ph));
      });
      out[s0 + i] += v * env * (n.vol ?? 0.5);
    }
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  // Tüm sesleri aynı yüksek seviyeye getir
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.92 / peak;
  return out;
}

function pattern(id: RingtoneId): Float32Array {
  switch (id) {
    case "dingdong":
      return render(
        [
          { f: 1318.5, start: 0, dur: 1.0, vol: 0.6, harm: [1, 0.3, 0.1], decay: 3.2 },
          { f: 987.8, start: 0.45, dur: 1.2, vol: 0.6, harm: [1, 0.3, 0.1], decay: 2.6 },
        ],
        1.8,
      );
    case "telefon": {
      const notes: Note[] = [];
      for (const burst of [0, 0.45]) for (let k = 0; k < 8; k++) {
        notes.push({ f: 1200, start: burst + k * 0.05, dur: 0.04, vol: 0.35, harm: [1, 0.5] });
        notes.push({ f: 1500, start: burst + k * 0.05 + 0.025, dur: 0.025, vol: 0.3 });
      }
      return render(notes, 1.6);
    }
    case "alarm": {
      const notes: Note[] = [];
      for (let k = 0; k < 6; k++) notes.push({ f: k % 2 ? 1600 : 2000, start: k * 0.14, dur: 0.11, vol: 0.4, square: true });
      return render(notes, 1.0);
    }
    case "kasa":
      return render(
        [
          { f: 2637, start: 0, dur: 0.5, vol: 0.45, harm: [1, 0.4, 0.2], decay: 8 },
          { f: 3136, start: 0.12, dur: 0.9, vol: 0.45, harm: [1, 0.4, 0.2], decay: 5 },
        ],
        1.4,
      );
  }
}

function toWav(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([buf], { type: "audio/wav" });
}

const cache = new Map<RingtoneId, string>();
export function ringtoneUrl(id: RingtoneId): string {
  let u = cache.get(id);
  if (!u) {
    u = URL.createObjectURL(toWav(pattern(id)));
    cache.set(id, u);
  }
  return u;
}
