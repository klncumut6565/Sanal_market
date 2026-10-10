"use client";
import { useState } from "react";
import { formatLocal, isValidTrMobile, localDigits, toE164 } from "@/lib/phone";

type Props = {
  /** Form gönderiminde kullanılacak ad (gizli alan +905xxxxxxxxx olarak gönderilir) */
  name?: string;
  /** Kontrollü kullanım: +905xxxxxxxxx değeri (eksikse yazılan haneler) */
  value?: string;
  defaultValue?: string;
  onChange?: (e164: string) => void;
  required?: boolean;
  id?: string;
};

export function PhoneInput({ name, value, defaultValue, onChange, required, id }: Props) {
  const [inner, setInner] = useState(() => localDigits(defaultValue ?? ""));
  const digits = value !== undefined ? localDigits(value) : inner;
  const [touched, setTouched] = useState(false);

  const update = (raw: string) => {
    const d = localDigits(raw);
    if (value === undefined) setInner(d);
    onChange?.(d ? toE164(d) : "");
  };

  const invalid = touched && digits.length > 0 && !isValidTrMobile(digits);

  return (
    <div>
      <div
        className={`flex items-center overflow-hidden rounded-xl border bg-white transition focus-within:ring-2 ${
          invalid ? "border-brand focus-within:ring-brand/20" : "border-line focus-within:border-brand focus-within:ring-brand/15"
        }`}
      >
        <span className="flex shrink-0 select-none items-center gap-1.5 self-stretch whitespace-nowrap border-r border-line bg-bg px-3 text-[15px] font-semibold">
          🇹🇷 +90
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="5xx xxx xx xx"
          value={formatLocal(digits)}
          onChange={(e) => update(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            update(e.clipboardData.getData("text"));
          }}
          onBlur={() => setTouched(true)}
          maxLength={13}
          required={required}
          pattern="5\d{2} \d{3} \d{2} \d{2}"
          title="Cep telefonu 5 ile başlamalı ve 10 haneli olmalı (ör. 541 673 58 63)"
          className="w-full min-w-0 bg-transparent px-3 py-2.5 text-[15px] tracking-wide outline-none"
        />
      </div>
      {name && <input type="hidden" name={name} value={digits ? toE164(digits) : ""} />}
      {invalid && <p className="mt-1 text-xs font-semibold text-brand">Cep telefonu 5 ile başlamalı ve 10 haneli olmalı.</p>}
    </div>
  );
}
