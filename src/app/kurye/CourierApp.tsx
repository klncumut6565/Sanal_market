"use client";
// Profesyonel kurye paneli: görevler + havuz, teslim alma/teslim etme (nakit/POS), sorun bildirme,
// geçmiş ve dönem özetleri, kasa (üzerimdeki nakit, hesaplaşmalar), mesai ve bildirim ayarları.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Banknote, Bike, ClipboardList, CreditCard, History, Inbox, LogOut, Phone, RefreshCw, User, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PushSetup } from "@/components/PushSetup";
import { OrderCard } from "@/components/courier/OrderCard";
import { DeliverSheet, IssueSheet } from "@/components/courier/Sheets";
import { ORDER_COLS, dayHm, hm, numHist, numOrder, payKind, since, tl, type CourierOrder, type HistoryRow, type Settlement } from "@/components/courier/types";
import { useCourierLocation } from "@/components/courier/useCourierLocation";
import { addDays, businessDateStart, reportRanges } from "@/lib/hours";
import { vehicleLabel } from "@/lib/courierShared";
import { displayPhone } from "@/lib/phone";
import { signOut } from "@/app/giris/actions";
import { claimOrder, deliverOrder, pickupOrder, releaseOrder, reportIssue, setDuty, subscribeCourierPush, type CourierResult } from "./actions";

export type CourierMe = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  vehicle: string;
  plate: string | null;
  per_delivery_fee: number;
  on_duty: boolean;
  email?: string | null;
};

type Tab = "gorev" | "gecmis" | "kasa" | "profil";
type Period = "bugun" | "dun" | "hafta" | "ay" | "gecen_ay";
const PERIODS: [Period, string][] = [
  ["bugun", "Bugün"],
  ["dun", "Dün"],
  ["hafta", "Bu hafta"],
  ["ay", "Bu ay"],
  ["gecen_ay", "Geçen ay"],
];

function periodRange(p: Period, open: string): { from: string; to: string } {
  const r = reportRanges(open);
  const s = (d: string) => businessDateStart(d, open);
  const end = s(addDays(r.today, 1));
  switch (p) {
    case "bugun":
      return { from: s(r.today), to: end };
    case "dun":
      return { from: s(r.yesterday), to: s(r.today) };
    case "hafta":
      return { from: s(r.weekStart), to: end };
    case "ay":
      return { from: s(r.monthStart), to: end };
    case "gecen_ay":
      return { from: s(r.prevMonthStart), to: s(r.monthStart) };
  }
}

/** Yeni görev sesi (kısa iki ton) + titreşim */
function alertNewTask() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.22].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* ses çalınamazsa önemli değil */
  }
}

function stats(list: HistoryRow[], fee: number) {
  // Parçalı ödemeler dahil: nakit ve POS kısımları ayrı toplanır
  const cash = list.reduce((a, o) => a + o.cash_amount, 0);
  const pos = list.reduce((a, o) => a + o.pos_amount, 0);
  const durs = list
    .map((o) => (o.delivered_at && (o.picked_up_at ?? o.dispatched_at) ? (Date.parse(o.delivered_at) - Date.parse((o.picked_up_at ?? o.dispatched_at)!)) / 60_000 : null))
    .filter((d): d is number => d != null && d >= 0 && d < 240);
  return {
    count: list.length,
    cash,
    pos,
    total: cash + pos,
    fee: list.length * fee,
    avgMin: durs.length ? Math.round(durs.reduce((a, d) => a + d, 0) / durs.length) : null,
  };
}

export function CourierApp({ me: initialMe, openTime, storePhone }: { me: CourierMe; openTime: string; storePhone: string | null }) {
  const [me, setMe] = useState(initialMe);
  const [tab, setTab] = useState<Tab>("gorev");
  const [period, setPeriod] = useState<Period>("bugun");
  const [live, setLive] = useState<CourierOrder[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [today, setToday] = useState<HistoryRow[]>([]);
  const [unsettled, setUnsettled] = useState<HistoryRow[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [deliverFor, setDeliverFor] = useState<CourierOrder | null>(null);
  const [issueFor, setIssueFor] = useState<CourierOrder | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const known = useRef<Set<string> | null>(null);
  const sb = useMemo(() => createClient(), []);
  const loc = useCourierLocation(me.on_duty);

  const say = (text: string, bad = false) => {
    setToast({ text, bad });
    setTimeout(() => setToast(null), bad ? 5000 : 2500);
  };

  const loadLive = useCallback(async () => {
    const { data, error } = await sb
      .from("orders")
      .select(`${ORDER_COLS},order_items(quantity,product_name,unit_label,removed)`)
      .in("status", ["hazirlaniyor", "yolda"])
      .order("created_at");
    if (error) return;
    const list = ((data ?? []) as CourierOrder[]).map(numOrder);
    // Bana yeni atanan sipariş geldiyse uyar
    const mineIds = list.filter((o) => o.courier_id === me.user_id).map((o) => o.id);
    if (known.current && mineIds.some((id) => !known.current!.has(id))) {
      alertNewTask();
      say("📦 Yeni görev atandı");
    }
    known.current = new Set(mineIds);
    setLive(list);
    setLoadedAt(Date.now());
  }, [sb, me.user_id]);

  const loadMoney = useCallback(async () => {
    const t = periodRange("bugun", openTime);
    const p = periodRange(period, openTime);
    // Teslim edilen siparişler kişisel veri olmadan gelir (müşteri adı/telefon/adres yok, yalnızca mahalle)
    const hist = (from: string, to: string, unsettledOnly = false) => sb.rpc("courier_history2", { p_from: from, p_to: to, p_unsettled: unsettledOnly });
    const [h, d, u, s] = await Promise.all([
      hist(p.from, p.to),
      hist(t.from, t.to),
      hist(t.from, t.to, true),
      sb.from("courier_settlements").select("id,created_at,order_count,cash_amount,pos_amount,fee_amount,note").eq("courier_id", me.user_id).order("created_at", { ascending: false }).limit(30),
    ]);
    setHistory(((h.data ?? []) as HistoryRow[]).map(numHist));
    setToday(((d.data ?? []) as HistoryRow[]).map(numHist));
    setUnsettled(((u.data ?? []) as HistoryRow[]).map(numHist));
    setSettlements(
      ((s.data ?? []) as Settlement[]).map((x) => ({ ...x, cash_amount: Number(x.cash_amount), pos_amount: Number(x.pos_amount), fee_amount: Number(x.fee_amount) })),
    );
  }, [sb, me.user_id, openTime, period]);

  const refresh = useCallback(() => Promise.all([loadLive(), loadMoney()]), [loadLive, loadMoney]);

  // CANLI: Supabase Realtime (anında) + 15 sn'de bir tam yenileme (yedek). Yönetici atama, hesaplaşma,
  // ücret/araç değişikliği ya da sipariş durumu değiştirince kurye ekranı kendiliğinden güncellenir.
  const [liveOn, setLiveOn] = useState(false);
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(() => document.visibilityState === "visible" && void refresh(), 60_000);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    const vis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", vis);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), 400);
    };
    const ch = sb
      .channel(`kurye-${me.user_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, soon)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "courier_settlements", filter: `courier_id=eq.${me.user_id}` }, (p) => {
        const n = p.new as { cash_amount?: number; pos_amount?: number; order_count?: number };
        say(`✅ Hesaplaşma yapıldı: ${n.order_count ?? ""} teslimat · ${tl(Number(n.cash_amount ?? 0))} nakit teslim alındı`);
        soon();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "couriers", filter: `user_id=eq.${me.user_id}` }, (p) => {
        const n = p.new as Partial<CourierMe>;
        setMe((m) => ({ ...m, full_name: n.full_name ?? m.full_name, phone: n.phone ?? m.phone, vehicle: n.vehicle ?? m.vehicle, plate: n.plate ?? m.plate, per_delivery_fee: n.per_delivery_fee != null ? Number(n.per_delivery_fee) : m.per_delivery_fee, on_duty: n.on_duty ?? m.on_duty }));
        soon();
      })
      .subscribe((st) => setLiveOn(st === "SUBSCRIBED"));
    return () => {
      clearTimeout(first);
      clearTimeout(debounce);
      clearInterval(t);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", vis);
      void sb.removeChannel(ch);
    };
  }, [refresh, sb, me.user_id]);

  async function act(key: string, fn: () => Promise<CourierResult>, okText: string) {
    setBusy(key);
    try {
      const r = await fn();
      if (r.ok) say(r.message ?? okText);
      else say(r.error, true);
      await refresh();
      return r.ok;
    } catch {
      say("Bağlantı hatası. İnternetini kontrol et.", true);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function toggleDuty() {
    const on = !me.on_duty;
    setMe((m) => ({ ...m, on_duty: on }));
    const r = await setDuty(on);
    if (!r.ok) {
      setMe((m) => ({ ...m, on_duty: !on }));
      say(r.error, true);
    } else say(on ? "Mesaidesin — yeni siparişler sana bildirilecek" : "Mesai kapatıldı");
  }

  const mine = (live ?? []).filter((o) => o.courier_id === me.user_id).sort((a, b) => Number(b.status === "yolda") - Number(a.status === "yolda"));
  const pool = (live ?? []).filter((o) => !o.courier_id);
  const sToday = stats(today, me.per_delivery_fee);
  const sPeriod = stats(history, me.per_delivery_fee);
  const sOpen = stats(unsettled, me.per_delivery_fee);

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-bg pb-24">
      {/* Üst bar */}
      <header className="sticky top-0 z-30 space-y-3 bg-ink px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/60">
              <Bike size={14} className="text-brand" /> Sanal Market Kurye
            </p>
            <p className="truncate text-lg font-black">{me.full_name ?? "Kurye"}</p>
          </div>
          <button
            type="button"
            onClick={toggleDuty}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-black ring-2 transition ${
              me.on_duty ? "bg-emerald-500 ring-emerald-300" : "bg-white/10 ring-white/20"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${me.on_duty ? "animate-pulse bg-white" : "bg-white/40"}`} />
            {me.on_duty ? "Mesaide" : "Molada"}
          </button>
        </div>
        <LocationBar loc={loc} onDuty={me.on_duty} />
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {[
            ["Teslimat", String(sToday.count)],
            ["Nakit", tl(sToday.cash).replace(/,\d\d\s?₺?$/, "")],
            ["POS", tl(sToday.pos).replace(/,\d\d\s?₺?$/, "")],
            ["Hak ediş", tl(sToday.fee).replace(/,\d\d\s?₺?$/, "")],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/[0.08] px-1 py-1.5">
              <p className="truncate text-sm font-black tabular-nums">{v}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">{l} · bugün</p>
            </div>
          ))}
        </div>
      </header>

      {toast && (
        <div className={`fixed inset-x-4 top-4 z-[80] mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-sm font-bold text-white shadow-xl ${toast.bad ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.text}
        </div>
      )}

      <main className="space-y-3 p-3">
        {tab === "gorev" && (
          <>
            <div className="flex items-center justify-between px-1">
              <h2 className="font-extrabold">Görevlerim ({mine.length})</h2>
              <button type="button" onClick={() => void refresh()} className="flex items-center gap-1 text-xs font-bold text-muted">
                <span className={`h-2 w-2 rounded-full ${liveOn ? "animate-pulse bg-emerald-500" : "bg-muted/40"}`} />
                {liveOn ? "Canlı" : "Yenileniyor"} · <RefreshCw size={14} /> {loadedAt ? hm(new Date(loadedAt).toISOString()) : "…"}
              </button>
            </div>
            {live === null ? (
              <div className="h-40 animate-pulse rounded-2xl bg-white" />
            ) : mine.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-line bg-white/60 p-6 text-center">
                <Inbox className="mx-auto text-muted" />
                <p className="mt-2 font-bold">Şu an görevin yok</p>
                <p className="text-sm text-muted">{me.on_duty ? "Yeni sipariş atanınca sesli uyarı ve bildirim gelir." : "Sipariş alabilmek için üstten mesaiyi aç."}</p>
              </div>
            ) : (
              mine.map((o) => (
                <OrderCard
                  key={o.id}
                  o={o}
                  now={now}
                  mode="mine"
                  busy={busy === o.id}
                  canClaim
                  onClaim={() => {}}
                  onPickup={() => void act(o.id, () => pickupOrder(o.id), `#${o.order_no} yolda — iyi yolculuklar`)}
                  onDeliver={() => setDeliverFor(o)}
                  onIssue={() => setIssueFor(o)}
                  onRelease={() => confirm(`#${o.order_no} havuza geri verilsin mi?`) && void act(o.id, () => releaseOrder(o.id), "Sipariş havuza bırakıldı")}
                />
              ))
            )}

            {pool.length > 0 && (
              <>
                <h2 className="px-1 pt-2 font-extrabold text-muted">Atanmamış siparişler ({pool.length})</h2>
                {pool.map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    now={now}
                    mode="pool"
                    busy={busy === o.id}
                    canClaim={me.on_duty}
                    onClaim={() => void act(o.id, () => claimOrder(o.id), `#${o.order_no} sana atandı`)}
                    onPickup={() => {}}
                    onDeliver={() => {}}
                    onIssue={() => {}}
                    onRelease={() => {}}
                  />
                ))}
              </>
            )}
          </>
        )}

        {tab === "gecmis" && (
          <>
            <PeriodPicker value={period} onChange={setPeriod} />
            <SummaryGrid s={sPeriod} />
            <h2 className="px-1 pt-1 font-extrabold">Teslim edilenler ({history.length})</h2>
            {history.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-center text-sm text-muted ring-1 ring-line">Bu dönemde teslimat yok.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                {history.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                        o.cash_amount > 0 && o.pos_amount > 0 ? "bg-amber-100 text-amber-700" : o.pos_amount > 0 ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {o.pos_amount > 0 ? <CreditCard size={16} /> : <Banknote size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        #{o.order_no} · {o.area}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {dayHm(o.delivered_at)} · {since(o.picked_up_at ?? o.dispatched_at, Date.parse(o.delivered_at ?? "") || now)} sürdü
                        {o.courier_note ? ` · ${o.courier_note}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black tabular-nums">{tl(o.collected_amount ?? 0)}</p>
                      <p className="text-[11px] font-semibold text-muted">
                        {o.cash_amount > 0 && o.pos_amount > 0 ? `${tl(o.cash_amount)} N + ${tl(o.pos_amount)} P` : payKind(o.cash_amount, o.pos_amount)}
                        {o.receipts > 0 ? ` · 🧾${o.receipts}` : ""}
                        {o.settlement_id ? " · ✓" : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "kasa" && (
          <>
            <section className="rounded-3xl bg-emerald-700 p-5 text-white shadow">
              <p className="text-sm font-bold text-white/75">Üzerimdeki nakit (markete teslim edilecek)</p>
              <p className="mt-1 text-4xl font-black tabular-nums">{tl(sOpen.cash)}</p>
              <p className="mt-2 text-sm text-white/80">
                {sOpen.count} teslimat hesaplaşılmadı · POS {tl(sOpen.pos)} · Hak ediş {tl(sOpen.fee)}
              </p>
            </section>
            <p className="px-1 text-xs text-muted">
              Nakdi markete teslim ettiğinde yönetici “Hesaplaş” der; bu teslimatlar kapanır ve aşağıdaki geçmişe yazılır.
            </p>
            {unsettled.length > 0 && (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                {unsettled.map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate">
                      <b>#{o.order_no}</b> · {hm(o.delivered_at)} · {o.area}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {tl(o.collected_amount ?? 0)}{" "}
                      <span className="text-xs text-muted">
                        {o.cash_amount > 0 && o.pos_amount > 0 ? `(N ${tl(o.cash_amount)} + P ${tl(o.pos_amount)})` : payKind(o.cash_amount, o.pos_amount)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <h2 className="px-1 pt-2 font-extrabold">Hesaplaşma geçmişi</h2>
            {settlements.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-center text-sm text-muted ring-1 ring-line">Henüz hesaplaşma yok.</p>
            ) : (
              <ul className="space-y-2">
                {settlements.map((s) => (
                  <li key={s.id} className="rounded-2xl bg-white p-3 ring-1 ring-line">
                    <div className="flex items-center justify-between">
                      <b className="text-sm">{dayHm(s.created_at)}</b>
                      <span className="text-xs font-bold text-muted">{s.order_count} teslimat</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-2 text-center text-xs">
                      <Money label="Nakit teslim" v={s.cash_amount} />
                      <Money label="POS" v={s.pos_amount} />
                      <Money label="Hak ediş" v={s.fee_amount} />
                    </div>
                    {s.note && <p className="mt-1.5 text-xs text-muted">Not: {s.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "profil" && (
          <>
            <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
              <p className="text-lg font-black">{me.full_name}</p>
              <p className="text-sm text-muted">{me.email}</p>
              <dl className="grid grid-cols-2 gap-2 pt-1 text-sm">
                <Info k="Telefon" v={me.phone ? displayPhone(me.phone) : "—"} />
                <Info k="Araç" v={vehicleLabel(me.vehicle)} />
                <Info k="Plaka" v={me.plate ?? "—"} />
                <Info k="Teslimat başı ücret" v={tl(me.per_delivery_fee)} />
              </dl>
              <p className="text-xs text-muted">Bilgilerin yanlışsa yöneticiye söyle; panelden güncellenir.</p>
            </section>
            <PushSetup title="Yeni görev bildirimleri" onSubscribe={subscribeCourierPush} />
            {storePhone && (
              <a href={`tel:${storePhone}`} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 font-bold ring-1 ring-line">
                <Phone size={18} /> Marketi ara
              </a>
            )}
            <form action={signOut}>
              <button className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-bold text-brand ring-1 ring-line">
                <LogOut size={18} /> Çıkış yap
              </button>
            </form>
            <Link href="/" className="block text-center text-sm font-semibold text-muted">
              Mağazaya git
            </Link>
          </>
        )}
      </main>

      {/* Alt sekmeler */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="grid grid-cols-4">
          {(
            [
              ["gorev", "Görevler", ClipboardList, mine.length],
              ["gecmis", "Geçmiş", History, 0],
              ["kasa", "Kasa", Wallet, 0],
              ["profil", "Profil", User, 0],
            ] as const
          ).map(([k, l, Icon, badge]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${tab === k ? "text-brand" : "text-muted"}`}>
              <Icon size={22} />
              {l}
              {badge > 0 && <span className="absolute right-[calc(50%-20px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] text-white">{badge}</span>}
              {k === "gorev" && pool.length > 0 && badge === 0 && <span className="absolute right-[calc(50%-16px)] top-2 h-2 w-2 rounded-full bg-amber-500" />}
            </button>
          ))}
        </div>
      </nav>

      {deliverFor && (
        <DeliverSheet
          o={deliverFor}
          busy={busy === deliverFor.id}
          onClose={() => setDeliverFor(null)}
          courierId={me.user_id}
          onConfirm={async (cash, pos, note, receipts) => {
            const ok = await act(deliverFor.id, () => deliverOrder(deliverFor.id, cash, pos, note, receipts), `#${deliverFor.order_no} teslim edildi 👏`);
            if (ok) setDeliverFor(null);
          }}
        />
      )}
      {issueFor && (
        <IssueSheet
          o={issueFor}
          busy={busy === issueFor.id}
          onClose={() => setIssueFor(null)}
          onConfirm={async (reason) => {
            const ok = await act(issueFor.id, () => reportIssue(issueFor.id, reason), "Yöneticiye bildirildi");
            if (ok) setIssueFor(null);
          }}
        />
      )}
    </div>
  );
}

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
      {PERIODS.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold ${value === k ? "bg-ink text-white" : "bg-white ring-1 ring-line"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function SummaryGrid({ s }: { s: ReturnType<typeof stats> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Tile label="Teslimat" value={String(s.count)} hint={s.avgMin != null ? `ort. ${s.avgMin} dk yolda` : undefined} />
      <Tile label="Toplam tahsilat" value={tl(s.total)} />
      <Tile label="Nakit" value={tl(s.cash)} tone="text-emerald-700" />
      <Tile label="POS" value={tl(s.pos)} tone="text-violet-700" />
      <div className="col-span-2">
        <Tile label="Hak ediş (teslimat başı ücret × teslimat)" value={tl(s.fee)} tone="text-brand" />
      </div>
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-line">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`text-xl font-black tabular-nums ${tone ?? ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Money({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg bg-bg px-1 py-1.5">
      <p className="font-black tabular-nums">{tl(v)}</p>
      <p className="text-muted">{label}</p>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-bg px-3 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="font-bold">{v}</dd>
    </div>
  );
}

function LocationBar({ loc, onDuty }: { loc: ReturnType<typeof useCourierLocation>; onDuty: boolean }) {
  if (!onDuty) return <p className="text-xs text-white/50">📍 Konum paylaşımı kapalı (yalnızca mesaideyken paylaşılır)</p>;
  const text: Record<string, string> = {
    bekliyor: "📍 Konum alınıyor… (izin isterse “İzin ver” de)",
    aktif: `📍 Konum paylaşılıyor${loc.accuracy ? ` · ±${loc.accuracy} m` : ""}${loc.sentAt ? ` · ${hm(new Date(loc.sentAt).toISOString())}` : ""}`,
    reddedildi: "⚠️ Konum izni verilmedi. Tarayıcı ayarlarından bu siteye konum izni ver.",
    desteklenmiyor: "⚠️ Bu cihaz konum paylaşımını desteklemiyor.",
    hata: "⚠️ Konum alınamadı. GPS açık mı? Tekrar deneniyor…",
  };
  const bad = loc.status === "reddedildi" || loc.status === "hata" || loc.status === "desteklenmiyor";
  return (
    <p className={`rounded-lg px-2 py-1 text-xs font-semibold ${bad ? "bg-amber-400/20 text-amber-200" : "text-emerald-200"}`}>
      {text[loc.status] ?? ""} {loc.status === "aktif" && <span className="font-normal text-white/50">· ekranı açık tut</span>}
    </p>
  );
}
