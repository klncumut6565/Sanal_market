import { Crown, ShieldCheck, ShieldX, UserCheck, UserX } from "lucide-react";
import { requireAdmin } from "@/lib/data/auth";
import { formatDate } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { ownerGrantByEmail, ownerSetAdmin } from "../actions";

export const metadata = { title: "Yöneticiler" };

type Row = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  request_status: "bekliyor" | "onaylandi" | "reddedildi" | null;
  requested_at: string | null;
  is_owner: boolean;
};

export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ ok?: string; hata?: string }> }) {
  const { ok, hata } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data }, { data: owner }] = await Promise.all([supabase.rpc("admin_access_overview"), supabase.rpc("is_owner")]);
  const rows = (data ?? []) as Row[];
  const isOwner = owner === true;
  const pending = rows.filter((r) => r.role !== "admin" && r.request_status === "bekliyor");
  const admins = rows.filter((r) => r.role === "admin");
  const rejected = rows.filter((r) => r.role !== "admin" && r.request_status === "reddedildi");

  const who = (r: Row) => (
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1.5 truncate font-bold">
        {r.full_name ?? "—"}
        {r.is_owner && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            <Crown size={12} /> Kurucu
          </span>
        )}
      </p>
      <p className="truncate text-sm text-muted">
        {r.email}
        {r.phone && ` · ${displayPhone(r.phone)}`}
      </p>
      {r.requested_at && r.role !== "admin" && <p className="text-xs text-muted">Talep: {formatDate(r.requested_at)}</p>}
    </div>
  );

  const btn = (r: Row, admin: boolean, label: string, Icon: typeof UserCheck, cls: string) => (
    <form action={ownerSetAdmin}>
      <input type="hidden" name="user_id" value={r.user_id} />
      <input type="hidden" name="admin" value={admin ? "1" : "0"} />
      <button className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ${cls}`}>
        <Icon size={16} /> {label}
      </button>
    </form>
  );

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black">Yöneticiler</h1>
        <p className="text-sm text-muted">
          Giriş ekranındaki <b>Yönetici girişi</b>nden giriş yapan, yetkisi olmayan üyeler burada onay bekler.
          {isOwner ? " Yetkiyi yalnızca sen (kurucu) verebilirsin." : " Yetki verme/kaldırma yalnızca kurucu hesaptadır."}
        </p>
      </div>

      {ok && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          {ok === "verildi" ? "Yönetici yetkisi verildi. Kişi çıkış yapıp tekrar giriş yapınca paneli görür." : "İşlem tamamlandı."}
        </p>
      )}
      {hata && <p className="rounded-xl bg-brand-soft p-3 text-sm font-semibold text-brand">{hata}</p>}

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-extrabold">
          Onay bekleyenler
          {pending.length > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-muted ring-1 ring-line">Bekleyen yetki talebi yok.</p>
        ) : (
          pending.map((r) => (
            <div key={r.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 ring-2 ring-amber-300">
              {who(r)}
              {isOwner && (
                <div className="flex gap-2">
                  {btn(r, true, "Yetki ver", UserCheck, "bg-ok text-white")}
                  {btn(r, false, "Reddet", UserX, "ring-1 ring-line text-muted")}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-extrabold">Yöneticiler ({admins.length})</h2>
        {admins.map((r) => (
          <div key={r.user_id} className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-3.5 shadow-sm shadow-navy/5 ring-1 ring-line">
            <ShieldCheck size={20} className="shrink-0 text-ok" />
            {who(r)}
            {isOwner && !r.is_owner && btn(r, false, "Yetkiyi kaldır", ShieldX, "ring-1 ring-line text-brand")}
          </div>
        ))}
      </section>

      {isOwner && (
        <section className="space-y-2 rounded-3xl bg-white p-4 shadow-sm shadow-navy/5 ring-1 ring-line">
          <h2 className="font-extrabold">E-postayla yetki ver</h2>
          <p className="text-sm text-muted">Kişinin önce siteye üye olmuş olması gerekir.</p>
          <form action={ownerGrantByEmail} className="flex flex-wrap gap-2">
            <input name="email" type="email" required placeholder="ornek@eposta.com" className="input min-w-0 flex-1" />
            <button className="btn-primary">Yönetici yap</button>
          </form>
        </section>
      )}

      {rejected.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-extrabold text-muted">Reddedilen / yetkisi kaldırılan</h2>
          {rejected.map((r) => (
            <div key={r.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 opacity-80 ring-1 ring-line">
              {who(r)}
              {isOwner && btn(r, true, "Yetki ver", UserCheck, "ring-1 ring-line text-ok")}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
