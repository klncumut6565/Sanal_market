"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Loader2, Mic, MicOff, X } from "lucide-react";
import { useMarketVoice, type VoiceSettings } from "@/lib/voice/useMarketVoice";
import { useCart, useCartHydrated } from "@/store/cart";
import { VoiceProducts } from "./VoiceProducts";

const STATUS: Record<string, string> = {
  idle: "",
  connecting: "Bağlanıyor…",
  listening: "Dinliyorum…",
  user_speaking: "Dinliyorum…",
  processing: "Düşünüyorum…",
  tool_calling: "Markete bakıyorum…",
  speaking: "Konuşuyorum…",
  reconnecting: "Yeniden bağlanıyor…",
  error: "",
};

export const OPEN_EVENT = "sesli-asistan:ac";
const CONSENT_KEY = "sanal-market-ses-onay-v3"; // v3: üyelerde ad + sipariş geçmişi + kayıtlı tercihler
const hasConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
};

const EXAMPLES = ["Domatesten 2 kilo ekle", "Beyaz peynir hangi markalar var?", "200 liraya kahvaltılık sepet hazırla", "Sepetimde ne var?"];

export function VoiceAssistant({ settings }: { settings: VoiceSettings }) {
  const [open, setOpen] = useState(false);
  const [needConsent, setNeedConsent] = useState(false);
  // Asistan sohbeti kendisi bitirince (veda / sipariş tamamlandı) pencere kapanır
  const v = useMarketVoice(settings, () => setOpen(false));
  const vStart = v.start;
  const ready = useCartHydrated();
  const hasCart = useCart((s) => s.lines.length > 0);
  const active = v.state !== "idle" && v.state !== "error";
  const path = usePathname();
  // Sepet/ödeme sayfalarında alttaki sabit butonla çakışmasın
  const hideButton = path.startsWith("/odeme") || path.startsWith("/sepet") || path.startsWith("/kvkk");

  // Sayfadaki diğer "Sesli sipariş" butonları (ör. ana sayfa bandı) bu olayla asistanı açar.
  const openAssistant = useCallback(() => {
    setOpen(true);
    if (!hasConsent()) {
      setNeedConsent(true);
      return;
    }
    void vStart(); // dokunuş içinde başlat (mikrofon + ses izni için şart)
  }, [vStart]);
  useEffect(() => {
    const h = () => openAssistant();
    window.addEventListener(OPEN_EVENT, h);
    return () => window.removeEventListener(OPEN_EVENT, h);
  }, [openAssistant]);

  const close = () => {
    void v.stop();
    setOpen(false);
  };

  return (
    <>
      {!open && !hideButton && (
        <button
          onClick={openAssistant}
          aria-label="Sesli sipariş asistanı"
          className={`fixed right-4 z-30 flex items-center gap-2 rounded-full bg-ink py-3 pl-3 pr-4 text-sm font-bold text-white shadow-xl ring-4 ring-white transition hover:scale-105 lg:bottom-6 ${
            ready && hasCart ? "bottom-[calc(136px+env(safe-area-inset-bottom))]" : "bottom-[calc(72px+env(safe-area-inset-bottom))]"
          }`}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand">
            <Mic size={18} />
          </span>
          Sesli sipariş
        </button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:inset-x-auto sm:right-4 sm:w-96">
          <div className="space-y-3 rounded-3xl bg-ink p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="font-black">🎙️ Sesli alışveriş asistanı</p>
              <button onClick={close} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
                <X size={18} />
              </button>
            </div>

            {needConsent ? (
              <div className="space-y-3 text-sm">
                <p className="leading-relaxed opacity-90">
                  Sesli asistan, konuşmanı anlamak için sesini <b>Google</b>&apos;ın Gemini yapay zekâ hizmetine iletir; bu hizmetin sunucuları <b>yurt dışında</b>{" "}
                  olabilir. Ses kayıtların bizim sistemlerimizde saklanmaz. Üye girişi yaptıysan, sana adınla hitap etmesi ve önceki siparişlerine göre öneri
                  yapabilmesi için <b>adın, geçmiş siparişlerindeki ürünler ve asistana söylediğin kalıcı tercihlerin</b> (ör. &quot;sütü tam yağlı alırım&quot;) de asistana iletilir; tercihlerini Siparişlerim sayfasından silebilirsin.
                </p>
                <Link href="/kvkk#sesli-asistan" onClick={() => setOpen(false)} className="inline-block font-bold text-brand underline underline-offset-2">
                  KVKK Aydınlatma Metni → Sesli asistan
                </Link>
                <button
                  onClick={() => {
                    try {
                      localStorage.setItem(CONSENT_KEY, "1");
                    } catch {}
                    setNeedConsent(false);
                    void v.start();
                  }}
                  className="btn-primary w-full py-3"
                >
                  <Mic size={16} /> Okudum, açık rıza veriyorum — başlat
                </button>
                <button onClick={close} className="w-full rounded-xl bg-white/10 py-2.5 font-bold">
                  Vazgeç
                </button>
              </div>
            ) : (
            <>
            <div className="flex items-center gap-3">
              <div className="relative grid h-14 w-14 shrink-0 place-items-center">
                {active && (
                  <span
                    className={`absolute inset-0 rounded-full bg-brand/40 ${v.state === "user_speaking" || v.state === "speaking" ? "animate-ping" : ""}`}
                  />
                )}
                <span className={`relative grid h-14 w-14 place-items-center rounded-full ${active ? "bg-brand" : "bg-white/15"}`}>
                  {v.state === "connecting" || v.state === "tool_calling" || v.state === "processing" ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : active ? (
                    <Mic size={24} />
                  ) : (
                    <MicOff size={24} />
                  )}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand">{STATUS[v.state]}</p>
                {v.userText && <p className="truncate text-sm opacity-80">Sen: “{v.userText}”</p>}
                {v.state === "listening" && !v.userText && <p className="text-sm opacity-70">Konuşabilirsin, seni dinliyorum.</p>}
              </div>
            </div>

            {v.assistantText && <p className="rounded-2xl bg-white/10 p-3 text-sm leading-relaxed">{v.assistantText}</p>}

            {v.shown && <VoiceProducts title={v.shown.title} items={v.shown.items} />}

            {v.actions.length > 0 && (
              <ul className="space-y-1">
                {v.actions.map((a) => (
                  <li key={a.id} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${a.kind === "add" ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10"}`}>
                    {a.text}
                  </li>
                ))}
              </ul>
            )}

            {v.error && <p className="rounded-2xl bg-red-500/20 p-3 text-sm font-semibold text-red-100">{v.error}</p>}

            {(v.state === "listening" || v.state === "connecting") && !v.userText && !v.assistantText && (
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((e) => (
                  <span key={e} className="rounded-full bg-white/10 px-2.5 py-1 text-xs">
                    “{e}”
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {active ? (
                <button onClick={() => void v.stop()} className="flex-1 rounded-xl bg-white/15 py-2.5 text-sm font-bold">
                  Konuşmayı bitir
                </button>
              ) : (
                <button onClick={() => void v.start()} className="btn-primary flex-1 py-2.5 text-sm">
                  <Mic size={16} /> Tekrar başlat
                </button>
              )}
            </div>
            <p className="text-center text-[11px] opacity-60">
              Sesin yalnızca konuşma sırasında işlenir; uygulamamızda kaydedilmez.{" "}
              <Link href="/kvkk#sesli-asistan" className="underline">
                KVKK
              </Link>
            </p>
            </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
