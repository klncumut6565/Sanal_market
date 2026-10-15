"use client";

// src/lib/voice/providers/geminiLive.ts
// (TMGD Asistan projesinden alındı; araç listesi ve sistem talimatı artık
//  dışarıdan verilir — bkz. constructor.)
//
// RealtimeProvider arayüzünün (bkz. src/lib/voice/types.ts) Gemini Live
// API uygulaması. Ham WebSocket protokolünü konuşur — SDK kullanmıyoruz
// (bundle boyutu ve kontrol için), Google'ın resmi WebSocket rehberindeki
// mesaj formatına birebir uyar:
//   https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket
//
// SES FORMATI (Google'ın sabit gereksinimi, değiştirilemez):
//   Giriş (mikrofon) : ham 16-bit PCM, 16kHz, mono, little-endian
//   Çıkış (TTS)       : ham 16-bit PCM, 24kHz, mono
//
// ÖNEMLİ NOT — CANLI TEST GEREKİYOR: Aşağıdaki mesaj şemaları Google'ın
// güncel (2026) resmi dokümantasyonundan alınmıştır, ancak WebSocket
// URL'sindeki API versiyonu (v1beta) ve `serverContent.interrupted`
// alanının tam davranışı gerçek bir bağlantıyla doğrulanmalıdır — bu
// dosya bir tarayıcıda gerçek mikrofon/ses testi olmadan bu ortamda
// çalıştırılamadı.

import type {
  RealtimeProvider,
  RealtimeSessionResponse,
  TranscriptEvent,
} from "../types";

const GEMINI_LIVE_MODEL = "models/gemini-3.1-flash-live-preview";
const WS_HOST = "generativelanguage.googleapis.com";

type ToolCallHandler = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export class GeminiLiveProvider implements RealtimeProvider {
  constructor(
    private readonly tools: Record<string, unknown>[],
    private readonly defaultInstruction: string
  ) {}

  private ws: WebSocket | null = null;
  private transcriptHandler: ((e: TranscriptEvent) => void) | null = null;
  private audioHandler: ((chunk: ArrayBuffer) => void) | null = null;
  private errorHandler: ((message: string) => void) | null = null;
  private interruptedHandler: (() => void) | null = null;
  private turnCompleteHandler: (() => void) | null = null;
  private toolCallHandler: ToolCallHandler | null = null;
  private goAwayHandler: ((timeLeftMs: number | null) => void) | null = null;
  private closeHandler: ((code: number, reason: string) => void) | null = null;
  /** Otomatik yeniden bağlanma: beklenmeyen kopma / goAway sonrası yeni token + oturum devam tutamacıyla */
  private reconnectCfg: {
    fetchSession: () => Promise<RealtimeSessionResponse>;
    max: number;
    onState: (s: "reconnecting" | "ok" | "failed", info: { code?: number; reason?: string; resumed?: boolean; attempt: number; error?: string }) => void;
  } | null = null;
  private reconnectCount = 0;
  private reconnecting = false;
  private lastInstruction: string | undefined;
  private setupDone = false;
  /** disconnect() ile bilinçli kapatıldıysa onclose hata/yeniden bağlanma tetiklemez. */
  private kapatildi = false;
  /** Sunucunun verdiği en son oturum devam (resumption) tutamacı. */
  private resumeHandle: string | null = null;
  private setupResolve: (() => void) | null = null;

  /** Gerçek araç çalıştırma mantığını dışarıdan (hook'tan) alır — bu sınıf
   *  yalnızca protokolü konuşur, veri erişimine karışmaz. */
  onToolCall(handler: ToolCallHandler) {
    this.toolCallHandler = handler;
  }

  /** Oturum yeniden bağlanırken kullanılacak en son tutamaç (yoksa null). */
  getResumeHandle(): string | null {
    return this.resumeHandle;
  }

  /** Sunucu "oturum yakında kapanacak" (goAway) dediğinde tetiklenir. */
  onGoAway(handler: (timeLeftMs: number | null) => void) {
    this.goAwayHandler = handler;
  }

  /** Bilinçsiz (beklenmeyen) bağlantı kopmasında tetiklenir; hook yeniden bağlanmayı dener. */
  onClose(handler: (code: number, reason: string) => void) {
    this.closeHandler = handler;
  }

  /** Beklenmeyen kopmada otomatik yeniden bağlanmayı açar. */
  enableAutoReconnect(cfg: NonNullable<GeminiLiveProvider["reconnectCfg"]>) {
    this.reconnectCfg = cfg;
  }

  /** Bağlantıyı bilerek yeniler (ör. goAway geldiğinde, asistan sustuğunda). */
  async reconnectNow(why = "goAway"): Promise<boolean> {
    return this.yenidenBaglan(0, why);
  }

  private async yenidenBaglan(code: number, reason: string): Promise<boolean> {
    const cfg = this.reconnectCfg;
    if (!cfg || this.reconnecting || this.kapatildi) return false;
    if (this.reconnectCount >= cfg.max) return false;
    this.reconnecting = true;
    this.reconnectCount += 1;
    const attempt = this.reconnectCount;
    cfg.onState("reconnecting", { code, reason, attempt });
    // Eski soketi sessizce bırak (kapanışı hata sayılmasın)
    const eski = this.ws;
    if (eski) {
      eski.onclose = null;
      eski.onmessage = null;
      eski.onerror = null;
      try {
        eski.close();
      } catch {
        /* yok say */
      }
    }
    this.ws = null;
    this.setupDone = false;
    const handle = this.resumeHandle;
    try {
      const sess = await cfg.fetchSession();
      if (this.kapatildi) return false;
      await this.connect(sess, handle, this.lastInstruction);
      cfg.onState("ok", { code, reason, resumed: !!handle, attempt });
      return true;
    } catch (e) {
      cfg.onState("failed", { code, reason, attempt, error: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      this.reconnecting = false;
    }
  }

  async connect(
    session: RealtimeSessionResponse,
    resumeHandle?: string | null,
    systemInstruction?: string
  ): Promise<void> {
    // Ephemeral token'lar NORMAL BidiGenerateContent uç noktasında kabul
    // EDİLMEZ ("Method doesn't allow unregistered callers" / 1008). Token ile
    // bağlanmak için BidiGenerateContentConstrained uç noktası kullanılır
    // (resmi SDK de böyle yapar; SDK v1alpha kullanır). Sürümler sırayla denenir.
    if (systemInstruction) this.lastInstruction = systemInstruction;
    if (!this.reconnecting) {
      this.kapatildi = false;
      this.reconnectCount = 0;
    }
    const surumler = Array.from(new Set(["v1alpha", session.apiVersion || "v1beta", "v1beta"]));
    let sonHata: Error | null = null;
    for (const surum of surumler) {
      if (this.kapatildi) throw new Error("Oturum kapatıldı.");
      try {
        await this.baglan(session, surum, resumeHandle, systemInstruction);
        if (this.kapatildi) {
          // bağlanırken kullanıcı kapattı
          this.ws?.close();
          this.ws = null;
          throw new Error("Oturum kapatıldı.");
        }
        return;
      } catch (e) {
        sonHata = e instanceof Error ? e : new Error(String(e));
        try {
          this.ws?.close();
        } catch {
          /* yok say */
        }
        this.ws = null;
        this.setupDone = false;
      }
    }
    throw sonHata ?? new Error("Gemini Live bağlantısı kurulamadı.");
  }

  private async baglan(
    session: RealtimeSessionResponse,
    surum: string,
    resumeHandle?: string | null,
    systemInstruction?: string
  ): Promise<void> {
    const wsPath = `/ws/google.ai.generativelanguage.${surum}.GenerativeService.BidiGenerateContentConstrained`;
    // ÖNEMLİ: Ephemeral token NORMAL bir API anahtarı gibi "?key=" ile
    // GÖNDERİLEMEZ. Resmi dokümantasyon (ephemeral-tokens sayfası, "Connect
    // to Live API with an ephemeral token" bölümündeki not): "If not using
    // the SDK, note that ephemeral tokens must either be passed in an
    // `access_token` query parameter, or in an HTTP `Authorization` header
    // prefixed by the auth-scheme `Token`." SDK kullanmadığımız (ham
    // WebSocket) için access_token query parametresi kullanılıyor.
    const url = `wss://${WS_HOST}${wsPath}?access_token=${encodeURIComponent(session.token)}`;

    this.resumeHandle = resumeHandle ?? null;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      this.setupResolve = resolve;

      ws.onopen = () => {
        // İlk mesaj her zaman "setup" olmalı — sunucu setupComplete
        // dönene kadar başka mesaj gönderilmez.
        ws.send(
          JSON.stringify({
            setup: {
              model: GEMINI_LIVE_MODEL,
              // Şema (Google Live API referansı): responseModalities
              // generationConfig İÇİNDE; transcription alanları setup'ın
              // ÜST seviyesinde.
              generationConfig: {
                responseModalities: ["AUDIO"],
                // Konuşma dili HER ZAMAN Türkçe (otomatik dil algılama yok).
                speechConfig: {
                  languageCode: "tr-TR",
                  // SABİT KADIN SESİ — voiceName verilmezse model sesi
                  // oturumdan oturuma değişebiliyor. "Kore" kadın sesidir.
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
                },
              },
              systemInstruction: { parts: [{ text: systemInstruction || this.defaultInstruction }] },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: [{ functionDeclarations: this.tools }],
              // Konuşma algılama: hoparlör yankısı/gürültü modeli yanlışlıkla
              // "kullanıcı konuşuyor" diye kesmesin → başlangıç hassasiyeti düşük,
              // bitişte biraz daha uzun sessizlik beklenir.
              realtimeInputConfig: {
                automaticActivityDetection: {
                  startOfSpeechSensitivity: "START_SENSITIVITY_LOW",
                  silenceDurationMs: 800,
                },
              },
              // Oturum devamı: sunucu sessionResumptionUpdate ile tutamaç
              // yollar; bağlantı kopunca/goAway'de bununla kaldığı yerden
              // devam edilir.
              sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
              // Uzun konuşmalarda bağlam penceresini otomatik kaydır
              // (ses token'ları hızlı birikir).
              contextWindowCompression: { slidingWindow: {} },
            },
          })
        );
      };

      ws.onerror = () => {
        reject(new Error("Gemini Live bağlantı hatası."));
      };

      ws.onclose = (ev) => {
        if (this.ws !== ws && this.setupDone) return; // eski/başarısız denemenin gecikmiş kapanışı
        if (!this.setupDone) {
          reject(new Error(`Bağlantı kapandı (${ev.code})${ev.reason ? `: ${ev.reason}` : "."}`));
          return;
        }
        if (this.kapatildi) return; // kullanıcı kapattı — hata değil
        if (this.ws !== ws) return;
        void (async () => {
          // Önce otomatik yeniden bağlanmayı dene; olmazsa kapanışı bildir
          if (await this.yenidenBaglan(ev.code, ev.reason || "")) return;
          if (this.kapatildi) return;
          if (this.closeHandler) this.closeHandler(ev.code, ev.reason || "");
          else this.errorHandler?.(`Bağlantı kapandı (${ev.code})${ev.reason ? `: ${ev.reason}` : "."}`);
        })();
      };

      ws.onmessage = (ev) => {
        if (this.ws === ws) this.handleMessage(ev);
      };
    });
  }

  private async handleMessage(ev: MessageEvent) {
    // Metin (JSON) veya Blob (ses) gelebilir — resmi rehberdeki desen.
    let payload: string;
    if (ev.data instanceof Blob) {
      payload = await ev.data.text();
    } else if (ev.data instanceof ArrayBuffer) {
      payload = new TextDecoder().decode(ev.data);
    } else {
      payload = ev.data as string;
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(payload);
    } catch {
      return; // ayrıştırılamayan mesajı sessizce atla
    }

    if (msg.setupComplete) {
      this.setupDone = true;
      this.setupResolve?.();
      return;
    }

    if (msg.toolCall) {
      await this.handleToolCall(msg.toolCall as { functionCalls?: { id: string; name: string; args?: Record<string, unknown> }[] });
      return;
    }

    if (msg.serverContent) {
      this.handleServerContent(
        msg.serverContent as {
          modelTurn?: { parts?: { inlineData?: { data: string; mimeType: string } }[] };
          interrupted?: boolean;
          turnComplete?: boolean;
        }
      );
    }

    // Transkriptler protokolde serverContent İÇİNDE gelir; eski/alternatif
    // sürümler için üst seviyedeki alanlar da kabul edilir.
    const sc = (msg.serverContent ?? {}) as {
      inputTranscription?: { text?: string };
      outputTranscription?: { text?: string };
    };
    const inT = (sc.inputTranscription ?? (msg.inputTranscription as { text?: string } | undefined))?.text ?? "";
    if (inT) this.transcriptHandler?.({ type: "partial", speaker: "user", text: inT });
    const outT = (sc.outputTranscription ?? (msg.outputTranscription as { text?: string } | undefined))?.text ?? "";
    if (outT) this.transcriptHandler?.({ type: "partial", speaker: "assistant", text: outT });

    if (msg.sessionResumptionUpdate) {
      const u = msg.sessionResumptionUpdate as { newHandle?: string; resumable?: boolean };
      if (u.resumable && u.newHandle) this.resumeHandle = u.newHandle;
    }

    if (msg.goAway) {
      const t = (msg.goAway as { timeLeft?: string }).timeLeft;
      const ms = t ? Math.round(parseFloat(t) * 1000) : NaN; // "50s" biçimi
      this.goAwayHandler?.(Number.isFinite(ms) ? ms : null);
    }
  }

  private handleServerContent(content: {
    modelTurn?: { parts?: { inlineData?: { data: string; mimeType: string } }[] };
    interrupted?: boolean;
    turnComplete?: boolean;
  }) {
    // Kullanıcı araya girdiğinde (barge-in) sunucu bunu bildirir — kuyruktaki
    // sesin ANINDA durdurulması hook tarafında yapılmalı (bkz. interrupt()).
    if (content.interrupted) {
      this.interruptedHandler?.();
      return;
    }

    if (content.turnComplete) {
      this.transcriptHandler?.({ type: "final", speaker: "assistant", text: "" });
      this.turnCompleteHandler?.();
    }

    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const bytes = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0));
        this.audioHandler?.(bytes.buffer);
      }
    }
  }

  private async handleToolCall(toolCall: {
    functionCalls?: { id: string; name: string; args?: Record<string, unknown> }[];
  }) {
    const calls = toolCall.functionCalls ?? [];
    if (calls.length === 0) return;

    // Not: gemini-3.1-flash-live-preview için function calling SENKRON —
    // model, tool cevabı gelene kadar konuşmaya devam etmez. Bu yüzden
    // tüm çağrılar burada beklenip TEK seferde toolResponse ile dönülür.
    const responses = await Promise.all(
      calls.map(async (call) => {
        try {
          const result = this.toolCallHandler
            ? await this.toolCallHandler(call.name, call.args ?? {})
            : { error: "Araç çalıştırıcı tanımlı değil." };
          return { id: call.id, name: call.name, response: result as Record<string, unknown> };
        } catch (e) {
          return {
            id: call.id,
            name: call.name,
            response: { error: e instanceof Error ? e.message : String(e) },
          };
        }
      })
    );

    this.ws?.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
  }

  /** Modele metin gönderir (ör. sistem bildirimi: oturum başladı, sipariş tamamlandı). */
  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ realtimeInput: { text } }));
  }

  sendAudio(chunk: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const base64 = btoa(String.fromCharCode(...new Uint8Array(chunk)));
    this.ws.send(
      JSON.stringify({
        realtimeInput: { audio: { data: base64, mimeType: "audio/pcm;rate=16000" } },
      })
    );
  }

  interrupt(): void {
    // Gemini Live'ın kendi VAD'ı mikrofon sesini algılayıp modeli otomatik
    // keser (bkz. handleServerContent -> interruptedHandler). Client
    // tarafında yapılması gereken tek şey ses göndermeye devam etmek —
    // protokolde ayrıca bir "dur" mesajı YOK. Buradaki çağrı, hook'un
    // yerel ses kuyruğunu (henüz çalınmamış parçaları) proaktif olarak
    // hemen temizlemesi için de aynı sinyali tetikler (kullanıcı deneyimi
    // olarak sunucu onayını beklemeden anında sessizliğe geçilsin diye).
    this.interruptedHandler?.();
  }

  onTranscript(handler: (event: TranscriptEvent) => void): void {
    this.transcriptHandler = handler;
  }

  onAudio(handler: (chunk: ArrayBuffer) => void): void {
    this.audioHandler = handler;
  }

  onError(handler: (message: string) => void): void {
    this.errorHandler = handler;
  }

  onTurnComplete(handler: () => void): void {
    this.turnCompleteHandler = handler;
  }

  onInterrupted(handler: () => void): void {
    this.interruptedHandler = handler;
  }

  async disconnect(): Promise<void> {
    this.kapatildi = true;
    this.ws?.close();
    this.ws = null;
    this.setupDone = false;
  }
}
