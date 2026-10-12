import Link from "next/link";
import { BadgeCheck, ChevronRight, Cigarette, MessageCircle, Phone } from "lucide-react";
import { toggleVerified } from "../actions";
import { Suspense } from "react";
import { LiveSearchInput } from "@/components/admin/LiveSearchInput";
import { requireAdmin } from "@/lib/data/auth";
import { loadCustomers } from "@/lib/data/customers";
import { displayPhone, localDigits } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";
import { formatDate, formatTL } from "@/lib/format";

export const metadata = { title: "Müşteriler" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; sira?: string }> }) {
  const { q = "", sira = "son" } = await searchParams;
  const { supabase } = await requireAdmin();
  let list = await loadCustomers(supabase);
  const { data: bl } = await supabase.from("customer_blacklist").select("phone");
  const banned = new Set((bl ?? []).map((b) => b.phone as string));
  const { data: vf } = await supabase.from("verified_customers").select("user_id");
  const verified = new Set((vf ?? []).map((v) => v.user_id as string));
  const { data: sp } = await supabase.from("special_customers").select("user_id");
  const special = new Set((sp ?? []).map((v) => v.user_id as string));

  const needle = q.trim().toLocaleLowerCase("tr");
  const digits = localDigits(q);
  if (needle)
    list = list.filter((c) => c.name.toLocaleLowerCase("tr").includes(needle) || (digits.length >= 3 && c.phone.includes(digits)));
  if (sira === "harcama") list = [...list].sort((a, b) => b.totalSpent - a.totalSpent);
  if (sira === "siparis") list = [...list].sort((a, b) => b.orderCount - a.orderCount);
  if (sira === "kara") list = list.filter((c) => banned.has(c.phone));
  if (sira === "tikli") list = list.filter((c) => c.userId && verified.has(c.userId));
  if (sira === "sigara") list = list.filter((c) => c.userId && special.has(c.userId));

  const total = list.reduce((a, c) => a + c.totalSpent, 0);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black">Müşteriler</h1>
          <p className="text-sm text-muted">
            {list.length} müşteri · toplam {formatTL(total)} harcama
          </p>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <Suspense fallback={<input name="q" defaultValue={q} placeholder="Ad veya telefon ara" className="input min-w-0 flex-1" />}>
          <LiveSearchInput placeholder="Ad veya telefon — yazdıkça arar" className="flex-1" />
        </Suspense>
        <select name="sira" defaultValue={sira} className="input w-auto">
          <option value="son">Son sipariş</option>
          <option value="harcama">En çok harcayan</option>
          <option value="siparis">En çok sipariş</option>
          <option value="tikli">🔵 Mavi tikli üyeler ({verified.size})</option>
          <option value="sigara">🚬 Sigara tikli üyeler ({special.size})</option>
          <option value="kara">⛔ Kara liste ({banned.size})</option>
        </select>
        <button className="btn-ghost">Uygula</button>
      </form>

      {list.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-muted ring-1 ring-line">Müşteri bulunamadı.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.phone} className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
              <div className="flex items-start gap-3">
                {c.userId ? (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <TickButton
                      userId={c.userId}
                      kind="mavi"
                      on={verified.has(c.userId)}
                      title="Mavi tik: alkol ve tütün dahil tüm kategorileri görür (elektronik hariç)"
                      onCls="bg-sky-500 text-white"
                      offCls="hover:text-sky-500 hover:ring-sky-300"
                    >
                      <BadgeCheck size={18} />
                    </TickButton>
                    <TickButton
                      userId={c.userId}
                      kind="sigara"
                      on={special.has(c.userId)}
                      title="Sigara tiki: elektronik ürünleri görür"
                      onCls="bg-amber-500 text-white"
                      offCls="hover:text-amber-500 hover:ring-amber-300"
                    >
                      <Cigarette size={17} />
                    </TickButton>
                  </div>
                ) : (
                  <span title="Üye değil — tik yalnızca üyelere verilir" className="grid h-8 w-8 shrink-0 place-items-center text-xs text-muted">—</span>
                )}
                <Link href={`/admin/musteriler/${encodeURIComponent(c.phone)}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-bold">
                    <span className="truncate">{c.name}</span>
                    {c.userId && verified.has(c.userId) && <BadgeCheck size={16} className="shrink-0 text-sky-500" aria-label="Mavi tikli üye" />}
                    {c.userId && special.has(c.userId) && <Cigarette size={16} className="shrink-0 text-amber-500" aria-label="Sigara tikli üye" />}
                    {c.member && <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">Üye</span>}
                    {banned.has(c.phone) && <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Kara liste</span>}
                  </p>
                  <p className="text-sm text-muted">{displayPhone(c.phone)}</p>
                  {c.lastAddress && <p className="truncate text-xs text-muted">{c.lastAddress}</p>}
                  <p className="mt-1 text-xs">
                    <b>{c.orderCount}</b> sipariş · <b>{formatTL(c.totalSpent)}</b>
                    {c.lastOrder && <span className="text-muted"> · son: {formatDate(c.lastOrder)}</span>}
                  </p>
                </Link>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <a href={waLink(c.phone, `Merhaba ${c.name.split(" ")[0]}, `)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-white">
                    <MessageCircle size={18} />
                  </a>
                  <a href={`tel:${c.phone}`} aria-label="Ara" className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-line">
                    <Phone size={16} />
                  </a>
                </div>
                <Link href={`/admin/musteriler/${encodeURIComponent(c.phone)}`} aria-label="Detay" className="self-center text-muted">
                  <ChevronRight size={20} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TickButton(props: { userId: string; kind: "mavi" | "sigara"; on: boolean; title: string; onCls: string; offCls: string; children: React.ReactNode }) {
  return (
    <form action={toggleVerified}>
      <input type="hidden" name="user_id" value={props.userId} />
      <input type="hidden" name="kind" value={props.kind} />
      <input type="hidden" name="on" value={props.on ? "0" : "1"} />
      <button
        title={`${props.title}${props.on ? " — verildi, kaldırmak için dokun" : " — vermek için dokun"}`}
        aria-label={props.title}
        aria-pressed={props.on}
        className={`grid h-8 w-8 place-items-center rounded-full transition ${props.on ? props.onCls : `text-line ring-1 ring-line ${props.offCls}`}`}
      >
        {props.children}
      </button>
    </form>
  );
}
