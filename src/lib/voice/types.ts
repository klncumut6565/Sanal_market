// src/lib/voice/types.ts
//
// Gerçek zamanlı sesli asistan (Realtime Voice) için sağlayıcıdan bağımsız
// tip tanımları. Bkz. "TMGD Asistan — Gerçek Zamanlı Sesli Motor Geliştirme
// Planı" (Faz 2: Voice abstraction — VoiceProvider/STTProvider/TTSProvider/
// RealtimeProvider).
//
// TASARIM İLKESİ: Bu dosya HİÇBİR sağlayıcıya (Gemini, OpenAI, Deepgram...)
// bağımlı olmamalıdır — sadece arayüzleri tanımlar. Somut uygulama
// (şu an için Gemini Live API) src/lib/voice/providers/ altında olacaktır.
// Böylece ileride sağlayıcı değiştirmek/eklemek, bu arayüzü karşılayan yeni
// bir dosya eklemekten ibaret kalır; hook ve UI katmanları etkilenmez.
//
// GÜVENLİK: Kalıcı API anahtarları bu katmandan asla frontend'e geçmez.
// RealtimeProvider yalnızca kısa ömürlü (ephemeral) session token'larıyla
// çalışır — bkz. RealtimeSessionResponse.

// ---------------------------------------------------------------------------
// Genel ses oturumu durumu (frontend hook'un yöneteceği state)
// ---------------------------------------------------------------------------

export type VoiceState =
  | "idle"
  | "connecting"
  | "listening" // bağlı, kullanıcı konuşmuyor, model susuyor
  | "user_speaking" // kullanıcı konuşuyor (transkript akıyor)
  | "processing" // kullanıcı sustu, model cevabı hazırlıyor
  | "tool_calling" // model bir araç çağırdı, sonuç bekleniyor
  | "speaking" // model sesi çalıyor
  | "reconnecting" // oturum yenileniyor (mikrofon açık kalır)
  | "error";

export interface VoiceSession {
  state: VoiceState;
  isMuted: boolean;
  isSpeaking: boolean;
  transcript: string;
  partialTranscript: string;
  assistantTranscript: string;
  metrics: LiveMetrics;
  error?: string;
}

/** Canlı konuşma gecikme ölçümleri (yaklaşık değerler, tarayıcıdan ölçülür). */
export interface LiveMetrics {
  /** Son turda: kullanıcının son sesi → modelin ilk ses parçası (ms). */
  sonYanitMs: number | null;
  /** Son turda: kullanıcının son sesi → ilk sesin çalmaya başlaması (ms). */
  sonCalmaMs: number | null;
  /** Oturum boyunca yanıt gecikmesi ortalaması (ms). */
  ortYanitMs: number | null;
  tur: number;
  /** Son araç çağrısının süresi (ms). */
  sonAracMs: number | null;
  kesinti: number;
  yenidenBaglanma: number;
}

// ---------------------------------------------------------------------------
// STT (Speech-to-Text) — streaming
// ---------------------------------------------------------------------------

export type TranscriptSpeaker = "user" | "assistant";

/** Konuşmacı bilgili transkript olayı. Gemini Live metni PARÇA PARÇA
 *  (artımlı) gönderir: "partial" = yeni gelen parça (hook birleştirir),
 *  "final" = o konuşmacının bu turdaki metni tamamlandı. */
export type TranscriptEvent =
  | { type: "partial"; speaker: TranscriptSpeaker; text: string }
  | { type: "final"; speaker: TranscriptSpeaker; text: string }
  | { type: "error"; message: string };

export interface STTProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  onTranscript(handler: (event: TranscriptEvent) => void): void;
}

// ---------------------------------------------------------------------------
// TTS (Text-to-Speech) — streaming
// ---------------------------------------------------------------------------

export interface TTSProvider {
  /** Metni (veya metin parçasını) seslendirmeye başlar; streaming
   *  destekleyen sağlayıcılarda parça parça çağrılabilir. */
  speak(textChunk: string): Promise<void>;
  /** Devam eden seslendirmeyi anında durdurur (barge-in/interrupt). */
  cancel(): void;
}

// ---------------------------------------------------------------------------
// Realtime session — sunucudan alınan kısa ömürlü bağlantı bilgisi
// ---------------------------------------------------------------------------

export interface RealtimeSessionResponse {
  sessionId: string;
  /** Sağlayıcıya bağlanmak için kullanılacak geçici (ephemeral) token.
   *  Kalıcı API anahtarı DEĞİLDİR; süresi dolar, tek/az sayıda kullanım
   *  için sınırlıdır. */
  token: string;
  /** ISO 8601 — token bu zamandan sonra geçersiz olur. */
  expiresAt: string;
  /** Token'ın üretildiği API sürümü (örn. "v1beta" / "v1alpha") —
   *  WebSocket bağlantısı MUTLAKA aynı sürümü kullanmalı, aksi halde
   *  token geçersiz sayılabilir. Gemini Live'a özgüdür, diğer
   *  sağlayıcılarda kullanılmayabilir. */
  apiVersion?: string;
}

export interface RealtimeProvider {
  connect(
    session: RealtimeSessionResponse,
    resumeHandle?: string | null,
    /** Dinamik bağlamla zenginleştirilmiş sistem talimatı (opsiyonel). */
    systemInstruction?: string
  ): Promise<void>;
  /** Oturum devam tutamacı (yoksa null) — yeniden bağlanmada kullanılır. */
  getResumeHandle(): string | null;
  /** Sunucu oturumun yakında kapanacağını bildirdiğinde (goAway). */
  onGoAway(handler: (timeLeftMs: number | null) => void): void;
  /** Bilinçsiz bağlantı kopması. */
  onClose(handler: () => void): void;
  disconnect(): Promise<void>;
  sendAudio(chunk: ArrayBuffer): void;
  interrupt(): void;
  onTranscript(handler: (event: TranscriptEvent) => void): void;
  onAudio(handler: (chunk: ArrayBuffer) => void): void;
  onError(handler: (message: string) => void): void;
  /** Sunucu, kullanıcının konuşarak modeli kestiğini (barge-in) bildirdiğinde
   *  tetiklenir. Hook bu sinyali alınca çalma kuyruğundaki henüz seslendirilmemiş
   *  ses parçalarını ANINDA temizlemelidir. */
  onInterrupted(handler: () => void): void;
  /** Modelin bu turu tamamladığını (üretimi bitirdiğini) bildirir. Bu,
   *  tarayıcıdaki ses çalmanın bittiği anlamına GELMEZ — kuyrukta hâlâ
   *  çalınmamış ses olabilir. */
  onTurnComplete(handler: () => void): void;
  /** Sağlayıcı bir tool/fonksiyon çağırmak istediğinde tetiklenir. Handler
   *  gerçek veriyi getirip Promise ile döner; sağlayıcı sonucu uygun
   *  protokol mesajıyla sağlayıcıya geri iletir. */
  onToolCall(handler: (name: string, args: Record<string, unknown>) => Promise<unknown>): void;
}
