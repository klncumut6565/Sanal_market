import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { OrderTable } from "@/components/admin/OrderTable";
import { displayPhone, normalizeTrMobile } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";
import { formatDate, formatTL } from "@/lib/format";
import type { Order } from "@/lib/types";

export const metadata = { title: "Müşteri" };

export default async function CustomerPage({ params }: { params: Promise<{ phone: string }> }) {
  const raw = decodeURIComponent((await params).phone);
  const { supabase } = await requireAdmin();
  const phones = Array.from(new Set([raw, normalizeTrMobile(raw)].filter(Boolean))) as string[];

  const [{ data: orders }, { data: profile }] = await Promise.all([
    supabase.from("orders").select("*").in("phone", phones).order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("full_name, created_at").in("phone", phones).maybeSingle(),
  ]);
  const list = (orders ?? []) as Order[];
  if (list.length === 0 && !profile) notFound();

  const name = list[0]?.customer_name ?? profile?.full_name ?? "Müşteri";
  const active = list.filter((o) => o.status !== "iptal");
  const spent = active.reduce((a, o) => a + Number(o.total), 0);
  const avg = active.length ? spent / active.length : 0;
  const addresses = Array.from(new Set(list.map((o) => o.address)));
  const notes = list.filter((o) => o.note || o.address_note);

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/musteriler" className="text-sm font-semibold text-muted hover:text-brand">← Müşteriler</Link>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">{name}</h1>
            <p className="font-semibold text-muted">{displayPhone(raw)}</p>
            {profile && <p className="mt-1 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">Üye · {formatDate(profile.created_at)}</p>}
          </div>
          <div className="flex gap-2">
            <a href={waLink(raw, `Merhaba ${name.split(" ")[0]}, `)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white">
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a href={`tel:${raw}`} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ring-1 ring-line">
              <Phone size={16} /> Ara
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Sipariş", String(list.length)],
            ["Toplam harcama", formatTL(spent)],
            ["Ortalama sepet", formatTL(avg)],
            ["İptal", String(list.length - active.length)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-bg p-3">
              <p className="text-xs font-semibold text-muted">{k}</p>
              <p className="text-lg font-black">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {addresses.length > 0 && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="mb-2 font-extrabold">Teslimat adresleri</h2>
          <ul className="space-y-1 text-sm">
            {addresses.map((a) => (
              <li key={a}>📍 {a}</li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="mb-2 font-extrabold">Müşteri notları</h2>
          <ul className="space-y-1 text-sm">
            {notes.slice(0, 10).map((o) => (
              <li key={o.id}>
                <span className="text-muted">#{o.order_no}:</span> {[o.address_note, o.note].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 font-extrabold">Sipariş geçmişi</h2>
        <OrderTable orders={list} />
      </section>
    </div>
  );
}
