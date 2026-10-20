"use client";
// Sesli asistan teşhis kaydı (voice_events). Konuşma metni YAZILMAZ; yalnızca olay türü ve kısa ayrıntı.
import { createClient } from "@/lib/supabase/client";

export type VoiceEventKind =
  | "kopma"
  | "yeniden_baglandi"
  | "yeniden_baglanamadi"
  | "goaway"
  | "sure_doldu"
  | "sessizlik"
  | "hata"
  | "kapat_reddedildi"
  | "bitti"
  | "kesinti";

export function voiceLog(mode: "musteri" | "admin", kind: VoiceEventKind, detail: string, startedAt: number) {
  try {
    const seconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    void createClient()
      .rpc("voice_log_event", { p_mode: mode, p_kind: kind, p_detail: detail.slice(0, 300), p_seconds: seconds })
      .then(
        () => {},
        () => {},
      );
  } catch {
    /* teşhis kaydı asla asistanı bozmasın */
  }
}
