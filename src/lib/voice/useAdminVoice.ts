"use client";
// Yönetim paneli sesli asistanı oturumu — useMarketVoice'un salt-okunur, sepet/onay içermeyen sürümü.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdminToolRunner } from "./adminToolRunner";
import { ADMIN_TOOLS, ADMIN_VOICE_INSTRUCTION } from "./adminTools";
import { GeminiLiveProvider } from "./providers/geminiLive";
import { startMicCapture, AudioPlaybackQueue, type MicCapture } from "./audioStream";
import { hataTurkce } from "./hatalar";
import type { RealtimeSessionResponse, VoiceState } from "./types";

const MAX_OTURUM_MS = 10 * 60_000;
const SESSIZLIK_MS = 120_000;
const SES_ESIGI_RMS = 500;

const trN = (t: string) => t.toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, " ").trim();
const icerir = (t: string, list: string[]) => {
  const n = ` ${trN(t)} `;
  return list.some((k) => n.includes(` ${k}`));
};
const ASIST_VEDA = ["görüşürüz", "hoşça kal", "hoşçakal", "güle güle", "iyi günler", "iyi akşamlar", "iyi çalışmalar", "kapatıyorum"];
const KULLANICI_KAPAT = ["kapat", "kapatabilirsin", "bu kadar", "yeter", "görüşürüz", "hoşça kal", "hoşçakal", "teşekkürler", "sağ ol", "sağol"];

export function useAdminVoice(onEnded?: () => void) {
  const router = useRouter();
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [actions, setActions] = useState<{ id: number; text: string }[]>([]);

  const providerRef = useRef<GeminiLiveProvider | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const playbackRef = useRef<AudioPlaybackQueue | null>(null);
  const stateRef = useRef<VoiceState>("idle");
  const userBuf = useRef("");
  const asstBuf = useRef("");
  const lastSpeech = useRef(0);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const actionId = useRef(0);

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

  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  const lastUser = useRef("");
  /** Kapanış: mikrofon hemen kapanır, son konuşma bitince oturum kapanır */
  const ending = useRef<{ since: number; turnDone: boolean } | null>(null);

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
      if ((e.turnDone && !playing && waited > 800) || waited > 10_000) {
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
    userBuf.current = "";
    asstBuf.current = "";
    lastUser.current = "";
    ending.current = null;
    set("connecting");

    const runTool = createAdminToolRunner({
      navigate: (p) => router.push(p),
      log: (text) => setActions((a) => [...a.slice(-4), { id: ++actionId.current, text }]),
    });
    const provider = new GeminiLiveProvider(ADMIN_TOOLS, ADMIN_VOICE_INSTRUCTION);
    const playback = new AudioPlaybackQueue();
    try {
      const res = await fetch("/api/voice/session?mod=admin", { method: "POST" });
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
            asstBuf.current = "";
            setAssistantText("");
          }
          userBuf.current += e.text;
          setUserText(userBuf.current);
          go("user_speaking");
        } else {
          if (userBuf.current) {
            lastUser.current = userBuf.current;
            userBuf.current = "";
          }
          asstBuf.current += e.text;
          setAssistantText(asstBuf.current);
        }
      });
      provider.onTurnComplete(() => {
        if (userBuf.current) lastUser.current = userBuf.current;
        userBuf.current = "";
        if (ending.current) ending.current.turnDone = true;
        else if (icerir(lastUser.current, KULLANICI_KAPAT) && icerir(asstBuf.current, ASIST_VEDA)) {
          // Yedek: araç çağrılmadan vedalaştıysa da kapat
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
          return { ok: true, closing: true, note: "Oturum kapanıyor; veda ettiysen başka bir şey söyleme." };
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

      const bugun = new Intl.DateTimeFormat("tr-TR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date());
      await provider.connect(sess, null, `${ADMIN_VOICE_INSTRUCTION}\n\nŞU AN: ${bugun} (İstanbul).`);
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
      provider.sendText("[SİSTEM] Oturum başladı. Kısaca selam ver.");

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
  }, [cleanup, go, router, set, finishSession]);

  useEffect(() => () => void cleanup(), [cleanup]);

  return { state, error, userText, assistantText, actions, start, stop };
}
