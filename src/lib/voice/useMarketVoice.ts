"use client";
// Sesli market asistanı oturum hook'u — TMGD Asistan'daki useRealtimeVoice.ts'nin
// sadeleştirilmiş market sürümü. Araçlar tarayıcıda çalışır: ürün araması Supabase'in
// herkese açık (RLS'li) okumasıyla, sepet işlemleri yerel sepet store'u ile yapılır.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StoreSettings } from "@/lib/types";
import { createMarketToolRunner, closedNote, loadCustomerContext, type CartProposal, type ShownProduct } from "./marketToolRunner";
import { GeminiLiveProvider } from "./providers/geminiLive";
import { startMicCapture, AudioPlaybackQueue, type MicCapture } from "./audioStream";
import { hataTurkce } from "./hatalar";
import { MARKET_TOOLS, MARKET_VOICE_INSTRUCTION } from "./marketTools";
import type { RealtimeSessionResponse, VoiceState } from "./types";

export type VoiceSettings = Pick<
  StoreSettings,
  "store_name" | "delivery_fee" | "free_delivery_threshold" | "min_order_amount" | "open_time" | "close_time" | "is_open" | "force_open"
>;

export type VoiceAction = { id: number; text: string; kind: "add" | "remove" | "info" };

const MAX_OTURUM_MS = 10 * 60_000; // tek oturum en fazla 10 dk
const SESSIZLIK_MS = 90_000; // 90 sn hiç konuşulmazsa kapat
const SES_ESIGI_RMS = 500;
/** Ödeme ekranı sipariş tamamlanınca bu olayı yayar; açık sesli oturum teşekkür eder. */
export const ORDER_DONE_EVENT = "sesli-asistan:siparis-tamamlandi";

const trN = (t: string) => t.toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, " ").trim();
/** Asistanın veda cümlesi */
const ASIST_VEDA = ["görüşürüz", "hoşça kal", "hoşçakal", "güle güle", "iyi günler", "iyi akşamlar", "iyi geceler", "kendine iyi bak", "bay bay"];
/** Müşterinin bitirme/veda sözü */
const MUSTERI_VEDA = [...ASIST_VEDA, "kapat", "kapatabilirsin", "bu kadar", "başka bir şey yok", "başka yok", "teşekkürler", "teşekkür ederim", "sağ ol", "sağol"];
const icerir = (t: string, list: string[]) => {
  const n = ` ${trN(t)} `;
  return list.some((k) => n.includes(` ${k}`));
};


export function useMarketVoice(settings: VoiceSettings, onEnded?: () => void) {
  const router = useRouter();
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [actions, setActions] = useState<VoiceAction[]>([]);
  const [shown, setShown] = useState<{ title: string; items: ShownProduct[] } | null>(null);

  const providerRef = useRef<GeminiLiveProvider | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const playbackRef = useRef<AudioPlaybackQueue | null>(null);
  const stateRef = useRef<VoiceState>("idle");
  const userBuf = useRef("");
  const asstBuf = useRef("");
  const lastSpeech = useRef(0);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const actionId = useRef(0);
  const proposalRef = useRef<CartProposal | null>(null);
  const userTurn = useRef(0);
  const lastAsst = useRef("");
  const lastUser = useRef("");
  /** Kapanış başladı: mikrofon kapalı, son konuşma bitince oturum kapanır */
  const ending = useRef<{ since: number; turnDone: boolean } | null>(null);
  const settingsRef = useRef(settings);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    settingsRef.current = settings;
    onEndedRef.current = onEnded;
  }, [settings, onEnded]);

  const set = useCallback((s: VoiceState) => {
    stateRef.current = s;
    setState(s);
  }, []);
  const go = useCallback(
    (s: VoiceState) => {
      const cur = stateRef.current;
      if (cur === "idle" || cur === "error" || cur === "connecting") return;
      if (cur !== s) set(s);
    },
    [set],
  );
  const log = useCallback((text: string, kind: VoiceAction["kind"]) => {
    setActions((a) => [...a.slice(-5), { id: ++actionId.current, text, kind }]);
  }, []);

  // ------------------------------ Araçlar ------------------------------
  const runTool = useCallback(
    (name: string, args: Record<string, unknown>) =>
      createMarketToolRunner({
        getSettings: () => settingsRef.current,
        navigate: (p) => router.push(p),
        log,
        show: (title, items) => setShown(items.length ? { title, items } : null),
        gate: {
          get: () => proposalRef.current,
          set: (p) => {
            proposalRef.current = p;
          },
          currentTurn: () => userTurn.current,
          lastAssistant: () => lastAsst.current,
        },
      })(name, args),
    [router, log],
  );

  // ------------------------------ Oturum ------------------------------
  const cleanup = useCallback(async () => {
    timers.current.forEach(clearInterval);
    timers.current = [];
    micRef.current?.stop();
    micRef.current = null;
    playbackRef.current?.close();
    playbackRef.current = null;
    const p = providerRef.current;
    providerRef.current = null;
    try {
      await p?.disconnect();
    } catch {}
  }, []);

  const stop = useCallback(async () => {
    ending.current = null;
    await cleanup();
    set("idle");
  }, [cleanup, set]);

  /** Sohbeti asistan tarafında bitir: mikrofonu hemen kapat (veda döngüsü olmasın), veda sesi bitince kapat. */
  const finishSession = useCallback(() => {
    if (ending.current || !providerRef.current) return;
    ending.current = { since: Date.now(), turnDone: false };
    micRef.current?.stop();
    micRef.current = null;
    const t = setInterval(() => {
      const e = ending.current;
      if (!e) return clearInterval(t);
      const waited = Date.now() - e.since;
      const playing = playbackRef.current?.isPlaying() ?? false;
      if ((e.turnDone && !playing && waited > 800) || waited > 12_000) {
        clearInterval(t);
        ending.current = null;
        void cleanup().then(() => {
          set("idle");
          onEndedRef.current?.();
        });
      }
    }, 300);
    timers.current.push(t);
  }, [cleanup, set]);

  const start = useCallback(async () => {
    await cleanup();
    setError(null);
    setUserText("");
    setAssistantText("");
    setActions([]);
    setShown(null);
    userBuf.current = "";
    asstBuf.current = "";
    proposalRef.current = null;
    ending.current = null;
    lastUser.current = "";
    set("connecting");

    const provider = new GeminiLiveProvider(MARKET_TOOLS, MARKET_VOICE_INSTRUCTION);
    const playback = new AudioPlaybackQueue(); // kullanıcı dokunuşu içinde oluşur (iOS ses kilidi)
    try {
      const res = await fetch("/api/voice/session", { method: "POST" });
      const sess = (await res.json().catch(() => ({}))) as RealtimeSessionResponse & { error?: string };
      if (!res.ok || !sess.token) throw new Error(sess.error || "Sesli asistan başlatılamadı.");

      playback.onSpeaking((sp) => {
        if (sp) go("speaking");
        else if (stateRef.current === "speaking") go("listening");
      });
      provider.onTranscript((e) => {
        if (e.type !== "partial") return;
        if (e.speaker === "user") {
          if (!userBuf.current) {
            userTurn.current += 1;
            asstBuf.current = "";
            setAssistantText("");
          }
          userBuf.current += e.text;
          const pend = proposalRef.current;
          if (pend && userTurn.current > pend.turnSeq) pend.reply += e.text;
          setUserText(userBuf.current);
          go("user_speaking");
        } else {
          if (userBuf.current) {
            lastUser.current = userBuf.current;
            userBuf.current = "";
          }
          asstBuf.current += e.text;
          lastAsst.current = asstBuf.current;
          setAssistantText(asstBuf.current);
        }
      });
      provider.onTurnComplete(() => {
        if (userBuf.current) lastUser.current = userBuf.current;
        userBuf.current = "";
        const asst = asstBuf.current;
        if (ending.current) {
          ending.current.turnDone = true;
        } else if (asst && icerir(asst, ASIST_VEDA) && icerir(lastUser.current, MUSTERI_VEDA)) {
          // Yedek: araç çağrılmadan vedalaştıysa da kapat (karşılıklı "görüşürüz" döngüsünü keser)
          finishSession();
          const e2 = ending.current as { turnDone: boolean } | null;
          if (e2) e2.turnDone = true;
        }
        if (!playback.isPlaying()) go("listening");
      });
      provider.onAudio((chunk) => playback.enqueue(chunk));
      provider.onInterrupted(() => {
        playback.clear();
        go("listening");
      });
      provider.onError((m) => {
        setError(hataTurkce(m));
        set("error");
        void cleanup();
      });
      provider.onClose(() => {
        if (stateRef.current !== "idle") {
          setError("Bağlantı sona erdi. Devam etmek için tekrar başlat.");
          set("error");
          void cleanup();
        }
      });
      provider.onGoAway(() => {});
      provider.onToolCall(async (name, args) => {
        if (name === "end_session") {
          finishSession();
          return { ok: true, closing: true, note: "Oturum kapanıyor. Veda ettiysen başka bir şey söyleme." };
        }
        go("tool_calling");
        try {
          return await runTool(name, args);
        } catch (e) {
          return { error: (e as Error).message };
        } finally {
          go("processing");
        }
      });

      const musteri = await loadCustomerContext();
      const kapali = closedNote(settingsRef.current);
      const talimat =
        MARKET_VOICE_INSTRUCTION +
        (kapali
          ? `\n\nŞU ANKİ DURUM: ${kapali} Müşteriye ilk cevabında bunu kısaca bildir ve sepet hazırlamasına yardım edebileceğini söyle.`
          : "\n\nŞU ANKİ DURUM: Market açık, sipariş verilebilir.") +
        (musteri
          ? `\n\nMÜŞTERİ: Giriş yapmış kayıtlı müşteri.${musteri.firstName ? ` Adı: ${musteri.firstName}.` : " Adı bilinmiyor."} ${musteri.summary ?? ""}`
          : "\n\nMÜŞTERİ: Misafir (giriş yapmamış); adı ve geçmişi bilinmiyor. Geçmiş sipariş sorulursa üye girişi yapması gerektiğini söyle.");
      await provider.connect(sess, null, talimat);
      providerRef.current = provider;
      playbackRef.current = playback;

      lastSpeech.current = Date.now();
      micRef.current = await startMicCapture((pcm) => {
        const v = new Int16Array(pcm);
        let sum = 0;
        for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
        if (Math.sqrt(sum / v.length) > SES_ESIGI_RMS) lastSpeech.current = Date.now();
        providerRef.current?.sendAudio(pcm);
      });
      set("listening");
      // Asistan önce konuşsun: selamlama
      provider.sendText("[SİSTEM] Oturum başladı. Müşteriyi selamla.");

      const started = Date.now();
      timers.current.push(
        setInterval(() => {
          const now = Date.now();
          if (now - started > MAX_OTURUM_MS || (now - lastSpeech.current > SESSIZLIK_MS && !playback.isPlaying())) {
            setError(now - started > MAX_OTURUM_MS ? "Oturum süresi doldu (10 dk). Devam etmek için tekrar başlat." : "Bir süredir ses gelmediği için asistanı kapattım.");
            set("error");
            void cleanup();
          }
        }, 2000),
      );
    } catch (e) {
      providerRef.current = providerRef.current ?? provider;
      playbackRef.current = playbackRef.current ?? playback;
      await cleanup();
      setError(hataTurkce(e));
      set("error");
    }
  }, [cleanup, go, runTool, set, finishSession]);

  useEffect(() => () => void cleanup(), [cleanup]);

  // Sipariş tamamlandı → açık oturumda teşekkür
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ orderNo?: number; total?: number }>).detail ?? {};
      providerRef.current?.sendText(
        `[SİSTEM] Sipariş tamamlandı. Sipariş no: ${d.orderNo ?? "-"}${d.total != null ? `, toplam ${d.total.toFixed(2)} TL` : ""}. Tek cümleyle teşekkür et ve end_session çağır.`,
      );
      // Teşekkürden sonra oturum her durumda kapanır (mikrofon hemen kapanır)
      finishSession();
    };
    window.addEventListener(ORDER_DONE_EVENT, h);
    return () => window.removeEventListener(ORDER_DONE_EVENT, h);
  }, [finishSession]);

  return { state, error, userText, assistantText, actions, shown, start, stop };
}
