import Link from "next/link";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/data/auth";
import { formatTL } from "@/lib/format";
import { currentBusinessDay } from "@/lib/hours";
import type { Order } from "@/lib/types";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OrderTable } from "@/components/admin/OrderTable";
import { RevenueReport } from "@/components/admin/RevenueReport";
import { OpenAdminVoiceButton } from "@/components/admin/AdminVoiceAssistant";
import { Clock3, Mic, ReceiptText, ShoppingBag, TriangleAlert, Wallet } from "lucide-react";

export const metadata = { title: "Genel bakış" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ bas?: string; bit?: string }> }) {
  const { bas, bit } = await searchParams;
  await connection();
  const { supabase } = await requireAdmin();

  const { data: hours } = await supabase.from("store_settings").select("open_time,close_time,is_open").eq("id", 1).single();
  const openT = hours?.open_time ?? "10:00";
  const closeT = hours?.close_time ?? "01:00";
  // İş günü: açılıştan (10:00) ertesi gün kapanışa (01:00) kadar; 01:00–10:00 arası bir önceki iş günü gösterilir
  const { window: win, state } = currentBusinessDay(openT, closeT, hours?.is_open ?? true);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso));

  const [today, open, lowStock, recent, waiting] = await Promise.all([
    supabase.from("orders").select("total,status").gte("created_at", win.start).lt("created_at", win.end),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["alindi", "hazirlaniyor", "yolda"]),
    supabase.from("products").select("id,name,stock,critical_stock").eq("is_active", true).order("stock").limit(50),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "alindi"),
  ]);
  const newCount = waiting.count ?? 0;

  const todays = (today.data ?? []).filter((o) => o.status !== "iptal");
  const revenue = todays.reduce((a, o) => a + Number(o.total), 0);
  const low = (lowStock.data ?? []).filter((p) => p.stock <= p.critical_stock);

  const hour = Number(new Intl.DateTimeFormat("tr-TR", { hour: "numeric", hour12: false, timeZone: "Europe/Istanbul" }).format(new Date()));
  const greet = hour < 6 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

  const stats = [
    { label: "Online sipariş", sub: "Bu iş günü", value: String(todays.length), icon: ShoppingBag, tone: "bg-brand-soft text-brand" },
    { label: "Online ciro", sub: "Bu iş günü", value: formatTL(revenue), icon: Wallet, tone: "bg-cyan-50 text-cyan-700" },
    {
      label: "Bekleyen sipariş",
      sub: newCount ? `${newCount} onay bekliyor` : "Hazırlanan + yolda",
      value: String(open.count ?? 0),
      icon: Clock3,
      tone: "bg-amber-50 text-amber-700",
      href: "/admin/siparisler?durum=acik",
      alarm: newCount > 0,
    },
    {
      label: "Kritik stok",
      sub: low.length ? "Ürün azaldı" : "Her şey yolunda",
      value: String(low.length),
      icon: TriangleAlert,
      tone: low.length ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700",
      href: "/admin/urunler?stok=kritik",
    },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={180} realtime={["orders"]} />

      {/* Karşılama bandı — müşteri ekranındaki hero ile aynı dil */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-[#0f4a55] to-brand p-5 text-white shadow-xl shadow-navy/15 sm:p-6">
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/70">{greet} 👋</p>
            <h1 data-hero className="mt-0.5 text-2xl font-black sm:text-3xl">Genel bakış</h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/80">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${state.open ? "bg-emerald-400/20 text-emerald-100" : "bg-white/15 text-white/80"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${state.open ? "bg-emerald-300" : "bg-white/60"}`} />
                {state.open ? "Mağaza açık" : "Mağaza kapalı"}
              </span>
              <span>
                İş günü: <b className="text-white">{fmt(win.start)}</b> → <b className="text-white">{fmt(win.end)}</b>
              </span>
            </p>
          </div>
          <OpenAdminVoiceButton className="group flex items-center gap-2.5 rounded-full bg-white/10 p-1.5 pr-4 text-left ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20">
            <span className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-900/40">
              <span className="absolute inset-0 animate-ping rounded-full bg-fuchsia-400/30 motion-reduce:hidden" />
              <Mic size={18} className="relative" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-black">Sesli asistana sor</span>
              <span className="block text-xs text-white/70">“Geçen haftaya göre nasılız?”</span>
            </span>
          </OpenAdminVoiceButton>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          const alarm = "alarm" in s && s.alarm;
          const body = (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold">{s.label}</p>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${alarm ? "bg-white/25" : s.tone}`}>
                  <Icon size={18} />
                </span>
              </div>
              <p className="mt-1 text-2xl font-black tabular-nums sm:text-[28px]">{s.value}</p>
              <p className={`mt-0.5 text-xs font-semibold ${alarm ? "" : "text-muted"}`}>{s.sub}</p>
            </>
          );
          const base = "rounded-3xl p-4 shadow-sm shadow-navy/5 ring-1 transition";
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className={`${base} hover:-translate-y-0.5 hover:shadow-md ${alarm ? "bekleyen-yanip-son ring-transparent [&_p]:text-inherit!" : "bg-white ring-line hover:ring-brand/40"}`}
            >
              {body}
            </Link>
          ) : (
            <div key={s.label} className={`${base} bg-white ring-line`}>
              {body}
            </div>
          );
        })}
      </div>

      <RevenueReport supabase={supabase} openTime={openT} from={bas} to={bit} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-extrabold">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-brand">
                <ReceiptText size={16} />
              </span>
              Son siparişler
            </h2>
            <Link href="/admin/siparisler" className="text-sm font-bold text-brand hover:underline">
              Tümü →
            </Link>
          </div>
          <OrderTable orders={(recent.data ?? []) as Order[]} />
        </section>
        <section className="rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-extrabold">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600">
                <TriangleAlert size={16} />
              </span>
              Kritik stok
            </h2>
            {low.length > 0 && (
              <Link href="/admin/urunler?stok=kritik" className="text-sm font-bold text-brand hover:underline">
                Tümü →
              </Link>
            )}
          </div>
          {low.length === 0 ? (
            <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Kritik seviyede ürün yok. 👍</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {low.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/urunler/${p.id}`} className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition hover:bg-bg">
                    <span className="truncate font-semibold">{p.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${p.stock === 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700"}`}
                    >
                      {p.stock === 0 ? "Tükendi" : `${p.stock} adet`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
