"use client";
import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { Order } from "@/lib/types";
import { waLink } from "@/lib/whatsapp";

type Props = { order: Pick<Order, "order_no" | "customer_name" | "phone" | "total" | "delivery_slot">; storeName: string };

export function WhatsAppActions({ order, storeName }: Props) {
  const name = order.customer_name.split(" ")[0];
  const total = Number(order.total).toFixed(2).replace(".", ",") + " ₺";
  const templates = [
    { label: "Sipariş alındı", text: `Merhaba ${name}, ${storeName} 🧡 #${order.order_no} numaralı siparişiniz alındı, hemen hazırlamaya başlıyoruz. Tutar: ${total}.` },
    { label: "Yola çıktı", text: `Merhaba ${name}, #${order.order_no} numaralı siparişiniz motokuryemizle yola çıktı 🛵 Kısa süre içinde kapınızda olacak. Ödeme kapıda: ${total}.` },
    { label: "Ürün yok / alternatif", text: `Merhaba ${name}, #${order.order_no} numaralı siparişinizdeki bir ürün stokta kalmadı. Benzer bir ürünle değiştirmemizi ister misiniz, yoksa çıkaralım mı?` },
    { label: "Adres teyidi", text: `Merhaba ${name}, #${order.order_no} numaralı siparişiniz için adresinizi teyit edebilir miyiz? Kuryemiz bulmakta zorlanıyor.` },
    { label: "Gecikme", text: `Merhaba ${name}, #${order.order_no} numaralı siparişiniz yoğunluk nedeniyle birkaç dakika gecikecek, anlayışınız için teşekkür ederiz 🙏` },
  ];
  const [custom, setCustom] = useState("");

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <h2 className="flex items-center gap-2 font-extrabold">
        <MessageCircle size={18} className="text-[#25D366]" /> WhatsApp ile mesaj
      </h2>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <a
            key={t.label}
            href={waLink(order.phone, t.text)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#e9fbef] px-3.5 py-2 text-sm font-bold text-[#128c4a] ring-1 ring-[#25D366]/30 hover:bg-[#d4f6e0]"
          >
            {t.label}
          </a>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Serbest mesaj yaz…" className="input" />
        <a
          href={custom.trim() ? waLink(order.phone, custom.trim()) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!custom.trim()}
          className={`grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white ${custom.trim() ? "" : "pointer-events-none opacity-40"}`}
        >
          <Send size={18} />
        </a>
      </div>
      <p className="text-xs text-muted">Mesaj, bu cihazda açık olan WhatsApp hesabından gönderilir.</p>
    </section>
  );
}
