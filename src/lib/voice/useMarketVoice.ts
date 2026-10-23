"use client";
// Sesli market asistanı oturum hook'u — TMGD Asistan'daki useRealtimeVoice.ts'nin
// sadeleştirilmiş market sürümü. Araçlar tarayıcıda çalışır: ürün araması Supabase'in
// herkese açık (RLS'li) okumasıyla, sepet işlemleri yerel sepet store'u ile yapılır.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StoreSettings } from "@/lib/types";
import { createMarketToolRunner, closedNote, loadCustomerContext, type CartProposal, type ShownProduct } from "./marketToolRunner";
import { GeminiLiveProvider } from "./providers/geminiLive";
import { startMicCapture, AudioPlaybackQueue, type MicCapture, createNoiseGate, resetAudioSession, type GateStats } from "./audioStream";
import { hataTurkce } from "./hatalar";
import { MARKET_TOOLS, MARKET_VOICE_INSTRUCTION } from "./marketTools";
import type { RealtimeSessionResponse, VoiceState } from "./types";
import { halusinasyonMu, yankiMi } from "./halusinasyon";
import { voiceLog } from "./voiceLog";

export type VoiceSettings = Pick<
  StoreSettings,
  "store_name" | "delivery_fee" | "free_delivery_threshold" | "min_order_amount" | "open_time" | "close_time" | "is_open" | "force_open"
>;

export type VoiceAction = { id: number; text: string; kind: "add" | "remove" | "info" };

const MAX_OTURUM_MS = 20 * 60_000; // tek oturum en fazla 20 dk
const SESSIZLIK_MS = 150_000; // 2,5 dk hiç konuşma/dokunma olmazsa kapat (ürün kartlarına bakarken kapanmasın)
const SES_ESIGI_RMS = 420; // gürültü kapısının taban eşiği (ortam gürültüsüne göre otomatik yükselir)
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
/** Yedek kapatma için yalnızca AÇIK bitirme sözleri ("teşekkürler" tek başına sohbeti bitirmez) */
const MUSTERI_KAPAT = [...ASIST_VEDA, "kapat", "kapatabilirsin", "bu kadar", "başka bir şey yok", "başka yok"];
/** end_session'ı kabul etmek için müşterinin son cümlesinde aranan sözler */
const KAPAT_IZIN = [...MUSTERI_VEDA, "yok", "gerek yok", "yeter", "evet"];
/** Pencereyi gizleme sözleri — sohbet BİTMEZ, yalnızca pencere gizlenir (orta altta küre kalır) */
const GIZLE = ["gizle", "küçült", "pencereyi kapat", "ekranı kapat", "paneli kapat", "aşağı al", "pencereyi indir"];


export function useMarketVoice(settings: VoiceSettings, onEnded?: () => void, onHide?: () => void) {
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
  /** Görselleştirme: kapıdan geçen müşteri ses seviyesi (0..1); state değil, her karede okunur. */
  const userLevelRef = useRef(0);
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
  const startedAt = useRef(0);
  const gateStats = useRef<GateStats | null>(null);
  const speakStart = useRef(0);
  const orderDone = useRef(false);
  /** Kapanış başladı: mikrofon kapalı, son konuşma bitince oturum kapanır */
  const ending = useRef<{ since: number; turnDone: boolean } | null>(null);
  const settingsRef = useRef(settings);
  const onEndedRef = useRef(onEnded);
  const onHideRef = useRef(onHide);
  useEffect(() => {
    settingsRef.current = settings;
    onEndedRef.current = onEnded;
    onHideRef.current = onHide;
  }, [settings, onEnded, onHide]);

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
    resetAudioSession(); // iPhone: görüşme modundan çık → sonraki sesler kısık çalmasın
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
    // Mikrofon veda sesi bitene kadar AÇIK kalır ama Gemini'ye ses gönderilmez (veda döngüsü olmasın).
    // Konuşma ortasında mikrofonu kapatmak iPhone'da ses yolunu değiştirip vedayı kısık / ahize hoparlöründen çalıyordu.
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
    orderDone.current = false;
    startedAt.current = Date.now();
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
        lastSpeech.current = Date.now(); // sessizlik süresi asistanın sustuğu andan sayılır
        const sahteUser = halusinasyonMu(lastUser.current) || yankiMi(lastUser.current, asst);
        const gizle = !sahteUser && icerir(lastUser.current, GIZLE);
        if (gizle) onHideRef.current?.(); // "sohbeti gizle" → yalnızca pencere gizlenir, sohbet sürer
        if (ending.current) {
          ending.current.turnDone = true;
        } else if (!gizle && asst && !sahteUser && icerir(asst, ASIST_VEDA) && icerir(lastUser.current, MUSTERI_KAPAT)) {
          // Yedek: araç çağrılmadan vedalaştıysa da kapat (karşılıklı "görüşürüz" döngüsünü keser)
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
        voiceLog("musteri", "kesinti", `asistan_ms=${ms} rms=${st?.lastRms ?? 0} esik=${st?.lastThr ?? 0} sozegirme=${st?.bargeIns ?? 0} bastirilan=${st?.suppressed ?? 0} perdesiz=${st?.unvoiced ?? 0}`, startedAt.current);
        speakStart.current = 0;
        playback.clear();
        go("listening");
      });
      provider.onError((m) => {
        voiceLog("musteri", "hata", m, startedAt.current);
        setError(hataTurkce(m));
        set("error");
        void cleanup();
      });
      provider.onClose((code, reason) => {
        voiceLog("musteri", "kopma", `${code} ${reason}`.trim(), startedAt.current);
        if (stateRef.current !== "idle") {
          setError(`Bağlantı koptu (${code}${reason ? `: ${reason}` : ""}). Devam etmek için tekrar başlat.`);
          set("error");
          void cleanup();
        }
      });
      // Kopma / sunucunun "kapanacağım" (goAway) uyarısı → yeni token + oturum devam tutamacıyla otomatik yeniden bağlan
      provider.enableAutoReconnect({
        max: 3,
        fetchSession: async () => {
          const r = await fetch("/api/voice/session", { method: "POST" });
          const j = (await r.json().catch(() => ({}))) as RealtimeSessionResponse & { error?: string };
          if (!r.ok || !j.token) throw new Error(j.error || `token ${r.status}`);
          return j;
        },
        onState: (st, info) => {
          if (st === "reconnecting") {
            playback.clear();
            set("reconnecting");
            if (info.code) voiceLog("musteri", "kopma", `${info.code} ${info.reason ?? ""} → yeniden bağlanılıyor (${info.attempt})`.trim(), startedAt.current);
          } else if (st === "ok") {
            voiceLog("musteri", "yeniden_baglandi", `${info.reason || info.code || ""} devam=${info.resumed ? "evet" : "hayır"}`, startedAt.current);
            set("listening");
            lastSpeech.current = Date.now();
            provider.sendText(
              info.resumed
                ? "[SİSTEM] Bağlantı yenilendi. Selam verme; kaldığın yerden devam et (cevabın yarım kaldıysa kısaca tamamla)."
                : "[SİSTEM] Bağlantı bir an koptu ve yenilendi; önceki konuşmayı hatırlamıyorsun. Selam verme; 'Bağlantı bir an koptu, nerede kalmıştık?' de. Sepet olduğu gibi duruyor.",
            );
          } else {
            voiceLog("musteri", "yeniden_baglanamadi", `${info.code ?? ""} ${info.error ?? ""}`.trim(), startedAt.current);
          }
        },
      });
      provider.onGoAway((ms) => {
        voiceLog("musteri", "goaway", `${ms ?? "?"} ms`, startedAt.current);
        // Asistan susunca (ya da en geç süre dolmadan) bağlantıyı tazele
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
        if (name === "hide_window") {
          onHideRef.current?.();
          return { ok: true, note: "Pencere gizlendi, sohbet devam ediyor. Vedalaşma; Türkçe kısa onay ver ve dinlemeye devam et." };
        }
        if (name === "end_session") {
          // "Sohbeti gizle" kapatma değildir: pencereyi gizle, sohbet sürsün
          const said0 = (userBuf.current || lastUser.current).trim();
          if (!orderDone.current && icerir(said0, GIZLE)) {
            onHideRef.current?.();
            return { ok: false, error: "Müşteri sohbeti BİTİRMEDİ, yalnızca pencereyi gizlemek istedi; pencere gizlendi. KAPATMA, veda etme; Türkçe 'Tamam, dinliyorum.' de." };
          }
          // Yanlış kapanmaya karşı: müşteri gerçekten bitirmek istediyse (ya da sipariş tamamlandıysa) kapat.
          // Gürültüden uydurulan "izlediğiniz için teşekkürler" veya asistanın kendi yankısı kapatma sebebi sayılmaz.
          const said = (userBuf.current || lastUser.current).trim();
          const sahte = !said || halusinasyonMu(said) || yankiMi(said, lastAsst.current);
          if (!orderDone.current && (sahte || !icerir(said, KAPAT_IZIN))) {
            voiceLog("musteri", "kapat_reddedildi", sahte ? "gürültü/yankı" : "kapatma sözü yok", startedAt.current);
            return { ok: false, error: "Müşteri sohbeti bitirmek istemedi; KAPATMA. Veda etme, sohbete devam et; anlamadıysan 'tekrar eder misin?' de." };
          }
          voiceLog("musteri", "bitti", `${orderDone.current ? "sipariş" : "müşteri kapattı"} sozegirme=${gateStats.current?.bargeIns ?? 0} bastirilan=${gateStats.current?.suppressed ?? 0} perdesiz=${gateStats.current?.unvoiced ?? 0}`, startedAt.current);
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

      // Asistan önce konuşsun: selamlama mikrofon açılmadan, bağlantı kurulur kurulmaz istenir
      // (mikrofondaki ilk gürültü modelin "müşteri konuşuyor" diye beklemesine yol açmasın).
      let greeted = false;
      const markGreeted = () => {
        greeted = true;
      };
      provider.onAudio((chunk) => {
        if (!playbackRef.current?.isPlaying()) speakStart.current = Date.now();
        markGreeted();
        playback.enqueue(chunk);
      });
      provider.sendText("[SİSTEM] Oturum başladı. Müşteriyi TÜRKÇE selamla.");
      lastSpeech.current = Date.now();
      // Gürültü kapısı + hoparlör yankısı koruması (audioStream.createNoiseGate)
      const gate = createNoiseGate(SES_ESIGI_RMS);
      gateStats.current = gate.stats;
      micRef.current = await startMicCapture((pcm) => {
        if (ending.current) return; // vedalaşma: artık dinleme yok
        const g = gate(pcm, playbackRef.current?.isPlaying() ?? false);
        userLevelRef.current = g.voiced ? Math.min(1, g.rms / 6000) : 0;
        if (g.voiced) lastSpeech.current = Date.now();
        for (const o of g.outs) providerRef.current?.sendAudio(o);
      });
      set("listening");
      // Yedek: 2,5 sn içinde asistan konuşmadıysa ve müşteri de konuşmadıysa selamlamayı yeniden iste
      const greetRetry = setTimeout(() => {
        if (!greeted && !userBuf.current && providerRef.current === provider) provider.sendText("[SİSTEM] Şimdi Türkçe selamlamayı yap, müşteriyi bekleme.");
      }, 2500);
      timers.current.push(greetRetry as unknown as ReturnType<typeof setInterval>);

      const started = Date.now();
      timers.current.push(
        setInterval(() => {
          const now = Date.now();
          if (stateRef.current === "reconnecting") return;
          if (now - started > MAX_OTURUM_MS || (now - lastSpeech.current > SESSIZLIK_MS && !playback.isPlaying())) {
            const sure = now - started > MAX_OTURUM_MS;
            voiceLog("musteri", sure ? "sure_doldu" : "sessizlik", "", startedAt.current);
            setError(sure ? "Oturum süresi doldu (20 dk). Devam etmek için tekrar başlat." : "Bir süredir ses gelmediği için asistanı kapattım. Devam etmek için tekrar başlat.");
            set("error");
            void cleanup();
          }
        }, 2000),
      );
    } catch (e) {
      providerRef.current = providerRef.current ?? provider;
      playbackRef.current = playbackRef.current ?? playback;
      await cleanup();
      voiceLog("musteri", "hata", `başlangıç: ${e instanceof Error ? e.message : String(e)}`, startedAt.current);
      setError(hataTurkce(e));
      set("error");
    }
  }, [cleanup, go, runTool, set, finishSession]);

  /** Panelde dokunma/kaydırma da etkinlik sayılır (ürün kartlarına bakarken sessizlikten kapanmasın) */
  const touch = useCallback(() => {
    lastSpeech.current = Date.now();
  }, []);

  useEffect(() => () => void cleanup(), [cleanup]);

  // Sipariş tamamlandı → açık oturumda teşekkür
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ orderNo?: number; total?: number }>).detail ?? {};
      providerRef.current?.sendText(
        `[SİSTEM] Sipariş tamamlandı. Sipariş no: ${d.orderNo ?? "-"}${d.total != null ? `, toplam ${d.total.toFixed(2)} TL` : ""}. Tek cümleyle teşekkür et ve end_session çağır.`,
      );
      // Teşekkürden sonra oturum her durumda kapanır (mikrofon hemen kapanır)
      orderDone.current = true;
      finishSession();
    };
    window.addEventListener(ORDER_DONE_EVENT, h);
    return () => window.removeEventListener(ORDER_DONE_EVENT, h);
  }, [finishSession]);

  const getAssistantAnalyser = useCallback(() => playbackRef.current?.getAnalyser() ?? null, []);
  const getUserLevel = useCallback(() => userLevelRef.current, []);

  return { state, error, userText, assistantText, actions, shown, start, stop, touch, getAssistantAnalyser, getUserLevel };
}
