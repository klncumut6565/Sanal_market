"use client";
import { formatTL } from "@/lib/format";
import { PAY_LABEL, type PosStore } from "./posTypes";

export type ReceiptData = {
  saleNo: number;
  at: string;
  lines: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  payment: "nakit" | "kart" | "karisik";
  cash: number;
  card: number;
  change: number;
  voided?: boolean;
};

/** 80 mm termal fiş — yalnızca yazdırırken görünür (window.print). Mali belge değildir. */
export function PosReceipt({ data, store }: { data: ReceiptData; store: PosStore }) {
  return (
    <>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 3mm; }
          body * { visibility: hidden !important; }
          #pos-fis, #pos-fis * { visibility: visible !important; }
          #pos-fis { position: fixed; left: 0; top: 0; width: 74mm; display: block !important; }
        }
      `}</style>
      <div id="pos-fis" className="hidden font-mono text-[11px] leading-tight text-black">
        <p className="text-center text-sm font-bold">{store.name}</p>
        {store.address && <p className="text-center">{store.address}</p>}
        {store.phone && <p className="text-center">Tel: {store.phone}</p>}
        <p className="mt-1 border-y border-dashed border-black py-0.5 text-center">
          FİŞ #{data.saleNo} · {new Date(data.at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
        {data.voided && <p className="text-center font-bold">*** İPTAL EDİLDİ ***</p>}
        <table className="my-1 w-full">
          <tbody>
            {data.lines.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="pr-1">
                  {l.name}
                  <br />
                  {String(l.qty).replace(".", ",")} x {formatTL(l.price)}
                </td>
                <td className="whitespace-nowrap text-right">{formatTL(Math.round(l.qty * l.price * 100) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-dashed border-black pt-0.5">
          <Row k="Ara toplam" v={formatTL(data.subtotal)} />
          {data.discount > 0 && <Row k="İndirim" v={"-" + formatTL(data.discount)} />}
          <p className="flex justify-between text-sm font-bold">
            <span>TOPLAM</span>
            <span>{formatTL(data.total)}</span>
          </p>
          <Row k="Ödeme" v={PAY_LABEL[data.payment]} />
          {data.cash > 0 && <Row k="Nakit" v={formatTL(data.cash)} />}
          {data.card > 0 && <Row k="Kart" v={formatTL(data.card)} />}
          {data.change > 0 && <Row k="Para üstü" v={formatTL(data.change)} />}
        </div>
        <p className="mt-2 text-center">Teşekkür ederiz, yine bekleriz!</p>
        <p className="text-center text-[9px]">Bilgi fişidir, mali değeri yoktur.</p>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex justify-between">
      <span>{k}</span>
      <span>{v}</span>
    </p>
  );
}
