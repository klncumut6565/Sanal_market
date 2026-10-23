import Link from "next/link";
import { AlertTriangle, Bike, CheckCircle2, Clock, MessageCircle, Phone, UserCheck, UserX, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { getStoreSettings } from "@/lib/data/catalog";
import { addDays, businessDateStart, reportRanges } from "@/lib/hours";
import { formatDate, formatTL } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";
import { VEHICLES, vehicleLabel } from "@/lib/courierShared";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import { CourierMap } from "@/components/admin/CourierMap";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { ReceiptGallery, type ReceiptRow } from "@/components/admin/ReceiptGallery";
import { decideCourier, settleCourier, updateCourier } from "./actions";

export const metadata = { title: "Kuryeler" };

type Row = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  app_status: "bekliyor" | "onaylandi" | "reddedildi" | null;
  requested_at: string | null;
  app_vehicle: string | null;
  app_plate: string | null;
  is_courier: boolean;
  is_active: boolean;
  on_duty: boolean;
  vehicle: string | null;
  plate: string | null;
  per_delivery_fee: number | null;
  duty_changed_at: string | null;
};
type O = {
  id: string;
  order_no: number;
  status: string;
  courier_id: string;
  customer_name: string;
  total: number;
  collected_method: "nakit" | "pos" | null;
  collected_amount: number | null;
  cash_amount: number | null;
  pos_amount: number | null;
  delivered_at: string | null;
  picked_up_at: string | null;
  dispatched_at: string | null;
  delivery_issue: string | null;
  settlement_id: number | null;
};

const PERIODS: [string, string][] = [
  ["bugun", "Bugün"],
  ["dun", "Dün"],
  ["hafta", "Bu hafta"],
  ["ay", "Bu ay"],
  ["gecen_ay", "Geçen ay"],
];

function range(p: string, open: string) {
  const r = reportRanges(open);
  const s = (d: string) => businessDateStart(d, open);
  const end = s(addDays(r.today, 1));
  if (p === "dun") return { from: s(r.yesterday), to: s(r.today) };
  if (p === "hafta") return { from: s(r.weekStart), to: end };
  if (p === "ay") return { from: s(r.monthStart), to: end };
  if (p === "gecen_ay") return { from: s(r.prevMonthStart), to: s(r.monthStart) };
  return { from: s(r.today), to: end };
}

// Parçalı ödemeler dahil: nakit ve POS kısımları ayrı sütunlardan toplanır (eski kayıtlarda yöntem + tutar)
const part = (o: O, m: "nakit" | "pos") => Number((m === "nakit" ? o.cash_amount : o.pos_amount) ?? (o.collected_method === m ? o.collected_amount : 0) ?? 0);
const sum = (list: O[], m: "nakit" | "pos") => list.reduce((a, o) => a + part(o, m), 0);
function avgMin(list: O[]) {
  const d = list
    .map((o) => (o.delivered_at && (o.picked_up_at ?? o.dispatched_at) ? (Date.parse(o.delivered_at) - Date.parse((o.picked_up_at ?? o.dispatched_at)!)) / 60_000 : null))
    .filter((x): x is number => x != null && x >= 0 && x < 240);
  return d.length ? Math.round(d.reduce((a, x) => a + x, 0) / d.length) : null;
}

const COLS = "id,order_no,status,courier_id,customer_name,total,collected_method,collected_amount,cash_amount,pos_amount,delivered_at,picked_up_at,dispatched_at,delivery_issue,settlement_id";

export default async function CouriersPage({ searchParams }: { searchParams: Promise<{ donem?: string; ok?: string; hata?: string }> }) {
  const { donem = "bugun", ok, hata } = await searchParams;
  const { supabase } = await requireAdmin();
  const settings = await getStoreSettings();
  const open = String(settings.open_time ?? "10:00").slice(0, 5);
  const pr = range(donem, open);

  const [{ data: ov }, { data: live }, { data: done }, { data: unsettled }, { data: sets }, { data: rec }] = await Promise.all([
    supabase.rpc("admin_courier_overview"),
    supabase.from("orders").select(COLS).not("courier_id", "is", null).in("status", ["hazirlaniyor", "yolda"]).order("created_at"),
    supabase.from("orders").select(COLS).not("courier_id", "is", null).eq("status", "teslim_edildi").gte("delivered_at", pr.from).lt("delivered_at", pr.to).limit(5000),
    supabase.from("orders").select(COLS).not("courier_id", "is", null).eq("status", "teslim_edildi").is("settlement_id", null).limit(5000),
    supabase.from("courier_settlements").select("id,courier_id,created_at,order_count,cash_amount,pos_amount,fee_amount,note").order("created_at", { ascending: false }).limit(25),
    supabase
      .from("pos_receipts")
      .select("id,order_id,courier_id,path,amount,created_at,review_status,review_note,orders(order_no,pos_amount)")
      .neq("review_status", "onaylandi")
      .order("created_at", { ascending: false })
      .limit(24),
  ]);
  const rows = (ov ?? []) as Row[];
  const by = <T extends { courier_id: string }>(list: T[] | null, id: string) => (list ?? []).filter((x) => x.courier_id === id);
  const pending = rows.filter((r) => r.app_status === "bekliyor" && !r.is_active);
  const active = rows.filter((r) => r.is_active);
  const inactive = rows.filter((r) => r.is_courier && !r.is_active);
  const nameOf = new Map(rows.map((r) => [r.user_id, r.full_name ?? r.email]));
  const issues = ((live ?? []) as O[]).filter((o) => o.delivery_issue);
  const onDuty = active.filter((r) => r.on_duty).length;
  const allDone = (done ?? []) as O[];
  const allOpen = (unsettled ?? []) as O[];
  // Hesaplaşılmamış POS'lu teslimatların fişleri (fişsiz / sorunlu / bekleyen kontrolü)
  const posIds = allOpen.filter((o) => part(o, "pos") > 0).map((o) => o.id);
  const { data: urc } = posIds.length ? await supabase.from("pos_receipts").select("order_id,review_status").in("order_id", posIds) : { data: [] };
  const receiptRows = (urc ?? []) as { order_id: string; review_status: string }[];
  const allReceiptOrders = new Set(receiptRows.map((x) => x.order_id));
  type RecQ = ReceiptRow & { courier_id: string | null; orders: { order_no: number; pos_amount: number | null } | null };
  const reviewList = ((rec ?? []) as unknown as RecQ[]).map((r) => ({
    ...r,
    amount: r.amount == null ? null : Number(r.amount),
    caption: `#${r.orders?.order_no ?? "?"} · ${nameOf.get(r.courier_id ?? "") ?? "Kurye"} · POS ${formatTL(Number(r.orders?.pos_amount ?? 0))}`,
    href: `/admin/siparisler/${r.order_id}`,
  }));

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Bike className="text-brand" /> Kuryeler
          </h1>
          <p className="text-sm text-muted">
            {active.length} aktif kurye · {onDuty} mesaide · üzerlerinde {formatTL(sum(allOpen, "nakit"))} nakit (hesaplaşılmadı)
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <LiveRefresh
            tables={["orders", "courier_settlements", "couriers", "pos_receipts"]}
            ignore={{ couriers: ["last_lat", "last_lng", "last_accuracy", "last_speed", "last_heading", "last_loc_at"] }}
            intervalMs={120_000}
          />
          <p className="text-xs text-muted">
            Kurye giriş adresi: <b>/giris?kurye=1</b>
          </p>
        </div>
      </div>
      {active.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="font-extrabold">Canlı konum</h2>
          <CourierMap height={380} />
        </section>
      )}
      {ok && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{ok}</p>}
      {hata && <p className="rounded-xl bg-brand-soft p-3 text-sm font-semibold text-brand">{hata}</p>}

      {issues.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-red-50 p-4 ring-2 ring-red-300">
          <h2 className="flex items-center gap-2 font-extrabold text-red-700">
            <AlertTriangle size={18} /> Teslim edilemeyen siparişler ({issues.length})
          </h2>
          {issues.map((o) => (
            <Link key={o.id} href={`/admin/siparisler/${o.id}`} className="block rounded-xl bg-white p-3 text-sm ring-1 ring-red-200">
              <b>#{o.order_no}</b> · {o.customer_name} · {nameOf.get(o.courier_id)}: <span className="font-semibold text-red-700">{o.delivery_issue}</span>
            </Link>
          ))}
        </section>
      )}

      {reviewList.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-200">
          <h2 className="font-extrabold text-violet-900">🧾 POS fişi kontrolü ({reviewList.length})</h2>
          <p className="text-xs text-violet-900/70">Kuryelerin teslimde çektiği POS fişleri. Fişteki tutarı ve tarihi kontrol edip onayla; uymayanı “Sorunlu” işaretle.</p>
          <ReceiptGallery receipts={reviewList} back="/admin/kuryeler" compact />
        </section>
      )}

      {/* Başvurular */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-extrabold">
          Kurye başvuruları
          {pending.length > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-muted ring-1 ring-line">
            Bekleyen başvuru yok. Kuryeler siteye üye olup <b>Kurye girişi</b>nden başvurur.
          </p>
        ) : (
          pending.map((r) => (
            <div key={r.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 ring-2 ring-amber-300">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{r.full_name ?? "—"}</p>
                <p className="text-sm text-muted">
                  {r.email}
                  {r.phone && ` · ${displayPhone(r.phone)}`}
                </p>
                <p className="text-xs text-muted">
                  {vehicleLabel(r.app_vehicle)}
                  {r.app_plate ? ` · ${r.app_plate}` : ""} · Başvuru: {r.requested_at ? formatDate(r.requested_at) : "—"}
                </p>
              </div>
              <form action={decideCourier} className="flex items-center gap-2">
                <input type="hidden" name="user_id" value={r.user_id} />
                <input type="hidden" name="approve" value="1" />
                <label className="text-xs font-semibold text-muted">
                  Teslimat başı ₺
                  <input name="fee" inputMode="decimal" defaultValue="0" className="input ml-1 inline-block w-20 py-1.5" />
                </label>
                <button className="flex items-center gap-1.5 rounded-xl bg-ok px-3 py-2 text-sm font-bold text-white">
                  <UserCheck size={16} /> Kurye yap
                </button>
              </form>
              <form action={decideCourier}>
                <input type="hidden" name="user_id" value={r.user_id} />
                <input type="hidden" name="approve" value="0" />
                <button className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-muted ring-1 ring-line">
                  <UserX size={16} /> Reddet
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      {/* Dönem */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm font-bold">Performans:</span>
        {PERIODS.map(([k, l]) => (
          <Link key={k} href={`/admin/kuryeler?donem=${k}`} className={`rounded-full px-3 py-1.5 text-sm font-bold ${donem === k ? "bg-ink text-white" : "bg-white ring-1 ring-line"}`}>
            {l}
          </Link>
        ))}
      </div>

      {/* Aktif kuryeler */}
      <section className="grid gap-3 lg:grid-cols-2">
        {active.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-muted ring-1 ring-line lg:col-span-2">Henüz onaylı kurye yok.</p>}
        {active.map((r) => {
          const d = by(allDone, r.user_id);
          const u = by(allOpen, r.user_id);
          const l = by((live ?? []) as O[], r.user_id);
          const fee = Number(r.per_delivery_fee ?? 0);
          const cashOpen = sum(u, "nakit");
          const posOrders = u.filter((o) => part(o, "pos") > 0);
          const recOf = (oid: string) => receiptRows.filter((x) => x.order_id === oid);
          const posNoReceipt = posOrders.filter((o) => !allReceiptOrders.has(o.id)).length;
          const posProblem = posOrders.filter((o) => recOf(o.id).some((x) => x.review_status === "sorunlu")).length;
          const posWaiting = posOrders.filter((o) => recOf(o.id).some((x) => x.review_status === "bekliyor")).length;
          const avg = avgMin(d);
          return (
            <article key={r.user_id} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black">{r.full_name ?? r.email}</p>
                  <p className="text-xs text-muted">
                    {vehicleLabel(r.vehicle)}
                    {r.plate ? ` · ${r.plate}` : ""} · teslimat başı {formatTL(fee)}
                  </p>
                </div>
                <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${r.on_duty ? "bg-emerald-100 text-emerald-700" : "bg-bg text-muted"}`}>
                  <span className={`h-2 w-2 rounded-full ${r.on_duty ? "bg-emerald-500" : "bg-muted/50"}`} />
                  {r.on_duty ? "Mesaide" : "Molada"}
                  {r.duty_changed_at && <span className="font-normal">· {formatDate(r.duty_changed_at)}</span>}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                <Stat label="Teslimat" v={String(d.length)} />
                <Stat label="Nakit" v={formatTL(sum(d, "nakit"))} />
                <Stat label="POS" v={formatTL(sum(d, "pos"))} />
                <Stat label="Ort. süre" v={avg != null ? `${avg} dk` : "—"} />
              </div>
              <p className="text-xs text-muted">Dönem hak edişi: {formatTL(d.length * fee)}</p>

              {l.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {l.map((o) => (
                    <Link
                      key={o.id}
                      href={`/admin/siparisler/${o.id}`}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${o.delivery_issue ? "bg-red-100 text-red-700" : o.status === "yolda" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-800"}`}
                    >
                      #{o.order_no} {o.status === "yolda" ? "yolda" : "hazırlanıyor"}
                    </Link>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">
                    <Wallet size={15} className="mr-1 inline text-emerald-700" />
                    Üzerindeki nakit: <b className="text-emerald-800">{formatTL(cashOpen)}</b>
                    <span className="text-xs text-muted">
                      {" "}
                      · {u.length} teslimat · POS {formatTL(sum(u, "pos"))} · hak ediş {formatTL(u.length * fee)}
                    </span>
                    {posOrders.length > 0 && (
                      <span className="mt-1 block text-xs font-bold">
                        🧾 POS fişleri: {posOrders.length} teslimat
                        {posWaiting > 0 && <span className="text-amber-700"> · {posWaiting} kontrol bekliyor</span>}
                        {posProblem > 0 && <span className="text-red-700"> · {posProblem} sorunlu</span>}
                        {posNoReceipt > 0 && <span className="text-red-700"> · {posNoReceipt} fişsiz</span>}
                        {posWaiting + posProblem + posNoReceipt === 0 && <span className="text-emerald-700"> · hepsi onaylı ✓</span>}
                      </span>
                    )}
                  </p>
                </div>
                {u.length > 0 && (
                  <form action={settleCourier} className="mt-2 flex gap-2">
                    <input type="hidden" name="courier_id" value={r.user_id} />
                    <input name="note" placeholder="Not (isteğe bağlı)" className="input min-w-0 flex-1 py-1.5 text-sm" />
                    <ConfirmSubmit
                      message={`${r.full_name ?? "Kurye"}: ${formatTL(cashOpen)} nakit teslim alındı mı? ${u.length} teslimat kapanacak.`}
                      className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white"
                    >
                      <CheckCircle2 size={15} className="mr-1 inline" /> Hesaplaş
                    </ConfirmSubmit>
                  </form>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {r.phone && (
                  <>
                    <a href={`tel:${r.phone}`} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 ring-1 ring-line">
                      <Phone size={14} /> {displayPhone(r.phone)}
                    </a>
                    <a href={waLink(r.phone, "Merhaba")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-white">
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  </>
                )}
              </div>

              <details className="rounded-xl bg-bg p-2.5 text-sm">
                <summary className="cursor-pointer font-bold">Bilgileri düzenle</summary>
                <form action={updateCourier} className="mt-2 grid grid-cols-2 gap-2">
                  <input type="hidden" name="user_id" value={r.user_id} />
                  <label className="text-xs font-semibold">
                    Teslimat başı ücret (₺)
                    <input name="fee" inputMode="decimal" defaultValue={String(fee)} className="input mt-0.5 py-1.5" />
                  </label>
                  <label className="text-xs font-semibold">
                    Telefon
                    <input name="phone" defaultValue={r.phone ?? ""} className="input mt-0.5 py-1.5" />
                  </label>
                  <label className="text-xs font-semibold">
                    Araç
                    <select name="vehicle" defaultValue={r.vehicle ?? "motosiklet"} className="input mt-0.5 py-1.5">
                      {VEHICLES.map(([v, lbl]) => (
                        <option key={v} value={v}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">
                    Plaka
                    <input name="plate" defaultValue={r.plate ?? ""} className="input mt-0.5 py-1.5 uppercase" />
                  </label>
                  <button className="btn-primary col-span-2 py-2 text-sm">Kaydet</button>
                </form>
                <form action={updateCourier} className="mt-2">
                  <input type="hidden" name="user_id" value={r.user_id} />
                  <input type="hidden" name="active" value="0" />
                  <ConfirmSubmit message="Kurye yetkisi kapatılsın mı? Kurye paneline giremez, geçmiş kayıtları kalır." className="text-xs font-bold text-brand underline">
                    Kurye yetkisini kapat
                  </ConfirmSubmit>
                </form>
              </details>
            </article>
          );
        })}
      </section>

      {/* Hesaplaşma geçmişi */}
      <section className="space-y-2">
        <h2 className="font-extrabold">Son hesaplaşmalar</h2>
        {(sets ?? []).length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-muted ring-1 ring-line">Henüz hesaplaşma yok.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-bg text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Kurye</th>
                  <th className="px-3 py-2 text-right">Teslimat</th>
                  <th className="px-3 py-2 text-right">Nakit</th>
                  <th className="px-3 py-2 text-right">POS</th>
                  <th className="px-3 py-2 text-right">Hak ediş</th>
                  <th className="px-3 py-2">Not</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(sets ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(s.created_at)}</td>
                    <td className="px-3 py-2">{nameOf.get(s.courier_id) ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.order_count}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{formatTL(s.cash_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatTL(s.pos_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatTL(s.fee_amount)}</td>
                    <td className="px-3 py-2 text-muted">{s.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inactive.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-extrabold text-muted">Pasif kuryeler</h2>
          {inactive.map((r) => (
            <div key={r.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 opacity-80 ring-1 ring-line">
              <Clock size={18} className="text-muted" />
              <p className="min-w-0 flex-1 text-sm">
                <b>{r.full_name ?? r.email}</b> <span className="text-muted">· {r.email}</span>
              </p>
              <form action={decideCourier}>
                <input type="hidden" name="user_id" value={r.user_id} />
                <input type="hidden" name="approve" value="1" />
                <input type="hidden" name="fee" value={String(r.per_delivery_fee ?? 0)} />
                <button className="rounded-xl px-3 py-1.5 text-sm font-bold text-ok ring-1 ring-line">Tekrar aktif et</button>
              </form>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg bg-bg px-1 py-1.5">
      <p className="truncate font-black tabular-nums">{v}</p>
      <p className="text-muted">{label}</p>
    </div>
  );
}
