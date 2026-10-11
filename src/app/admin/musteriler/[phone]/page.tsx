import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, MessageCircle, Phone } from "lucide-react";
import { addToBlacklist, removeFromBlacklist } from "../../actions";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import { requireAdmin } from "@/lib/data/auth";
import { OrderTable } from "@/components/admin/OrderTable";
import { displayPhone, normalizeTrMobile } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";
import { formatDate, formatTL } from "@/lib/format";
import type { Order } from "@/lib/types";

export const metadata = { title: "Müşteri" };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ phone: string }>; searchParams: Promise<{ kara?: string }> }) {
  const raw = decodeURIComponent((await params).phone);
  const { kara } = await searchParams;
  const { supabase } = await requireAdmin();
  const phones = Array.from(new Set([raw, normalizeTrMobile(raw)].filter(Boolean))) as string[];

  const [{ data: orders }, { data: profile }, { data: banned }] = await Promise.all([
    supabase.from("orders").select("*").in("phone", phones).order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("full_name, created_at").in("phone", phones).maybeSingle(),
    supabase.from("customer_blacklist").select("reason, created_at").in("phone", phones).maybeSingle(),
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
            {banned && <p className="ml-1 mt-1 inline-block rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">⛔ Kara listede</p>}
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

      <section className={`space-y-3 rounded-2xl p-4 ring-1 ${banned ? "bg-red-50 ring-red-200" : "bg-white ring-line"}`}>
        <h2 className="flex items-center gap-2 font-extrabold">
          <Ban size={18} className="text-red-600" /> Kara liste
        </h2>
        {kara === "eklendi" && <p className="text-sm font-semibold text-red-700">Müşteri kara listeye eklendi.</p>}
        {kara === "cikarildi" && <p className="text-sm font-semibold text-emerald-700">Müşteri kara listeden çıkarıldı.</p>}
        {banned ? (
          <>
            <p className="text-sm">
              Bu müşteri <b>{formatDate(banned.created_at)}</b> tarihinde kara listeye alındı; bu telefonla (ve üyeliğiyle) <b>sipariş veremez</b>.
              {banned.reason && (
                <>
                  <br />
                  <span className="text-muted">Neden:</span> {banned.reason}
                </>
              )}
            </p>
            <form action={removeFromBlacklist}>
              <input type="hidden" name="phone" value={raw} />
              <ConfirmSubmit message="Müşteri kara listeden çıkarılsın mı? Tekrar sipariş verebilecek." className="btn-ghost py-2 text-sm">
                Kara listeden çıkar
              </ConfirmSubmit>
            </form>
          </>
        ) : (
          <form action={addToBlacklist} className="space-y-2">
            <input type="hidden" name="phone" value={raw} />
            <p className="text-sm text-muted">
              Kara listedeki müşteri sipariş veremez; ödeme ekranında yalnızca &quot;Siparişin şu an alınamıyor, bizimle iletişime geç&quot; mesajını görür (kara listede
              olduğu söylenmez). Mevcut siparişleri etkilenmez.
            </p>
            <input name="reason" maxLength={300} placeholder="Neden (ör. 3 kez kapıda teslim almadı, kuryeye saygısızlık)" className="input" />
            <ConfirmSubmit message={`${name} kara listeye alınsın mı? Bu telefonla sipariş veremeyecek.`} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white">
              Kara listeye ekle
            </ConfirmSubmit>
          </form>
        )}
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
