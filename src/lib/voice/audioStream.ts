"use client";

// src/lib/voice/audioStream.ts
//
// Web Audio API ile ham PCM ses yakalama/çalma. Gemini Live sabit format
// bekliyor (bkz. geminiLive.ts): giriş 16-bit PCM/16kHz/mono, çıkış 16-bit
// PCM/24kHz/mono. Tarayıcının getUserMedia'sı genelde 44.1/48kHz yakalar,
// bu yüzden manuel downsampling gerekiyor.
//
// MİKROFON YAKALAMA: AudioWorklet (ses işleme ayrı thread'de, ana thread'i
// bloklamaz) + durumlu (stateful) resampler + sabit ~20 ms'lik çıkış
// parçaları (Google Live API önerisi 20-40 ms). AudioWorklet desteklenmezse
// (eski tarayıcılar) aynı resampler ile ScriptProcessorNode'a düşülür.
//
// RESAMPLER: alan-ortalamalı (box filter) — her 16 kHz çıkış örneği, giriş
// akışındaki ilgili aralığın kesirli ağırlıklı ortalamasıdır. Bu hem
// anti-aliasing (alçak geçiren) görevi görür hem de 44.1 kHz gibi tam katı
// olmayan oranlarda çalışır. Durum parçalar arasında korunur, böylece
// chunk sınırlarında süreksizlik oluşmaz.

const HEDEF_ORNEKLEME = 16000; // Gemini Live giriş gereksinimi
const CIKIS_ORNEKLEME = 24000; // Gemini Live çıkış formatı
const CIKIS_PARCA_MS = 20; // gönderilen her PCM parçasının süresi
const CIKIS_PARCA_ORNEK = (HEDEF_ORNEKLEME * CIKIS_PARCA_MS) / 1000; // 320
const FALLBACK_BUFFER_BOYUTU = 2048; // yalnızca ScriptProcessor yedeği için

/** Durumlu alan-ortalamalı resampler + sabit boyutlu Int16 parçalayıcı. */
class PcmResampler {
  private oran: number;
  private acc = 0;
  private gerekli: number;
  private cikis = new Int16Array(CIKIS_PARCA_ORNEK);
  private doluluk = 0;

  constructor(girisOrnekleme: number, private onChunk: (pcm: ArrayBuffer) => void) {
    this.oran = girisOrnekleme / HEDEF_ORNEKLEME;
    this.gerekli = this.oran;
  }

  push(input: Float32Array) {
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      let kalan = 1;
      while (kalan > 1e-9) {
        const al = kalan < this.gerekli ? kalan : this.gerekli;
        this.acc += x * al;
        this.gerekli -= al;
        kalan -= al;
        if (this.gerekli <= 1e-9) {
          const v = Math.max(-1, Math.min(1, this.acc / this.oran));
          this.cikis[this.doluluk++] = v < 0 ? v * 0x8000 : v * 0x7fff;
          this.acc = 0;
          this.gerekli = this.oran;
          if (this.doluluk === CIKIS_PARCA_ORNEK) {
            this.onChunk(this.cikis.slice().buffer as ArrayBuffer);
            this.doluluk = 0;
          }
        }
      }
    }
  }
}

/** AudioWorklet kaynak kodu (Blob URL ile yüklenir — ayrı dosya gerekmez).
 *  Yukarıdaki PcmResampler ile AYNI algoritma; thread sınırı yüzünden kopya. */
const WORKLET_KAYNAK = `
class MikrofonIsleyici extends AudioWorkletProcessor {
  constructor() {
    super();
    this.oran = sampleRate / ${HEDEF_ORNEKLEME};
    this.gerekli = this.oran;
    this.acc = 0;
    this.cikis = new Int16Array(${CIKIS_PARCA_ORNEK});
    this.doluluk = 0;
  }
  process(inputs) {
    const kanal = inputs[0] && inputs[0][0];
    if (!kanal) return true;
    for (let i = 0; i < kanal.length; i++) {
      const x = kanal[i];
      let kalan = 1;
      while (kalan > 1e-9) {
        const al = kalan < this.gerekli ? kalan : this.gerekli;
        this.acc += x * al;
        this.gerekli -= al;
        kalan -= al;
        if (this.gerekli <= 1e-9) {
          let v = this.acc / this.oran;
          v = v > 1 ? 1 : v < -1 ? -1 : v;
          this.cikis[this.doluluk++] = v < 0 ? v * 0x8000 : v * 0x7fff;
          this.acc = 0;
          this.gerekli = this.oran;
          if (this.doluluk === ${CIKIS_PARCA_ORNEK}) {
            const kopya = this.cikis.slice();
            this.port.postMessage(kopya.buffer, [kopya.buffer]);
            this.doluluk = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor("mikrofon-isleyici", MikrofonIsleyici);
`;

export type MicCapture = {
  stop: () => void;
};

/**
 * Mikrofonu açar ve yakalanan sesi ~16kHz mono 16-bit PCM ArrayBuffer
 * parçaları hâlinde `onChunk`'a iletir. Mikrofon izni burada istenir —
 * kullanıcı reddederse Promise reddedilir.
 */
/**
 * iPhone Safari: `navigator.audioSession.type` "playback" kalmışsa (ör. admin
 * sipariş zili ayarladıysa) mikrofon açılmaz → "AudioSession category is not
 * compatible with audio capture". Yakalamadan önce kayıt+çalma moduna al.
 */
function prepareAudioSessionForCapture() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession && nav.audioSession.type !== "play-and-record") {
      nav.audioSession.type = "play-and-record";
    }
  } catch {
    /* desteklenmiyor */
  }
}

export async function startMicCapture(onChunk: (pcm: ArrayBuffer) => void): Promise<MicCapture> {
  prepareAudioSessionForCapture();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    // Bazı iOS sürümlerinde "auto" daha uyumlu — bir kez daha dene.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (!nav.audioSession) throw e;
    try {
      nav.audioSession.type = "auto";
    } catch {
      throw e;
    }
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  }

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioCtx();
  // Tarayıcı otomatik oynatma politikası askıya almış olabilir.
  if (audioContext.state === "suspended") await audioContext.resume().catch(() => {});
  const source = audioContext.createMediaStreamSource(stream);
  const sessizCikis = audioContext.createGain();
  sessizCikis.gain.value = 0;
  sessizCikis.connect(audioContext.destination);

  let temizle: () => void;

  try {
    if (typeof AudioWorkletNode !== "undefined" && audioContext.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET_KAYNAK], { type: "application/javascript" }));
      try {
        await audioContext.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const node = new AudioWorkletNode(audioContext, "mikrofon-isleyici", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
      });
      node.port.onmessage = (ev: MessageEvent<ArrayBuffer>) => onChunk(ev.data);
      source.connect(node);
      node.connect(sessizCikis);
      temizle = () => {
        node.port.onmessage = null;
        node.disconnect();
      };
    } else {
      // Yedek: ScriptProcessorNode (deprecated) + aynı durumlu resampler.
      const resampler = new PcmResampler(audioContext.sampleRate, onChunk);
      const processor = audioContext.createScriptProcessor(FALLBACK_BUFFER_BOYUTU, 1, 1);
      processor.onaudioprocess = (ev) => resampler.push(ev.inputBuffer.getChannelData(0));
      source.connect(processor);
      processor.connect(sessizCikis);
      temizle = () => {
        processor.onaudioprocess = null;
        processor.disconnect();
      };
    }
  } catch (e) {
    // Worklet yüklenemezse mikrofon açık kalmasın.
    stream.getTracks().forEach((t) => t.stop());
    audioContext.close();
    throw e;
  }

  return {
    stop: () => {
      temizle();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      audioContext.close();
    },
  };
}

/**
 * Gemini Live'dan gelen 24kHz mono 16-bit PCM parçalarını SIRAYLA çalan
 * kuyruk. `clear()` barge-in/interrupt anında henüz çalınmamış parçaları
 * anında iptal eder (bkz. useRealtimeVoice.ts).
 */
export class AudioPlaybackQueue {
  private audioContext: AudioContext;
  private cikis: GainNode;
  private kuyruk: AudioBufferSourceNode[] = [];
  private sonrakiBaslangicZamani = 0;
  private onSpeakingChange: ((speaking: boolean) => void) | null = null;

  /** JITTER TAMPONU: ağdan gelen parçalar geç kalsa da ses kopmasın diye
   *  konuşma başında / kuyruk boşalıp yeniden dolduğunda çalma bu kadar
   *  ileriye planlanır. (Kısa tutuldu: gecikme hissi yaratmasın.) */
  private static readonly JITTER_SN = 0.12;
  /** Barge-in'de sesin tık sesi çıkarmadan kısılma süresi. */
  private static readonly SONUM_SN = 0.03;

  constructor() {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    // Bağlamı doğrudan 24 kHz'de aç: her parçanın ayrı ayrı yeniden
    // örneklenmesinden doğan kenar çıtırtılarını önler. Desteklenmezse
    // varsayılana düşer.
    try {
      this.audioContext = new AudioCtx({ sampleRate: CIKIS_ORNEKLEME });
    } catch {
      this.audioContext = new AudioCtx();
    }
    this.cikis = this.audioContext.createGain();
    this.cikis.connect(this.audioContext.destination);
    // Kullanıcı tıklamasıyla (Canlı Konuşma butonu) oluşturulur; yine de
    // askıdaysa devam ettir.
    void this.audioContext.resume().catch(() => {});
  }

  onSpeaking(handler: (speaking: boolean) => void) {
    this.onSpeakingChange = handler;
  }

  /** Ham 24kHz/16-bit/mono PCM parçasını kuyruğa ekler ve sırayla çalar. */
  enqueue(pcmChunk: ArrayBuffer) {
    // Tek sayıda bayt gelirse (yarım örnek) Int16Array hata verir — kırp.
    const bayt = pcmChunk.byteLength - (pcmChunk.byteLength % 2);
    if (bayt <= 0) return;
    const int16 = new Int16Array(pcmChunk.slice(0, bayt));
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;

    const buffer = this.audioContext.createBuffer(1, float32.length, CIKIS_ORNEKLEME);
    buffer.copyToChannel(float32, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.cikis);

    const simdi = this.audioContext.currentTime;
    // Kuyruk boşalmışsa (ilk parça ya da ağ gecikmesi sonrası) çalmayı
    // jitter payı kadar ileriye planla; böylece sonraki parçalar yetişir.
    let baslangic = this.sonrakiBaslangicZamani;
    if (baslangic < simdi + 0.005) {
      baslangic = simdi + AudioPlaybackQueue.JITTER_SN;
    }
    source.start(baslangic);
    this.sonrakiBaslangicZamani = baslangic + buffer.duration;

    this.kuyruk.push(source);
    this.onSpeakingChange?.(true);
    source.onended = () => {
      this.kuyruk = this.kuyruk.filter((s) => s !== source);
      if (this.kuyruk.length === 0) this.onSpeakingChange?.(false);
    };
  }

  /** Kuyrukta çalan/çalınacak ses var mı (modelin üretimi bitmiş olsa bile). */
  isPlaying(): boolean {
    return this.kuyruk.length > 0;
  }

  /** Barge-in: çalan/çalınacak tüm parçaları, tık sesi çıkmaması için
   *  ~30 ms'lik kısa bir kısılmayla durdurur. */
  clear() {
    const eskiler = this.kuyruk;
    this.kuyruk = [];
    this.onSpeakingChange?.(false);

    const t = this.audioContext.currentTime;
    const eskiGain = this.cikis;
    try {
      eskiGain.gain.cancelScheduledValues(t);
      eskiGain.gain.setValueAtTime(eskiGain.gain.value, t);
      eskiGain.gain.linearRampToValueAtTime(0, t + AudioPlaybackQueue.SONUM_SN);
    } catch {}

    // Yeni konuşma için temiz bir çıkış düğümü; eskisi kısılıp atılır.
    this.cikis = this.audioContext.createGain();
    this.cikis.connect(this.audioContext.destination);
    this.sonrakiBaslangicZamani = 0;

    setTimeout(() => {
      eskiler.forEach((s) => {
        try {
          s.stop();
        } catch {
          // zaten durmuşsa hata verebilir, önemsiz
        }
      });
      try {
        eskiGain.disconnect();
      } catch {}
    }, AudioPlaybackQueue.SONUM_SN * 1000 + 20);
  }

  close() {
    this.clear();
    setTimeout(() => {
      void this.audioContext.close().catch(() => {});
    }, 120);
  }
}

/**
 * Gürültü kapısı + yankı koruması (mikrofon → yapay zekâ).
 *  - Ortam gürültüsünü sürekli ölçer (son 2 sn içindeki en düşük seviye; sürekli uğultuya ~2-3 sn içinde uyum sağlar); eşik = max(taban, gürültü × 2,2).
 *  - Eşiğin altındaki çerçeveler sessizlik (sıfır) olarak gönderilir → buzdolabı, TV, kalabalık
 *    uğultusu modelde "müşteri konuşuyor" algısı yaratmaz. Akış kesilmez (sunucu sessizliği görür).
 *  - Asistan konuşurken (hoparlör) eşik 2,5 kat yükselir: hoparlörden mikrofona sızan yankı
 *    asistanın sözünü kesmez, ama müşteri yüksek sesle araya girerse yine duyulur.
 *  - Konuşma algılanınca 400 ms boyunca kapı açık kalır (kelime sonları kırpılmaz).
 */
/** Gürültü kapısı durum bilgisi (teşhis kaydı için). */
export type GateStats = { lastRms: number; lastThr: number; suppressed: number; bargeIns: number; unvoiced: number };

/** Asistan konuşurken söze girmenin sayılması için sesin kesintisiz yüksek kalması gereken süre. */
export const BARGE_IN_MS = 260;
/** Bu süre boyunca yüksek ama "insan sesi değil" (perdesiz) kalan ses söze girme sayılmaz. */
const BARGE_IN_MAX_MS = 700;
/** Bekleyen parçaların en az bu oranı insan sesi (perdeli) olmalı. */
const VOICED_RATIO = 0.5;

/**
 * İnsan sesi (perdeli ses) ölçüsü: 80–400 Hz aralığında normalize öz-ilinti tepe değeri (0..1).
 * Konuşmadaki sesli harfler düzenli titreşim içerir (yüksek değer); kapı çarpması, alkış, kaşık düşmesi,
 * masaya vurma gibi darbe / gürültü sesleri düzensizdir (düşük değer). Model gerektirmez, telefonda hafiftir.
 */
export function voicing(cur: Int16Array, prev: Int16Array | null): number {
  // Sıfır geçiş oranı: sesli harflerde düşük (< ~3000/sn); tiz çınlama / ıslık / tıslamada yüksek
  let zc = 0;
  for (let i = 1; i < cur.length; i++) if ((cur[i - 1] < 0) !== (cur[i] < 0)) zc++;
  if ((zc * HEDEF_ORNEKLEME) / cur.length > 3000) return 0;
  const n = cur.length + (prev?.length ?? 0);
  const x = new Float32Array(n);
  let o = 0;
  if (prev) for (let i = 0; i < prev.length; i++) x[o++] = prev[i];
  for (let i = 0; i < cur.length; i++) x[o++] = cur[i];
  // ~900 Hz alçak geçiren (2 kez tek kutuplu): ses perdesi ve ilk harmonikler kalır; yüksek frekanslı
  // çınlamalar (kaşık, bardak, bip) ayıklanır — aksi hâlde onların düzenli titreşimi de "perdeli" görünür.
  const a = 1 - Math.exp((-2 * Math.PI * 900) / HEDEF_ORNEKLEME);
  for (let pass = 0; pass < 2; pass++) {
    let y = x[0];
    for (let i = 0; i < n; i++) {
      y += a * (x[i] - y);
      x[i] = y;
    }
  }
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  for (let i = 0; i < n; i++) x[i] -= mean;
  const minLag = Math.floor(HEDEF_ORNEKLEME / 400); // 400 Hz
  const maxLag = Math.min(Math.floor(HEDEF_ORNEKLEME / 80), n - 80); // 80 Hz
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i + lag < n; i++) {
      const a = x[i];
      const b = x[i + lag];
      num += a * b;
      e1 += a * a;
      e2 += b * b;
    }
    const r = e1 > 0 && e2 > 0 ? num / Math.sqrt(e1 * e2) : 0;
    if (r > best) best = r;
  }
  return best;
}

/**
 * Gürültü kapısı + hoparlör yankısı koruması.
 * • Asistan susarken: ses eşiği geçince kapı açılır, 400 ms açık kalır (kelime araları kesilmez).
 * • Asistan konuşurken (söze girme): eşik 2,5 kat, ses en az BARGE_IN_MS boyunca KESİNTİSİZ yüksek kalmalı
 *   VE bu parçaların en az yarısı insan sesi (perdeli) olmalı — kapı / alkış / kaşık gibi uzun darbe sesleri elenir.
 *   Bu süre boyunca parçalar bekletilir; ses sürerse bekletilenler de gönderilir ("Dur!" kelimesinin başı
 *   kaybolmaz), kısa bir tıkırtı / kapı / masa sesiyse sessizlik olarak gönderilir ve asistan kesilmez.
 * Dönüş: gönderilecek parçalar (0..n adet).
 */
export function createNoiseGate(base = 420) {
  const hist: { t: number; rms: number }[] = [];
  let openUntil = 0;
  let echoTailUntil = 0;
  let pending: ArrayBuffer[] = [];
  let pendingSince = 0;
  let pendingVoiced = 0;
  let pendingGap = 0; // söze girme beklenirken art arda sessiz parça sayısı (hece araları)
  let prevFrame: Int16Array | null = null;
  const stats: GateStats = { lastRms: 0, lastThr: 0, suppressed: 0, bargeIns: 0, unvoiced: 0 };
  const silence = (b: ArrayBuffer) => new ArrayBuffer(b.byteLength);

  const gate = (pcm: ArrayBuffer, assistantPlaying: boolean): { out: ArrayBuffer; outs: ArrayBuffer[]; rms: number; voiced: boolean } => {
    const v = new Int16Array(pcm);
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    const rms = v.length ? Math.sqrt(sum / v.length) : 0;
    const now = Date.now();
    if (assistantPlaying) echoTailUntil = now + 350; // hoparlör sustuktan sonra kısa yankı kuyruğu
    const echo = assistantPlaying || now < echoTailUntil;
    // Gürültü tabanı = son 2 sn'deki en düşük seviye. Sürekli uğultu tabanı yükseltir; konuşmada
    // kelime aralarındaki kısa duraklamalar tabanı düşük tutar. Asistan konuşurken ölçülmez.
    if (!echo) hist.push({ t: now, rms });
    while (hist.length && hist[0].t < now - 2000) hist.shift();
    const floor = hist.length >= 6 ? Math.min(...hist.map((h) => h.rms)) : 150;
    const thr = Math.max(base, floor * 2.2) * (echo ? 2.5 : 1);
    const loud = rms > thr;
    stats.lastRms = Math.round(rms);
    stats.lastThr = Math.round(thr);

    const done = (outs: ArrayBuffer[], voiced: boolean) => ({ out: outs[outs.length - 1] ?? silence(pcm), outs, rms, voiced });

    // Kapı zaten açıksa (konuşma sürüyor) olduğu gibi geçir
    if (now < openUntil) {
      if (loud) openUntil = now + 400;
      return done([pcm], true);
    }
    if (!echo) {
      // Asistan susuyor: bekleyen varsa (yankı kuyruğu bitti) sessizlik olarak boşalt
      const flushed = pending.map(silence);
      pending = [];
      if (loud) {
        openUntil = now + 400;
        return done([...flushed, pcm], true);
      }
      return done([...flushed, silence(pcm)], false);
    }
    // Asistan konuşuyor: söze girme için kesintisiz yüksek VE insan sesi olan ses ara
    if (loud) {
      if (!pending.length) {
        pendingSince = now;
        pendingVoiced = 0;
      }
      pendingGap = 0;
      pending.push(pcm);
      if (voicing(v, prevFrame) > 0.55) pendingVoiced++;
      prevFrame = v;
      const age = now - pendingSince;
      if (age >= BARGE_IN_MS && pendingVoiced / pending.length >= VOICED_RATIO) {
        const outs = pending;
        pending = [];
        openUntil = now + 400;
        stats.bargeIns++;
        return done(outs, true);
      }
      if (age >= BARGE_IN_MAX_MS) {
        // Uzun ama insan sesi değil (darbe / gürültü): asistanı kesme
        stats.unvoiced++;
        const outs = pending.map(silence);
        pending = [];
        return done(outs, false);
      }
      return { out: silence(pcm), outs: [], rms, voiced: false };
    }
    prevFrame = v;
    if (pending.length && pendingGap < 3) {
      // Hece / kelime arası kısa düşüş (≤60 ms): beklemeye devam
      pendingGap++;
      pending.push(pcm);
      return { out: silence(pcm), outs: [], rms, voiced: false };
    }
    if (pending.length) {
      pendingGap = 0;
      // Kısa ses patlaması: asistanı kesme, sessizlik gönder
      stats.suppressed++;
      const outs = [...pending.map(silence), silence(pcm)];
      pending = [];
      return done(outs, false);
    }
    return done([silence(pcm)], false);
  };
  return Object.assign(gate, { stats });
}
