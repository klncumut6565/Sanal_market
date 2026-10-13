"use client";
// Telefona uygulama bildirimi kurulumu (yönetici paneli veya kurye sayfası).
// iPhone: önce Safari → Paylaş → "Ana Ekrana Ekle", sonra ana ekrandaki simgeden açıp "Bildirimleri aç".
import { useEffect, useState, useSyncExternalStore } from "react";
import { BellRing, CheckCircle2, Loader2, Share, Smartphone } from "lucide-react";
import { VAPID_PUBLIC_KEY } from "@/lib/push/config";

type SubJSON = { endpoint: string; keys: { p256dh: string; auth: string } };

function b64ToU8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const noop = () => () => {};
function useEnv() {
  return useSyncExternalStore(
    noop,
    () => {
      const ua = navigator.userAgent;
      const ios = /iPhone|iPad|iPod/.test(ua);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      return `${ios ? 1 : 0}${standalone ? 1 : 0}${supported ? 1 : 0}`;
    },
    () => "000",
  );
}

export function PushSetup({
  title,
  onSubscribe,
  onTest,
}: {
  title: string;
  onSubscribe: (sub: SubJSON, device: string) => Promise<{ error?: string } | void>;
  onTest?: () => Promise<{ ok?: string; error?: string }>;
}) {
  const env = useEnv();
  const [ios, standalone, supported] = [env[0] === "1", env[1] === "1", env[2] === "1"];
  const [state, setState] = useState<"checking" | "off" | "on" | "denied">("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!alive) return;
        if (Notification.permission === "denied") setState("denied");
        else setState(sub ? "on" : "off");
        // Abonelik varsa sunucuya yeniden bildir (anahtar yenilenmiş olabilir)
        if (sub) void onSubscribe(JSON.parse(JSON.stringify(sub)) as SubJSON, navigator.userAgent);
      })
      .catch(() => alive && setState("off"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC_KEY) }));
      const r = await onSubscribe(JSON.parse(JSON.stringify(sub)) as SubJSON, navigator.userAgent);
      if (r && r.error) setMsg(r.error);
      else setState("on");
    } catch (e) {
      setMsg("Bildirim açılamadı: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!onTest) return;
    setBusy(true);
    const r = await onTest();
    setMsg(r.ok ?? r.error ?? null);
    setBusy(false);
  }

  const box = "space-y-2 rounded-2xl bg-white p-3 ring-1 ring-line";
  const head = (
    <p className="flex items-center gap-2 text-sm font-bold">
      <BellRing size={18} className="text-brand" /> {title}
    </p>
  );

  if (ios && !standalone)
    return (
      <div className={box}>
        {head}
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Bu sayfayı iPhone&apos;da <b>Safari</b> ile aç.</li>
          <li>
            Alttaki <Share size={14} className="inline" /> <b>Paylaş</b> düğmesine dokun → <b>Ana Ekrana Ekle</b>.
          </li>
          <li>Ana ekrandaki <b>Sanal Market</b> simgesinden aç ve burada <b>Bildirimleri aç</b>&apos;a dokun.</li>
        </ol>
      </div>
    );
  if (!supported)
    return (
      <div className={box}>
        {head}
        <p className="text-sm text-muted">Bu tarayıcı bildirimleri desteklemiyor. Android&apos;de Chrome, iPhone&apos;da Safari (Ana Ekrana Ekle) kullan.</p>
      </div>
    );

  return (
    <div className={box}>
      {head}
      {state === "on" ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> Bu telefonda bildirimler açık. Uygulama kapalıyken de bildirim gelir.
        </p>
      ) : state === "denied" ? (
        <p className="text-sm font-semibold text-brand">
          Bildirim izni reddedilmiş. Telefon <b>Ayarlar → Bildirimler → Sanal Market</b>&apos;ten izin ver, sonra sayfayı yenile.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Smartphone size={16} /> Bu telefonda bildirim kapalı.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {state !== "on" && state !== "denied" && (
          <button type="button" onClick={enable} disabled={busy || state === "checking"} className="btn-primary py-2 text-sm">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />} Bildirimleri aç
          </button>
        )}
        {state === "on" && onTest && (
          <button type="button" onClick={test} disabled={busy} className="btn-ghost py-2 text-sm">
            {busy && <Loader2 size={16} className="animate-spin" />} Test bildirimi gönder
          </button>
        )}
      </div>
      {msg && <p className="text-sm font-semibold">{msg}</p>}
    </div>
  );
}
