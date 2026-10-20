"use client";
// Yönetim paneli sesli asistanı oturumu — useMarketVoice'un salt-okunur, sepet/onay içermeyen sürümü.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdminToolRunner } from "./adminToolRunner";
import type { AdminVisual, ProductChange } from "./adminVisual";
import { ADMIN_TOOLS, ADMIN_VOICE_INSTRUCTION } from "./adminTools";
import { GeminiLiveProvider } from "./providers/geminiLive";
import { startMicCapture, AudioPlaybackQueue, type MicCapture, createNoiseGate, type GateStats } from "./audioStream";
import { hataTurkce } from "./hatalar";
import type { RealtimeSessionResponse, VoiceState } from "./types";
import { halusinasyonMu, yankiMi } from "./halusinasyon";
import { voiceLog } from "./voiceLog";

const MAX_OTURUM_MS = 20 * 60_000;
const SESSIZLIK_MS = 120_000;
const SES_ESIGI_RMS = 420; // gürültü kapısının taban eşiği (ortam gürültüsüne göre otomatik yükselir)

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
  const [visuals, setVisuals] = useState<AdminVisual[]>([]);
  const [change, setChange] = useState<ProductChange | null>(null);
  const runnerRef = useRef<ReturnType<typeof createAdminToolRunner> | null>(null);

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
  const startedAt = useRef(0);
  const gateStats = useRef<GateStats | null>(null);
  const speakStart = useRef(0);
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
    setVisuals([]);
    setChange(null);
    userBuf.current = "";
    asstBuf.current = "";
    lastUser.current = "";
    ending.current = null;
    startedAt.current = Date.now();
    set("connecting");

    const runTool = createAdminToolRunner({
      navigate: (p) => router.push(p),
      log: (text) => setActions((a) => [...a.slice(-4), { id: ++actionId.current, text }]),
      show: (v) => setVisuals(v),
      setChange,
      lastUserText: () => (userBuf.current || lastUser.current).trim(),
    });
    runnerRef.current = runTool;
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
        lastSpeech.current = Date.now();
        const sahte = halusinasyonMu(lastUser.current) || yankiMi(lastUser.current, asstBuf.current);
        if (ending.current) ending.current.turnDone = true;
        else if (!sahte && icerir(lastUser.current, KULLANICI_KAPAT) && icerir(asstBuf.current, ASIST_VEDA)) {
          // Yedek: araç çağrılmadan vedalaştıysa da kapat
          finishSession();
          const e2 = ending.current as { turnDone: boolean } | null;
          if (e2) e2.turnDone = true;
        }
        if (!playback.isPlaying()) go("listening");
      });
      provider.onInterrupted(() => {
        // Teşhis: asistan kaç ms konuşmuştu, kesildiği andaki ses seviyesi / eşik, şimdiye dek bastırılan kısa sesler
        const st = gateStats.current;
        const ms = speakStart.current ? Date.now() - speakStart.current : 0;
        voiceLog("admin", "kesinti", `asistan_ms=${ms} rms=${st?.lastRms ?? 0} esik=${st?.lastThr ?? 0} sozegirme=${st?.bargeIns ?? 0} bastirilan=${st?.suppressed ?? 0}`, startedAt.current);
        speakStart.current = 0;
        playback.clear();
        go("listening");
      });
      provider.onError((m) => {
        voiceLog("admin", "hata", m, startedAt.current);
        setError(hataTurkce(m));
        set("error");
        void cleanup();
      });
      provider.onClose((code, reason) => {
        voiceLog("admin", "kopma", `${code} ${reason}`.trim(), startedAt.current);
        if (stateRef.current !== "idle") {
          setError(`Bağlantı koptu (${code}${reason ? `: ${reason}` : ""}). Devam etmek için tekrar başlat.`);
          set("error");
          void cleanup();
        }
      });
      provider.enableAutoReconnect({
        max: 3,
        fetchSession: async () => {
          const r = await fetch("/api/voice/session?mod=admin", { method: "POST" });
          const j = (await r.json().catch(() => ({}))) as RealtimeSessionResponse & { error?: string };
          if (!r.ok || !j.token) throw new Error(j.error || `token ${r.status}`);
          return j;
        },
        onState: (st, info) => {
          if (st === "reconnecting") {
            playback.clear();
            set("reconnecting");
            if (info.code) voiceLog("admin", "kopma", `${info.code} ${info.reason ?? ""} → yeniden bağlanılıyor (${info.attempt})`.trim(), startedAt.current);
          } else if (st === "ok") {
            voiceLog("admin", "yeniden_baglandi", `${info.reason || info.code || ""} devam=${info.resumed ? "evet" : "hayır"}`, startedAt.current);
            set("listening");
            lastSpeech.current = Date.now();
            provider.sendText(
              info.resumed
                ? "[SİSTEM] Bağlantı yenilendi. Selam verme; kaldığın yerden devam et."
                : "[SİSTEM] Bağlantı bir an koptu ve yenilendi; önceki konuşmayı hatırlamıyorsun. Selam verme; 'Bağlantı bir an koptu, ne soruyordun?' de.",
            );
          } else {
            voiceLog("admin", "yeniden_baglanamadi", `${info.code ?? ""} ${info.error ?? ""}`.trim(), startedAt.current);
          }
        },
      });
      provider.onGoAway((ms) => {
        voiceLog("admin", "goaway", `${ms ?? "?"} ms`, startedAt.current);
        const until = Date.now() + Math.max(1000, (ms ?? 10_000) - 2000);
        const t = setInterval(() => {
          if (providerRef.current !== provider) return clearInterval(t);
          const busy = (playbackRef.current?.isPlaying() ?? false) || stateRef.current === "tool_calling" || stateRef.current === "user_speaking";
          if (!busy || Date.now() > until) {
            clearInterval(t);
            void provider.reconnectNow("goAway");
          }
        }, 300);
        timers.current.push(t);
      });
      provider.onToolCall(async (name, args) => {
        if (name === "end_session") {
          const said = (userBuf.current || lastUser.current).trim();
          if (!said || halusinasyonMu(said) || yankiMi(said, asstBuf.current) || !icerir(said, [...KULLANICI_KAPAT, ...ASIST_VEDA, "evet", "yok"])) {
            voiceLog("admin", "kapat_reddedildi", "", startedAt.current);
            return { ok: false, error: "Kullanıcı sohbeti bitirmek istemedi; KAPATMA, devam et." };
          }
          voiceLog("admin", "bitti", `sozegirme=${gateStats.current?.bargeIns ?? 0} bastirilan=${gateStats.current?.suppressed ?? 0}`, startedAt.current);
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

      // Asistan önce konuşsun: selamlama mikrofon açılmadan istenir
      let greeted = false;
      provider.onAudio((chunk) => {
        if (!playbackRef.current?.isPlaying()) speakStart.current = Date.now();
        greeted = true;
        playback.enqueue(chunk);
      });
      provider.sendText("[SİSTEM] Oturum başladı. Kısaca selam ver.");

      lastSpeech.current = Date.now();
      // Gürültü kapısı + hoparlör yankısı koruması (audioStream.createNoiseGate)
      const gate = createNoiseGate(SES_ESIGI_RMS);
      gateStats.current = gate.stats;
      micRef.current = await startMicCapture((pcm) => {
        const g = gate(pcm, playbackRef.current?.isPlaying() ?? false);
        if (g.voiced) lastSpeech.current = Date.now();
        for (const o of g.outs) providerRef.current?.sendAudio(o);
      });
      set("listening");
      // Yedek: 2,5 sn içinde asistan konuşmadıysa selamlamayı yeniden iste
      const greetRetry = setTimeout(() => {
        if (!greeted && !userBuf.current && providerRef.current === provider) provider.sendText("[SİSTEM] Şimdi kısaca selam ver, kullanıcıyı bekleme.");
      }, 2500);
      timers.current.push(greetRetry as unknown as ReturnType<typeof setInterval>);

      const started = Date.now();
      timers.current.push(
        setInterval(() => {
          const now = Date.now();
          if (stateRef.current === "reconnecting") return;
          if (now - started > MAX_OTURUM_MS || (now - lastSpeech.current > SESSIZLIK_MS && !playback.isPlaying())) {
            voiceLog("admin", now - started > MAX_OTURUM_MS ? "sure_doldu" : "sessizlik", "", startedAt.current);
            setError(now - started > MAX_OTURUM_MS ? "Oturum süresi doldu (20 dk). Devam etmek için tekrar başlat." : "Bir süredir ses gelmediği için asistanı kapattım.");
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

  /** Ekrandaki Onayla / Vazgeç butonları */
  const confirmChange = useCallback(async (id: string) => {
    const r = await runnerRef.current?.confirmPending(id);
    if (r) providerRef.current?.sendText(r.ok ? `[SİSTEM] Kullanıcı değişikliği ekrandan onayladı ve uygulandı (${r.message}). Yalnızca kısaca "Tamam, güncellendi" de.` : `[SİSTEM] Değişiklik uygulanamadı: ${r.message}. Bunu kısaca söyle.`);
  }, []);
  const cancelChange = useCallback((id: string) => {
    if (runnerRef.current?.cancelPending(id)) providerRef.current?.sendText("[SİSTEM] Kullanıcı değişiklikten ekrandan vazgeçti. Kısaca 'Tamam, vazgeçtim' de.");
  }, []);

  return { state, error, userText, assistantText, actions, visuals, change, confirmChange, cancelChange, start, stop };
}
