// Web Push herkese açık (VAPID) anahtarı — gizli değildir; özel anahtar veritabanında (yalnızca sunucu).
export const VAPID_PUBLIC_KEY = "BItXKX5Gq2wGUb0xaU7vQSbYEgGnRuYf_3q0E22sbjztxiiKy5ZxfxQ6qdPaQtp5LTe2IuZWC3YOQ6FFcP6ROa0";

export type PushPayload = { title: string; body: string; url: string; tag?: string };
