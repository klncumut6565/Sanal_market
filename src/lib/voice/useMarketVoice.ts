"use client";
// Sesli market asistanı oturum hook'u — TMGD Asistan'daki useRealtimeVoice.ts'nin
// sadeleştirilmiş market sürümü. Araçlar tarayıcıda çalışır: ürün araması Supabase'in
// herkese açık (RLS'li) okumasıyla, sepet işlemleri yerel sepet store'u ile yapılır.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StoreSettings } from "@/lib/types";
import { createMarketToolRunner, type CartProposal } from "./marketToolRunner";
import { GeminiLiveProvider } from "./providers/geminiLive";
import { startMicCapture, AudioPlaybackQueue, type MicCapture } from "./audioStream";
import { hataTurkce } from "./hatalar";
import { MARKET_TOOLS, MARKET_VOICE_INSTRUCTION } from "./marketTools";
import type { RealtimeSessionResponse, VoiceState } from "./types";

export type VoiceSettings = Pick<
  StoreSettings,
  "store_name" | "delivery_fee" | "free_delivery_threshold" | "min_order_amount" | "open_time" | "close_time" | "is_open"
>;

export type VoiceAction = { id: number; text: string; kind: "add" | "remove" | "info" };

const MAX_OTURUM_MS = 10 * 60_000; // tek oturum en fazla 10 dk
const SESSIZLIK_MS = 90_000; // 90 sn hiç konuşulmazsa kapat
const SES_ESIGI_RMS = 500;


export function useMarketVoice(settings: VoiceSettings) {
  const router = useRouter();
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [actions, setActions] = useState<VoiceAction[]>([]);

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
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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
        gate: {
          get: () => proposalRef.current,
          set: (p) => {
            proposalRef.current = p;
          },
          currentTurn: () => userTurn.current,
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
    await cleanup();
    set("idle");
  }, [cleanup, set]);

  const start = useCallback(async () => {
    await cleanup();
    setError(null);
    setUserText("");
    setAssistantText("");
    setActions([]);
    userBuf.current = "";
    asstBuf.current = "";
    proposalRef.current = null;
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
          if (userBuf.current) userBuf.current = "";
          asstBuf.current += e.text;
          setAssistantText(asstBuf.current);
        }
      });
      provider.onTurnComplete(() => {
        userBuf.current = "";
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
        go("tool_calling");
        try {
          return await runTool(name, args);
        } catch (e) {
          return { error: (e as Error).message };
        } finally {
          go("processing");
        }
      });

      await provider.connect(sess, null, MARKET_VOICE_INSTRUCTION);
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
  }, [cleanup, go, runTool, set]);

  useEffect(() => () => void cleanup(), [cleanup]);

  return { state, error, userText, assistantText, actions, start, stop };
}
