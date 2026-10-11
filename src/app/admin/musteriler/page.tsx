import Link from "next/link";
import { ChevronRight, MessageCircle, Phone, Search } from "lucide-react";
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

  const needle = q.trim().toLocaleLowerCase("tr");
  const digits = localDigits(q);
  if (needle)
    list = list.filter((c) => c.name.toLocaleLowerCase("tr").includes(needle) || (digits.length >= 3 && c.phone.includes(digits)));
  if (sira === "harcama") list = [...list].sort((a, b) => b.totalSpent - a.totalSpent);
  if (sira === "siparis") list = [...list].sort((a, b) => b.orderCount - a.orderCount);

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
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Ad veya telefon ara" className="input pl-10!" />
        </div>
        <select name="sira" defaultValue={sira} className="input w-auto">
          <option value="son">Son sipariş</option>
          <option value="harcama">En çok harcayan</option>
          <option value="siparis">En çok sipariş</option>
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
                <Link href={`/admin/musteriler/${encodeURIComponent(c.phone)}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-bold">
                    <span className="truncate">{c.name}</span>
                    {c.member && <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">Üye</span>}
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
