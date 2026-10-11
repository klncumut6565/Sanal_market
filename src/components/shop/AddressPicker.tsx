"use client";
import { useState } from "react";
import type { DeliveryAreas } from "@/lib/data/areas";
import { SelectSheet, SheetField } from "./SelectSheet";

export type AddressValue = {
  district_id: string;
  neighborhood_id: string;
  street_id: string; // "" | id | "__other"
  street_text: string;
  door_no: string;
  inner_no: string;
  building: string;
};

export const emptyAddress = (areas: DeliveryAreas): AddressValue => ({
  district_id: String(areas.districts.find((d) => d.is_active)?.id ?? ""),
  neighborhood_id: "",
  street_id: "",
  street_text: "",
  door_no: "",
  inner_no: "",
  building: "",
});

export const OTHER = "__other";

export function addressIsComplete(a: AddressValue) {
  const streetOk = a.street_id === OTHER ? a.street_text.trim().length >= 2 : !!a.street_id;
  return !!a.district_id && !!a.neighborhood_id && streetOk && a.door_no.trim().length > 0;
}

const Lbl = ({ children, req }: { children: React.ReactNode; req?: boolean }) => (
  <span className="text-sm font-semibold">
    {children} {req && <span className="text-brand">*</span>}
  </span>
);

export function AddressPicker({ areas, value, onChange }: { areas: DeliveryAreas; value: AddressValue; onChange: (v: AddressValue) => void }) {
  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });
  const neighborhoods = areas.neighborhoods.filter((n) => String(n.district_id) === value.district_id);
  const streets = areas.streets.filter((s) => String(s.neighborhood_id) === value.neighborhood_id);
  const noStreetList = !!value.neighborhood_id && streets.length === 0;
  const typing = value.street_id === OTHER || noStreetList;

  const [sheet, setSheet] = useState<null | "ilce" | "mahalle" | "sokak">(null);
  const close = () => setSheet(null);
  const district = areas.districts.find((d) => String(d.id) === value.district_id);
  const nb = neighborhoods.find((n) => String(n.id) === value.neighborhood_id);
  const street = streets.find((x) => String(x.id) === value.street_id);
  const streetLabel = value.street_id === OTHER ? (value.street_text ? `${value.street_text} (elle yazıldı)` : "Listede yok — aşağıya yaz") : street?.name;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <SheetField label="İl" placeholder="Tekirdağ" valueLabel="Tekirdağ" disabled onOpen={() => {}} />

      <SheetField label="İlçe" required placeholder="İlçe seç" valueLabel={district?.name} onOpen={() => setSheet("ilce")} />

      <SheetField label="Mahalle" required placeholder="Mahalle seç" valueLabel={nb ? `${nb.name} Mah.` : undefined} onOpen={() => setSheet("mahalle")} />

      {noStreetList ? (
        <label className="block space-y-1">
          <Lbl req>Cadde / Sokak</Lbl>
          <input
            required
            className="input"
            placeholder="Cadde / sokak adını yaz"
            value={value.street_text}
            onChange={(e) => set({ street_id: OTHER, street_text: e.target.value })}
          />
        </label>
      ) : (
        <SheetField
          label="Cadde / Sokak"
          required
          placeholder={value.neighborhood_id ? "Cadde / sokak seç" : "Önce mahalle seç"}
          valueLabel={streetLabel}
          disabled={!value.neighborhood_id}
          onOpen={() => setSheet("sokak")}
        />
      )}

      <SelectSheet
        open={sheet === "ilce"}
        title="İlçe"
        group="Tekirdağ"
        value={value.district_id}
        options={areas.districts.map((d) => ({ value: String(d.id), label: d.name, disabled: !d.is_active, hint: d.is_active ? undefined : "yakında" }))}
        onSelect={(v) => v !== value.district_id && set({ district_id: v, neighborhood_id: "", street_id: "", street_text: "" })}
        onClose={close}
      />
      <SelectSheet
        open={sheet === "mahalle"}
        title="Mahalle"
        group={district ? `${district.name} / Tekirdağ` : "Tekirdağ"}
        value={value.neighborhood_id}
        searchPlaceholder="Mahalle ara"
        options={neighborhoods.map((n) => ({ value: String(n.id), label: `${n.name} Mah.` }))}
        onSelect={(v) => v !== value.neighborhood_id && set({ neighborhood_id: v, street_id: "", street_text: "" })}
        onClose={close}
      />
      <SelectSheet
        open={sheet === "sokak"}
        title="Cadde / Sokak"
        group={nb ? `${nb.name} Mah.` : undefined}
        value={value.street_id}
        searchPlaceholder="Cadde / sokak ara"
        options={[
          ...streets.map((x) => ({ value: String(x.id), label: x.name })),
          { value: OTHER, label: "✏️ Listede yok, kendim yazacağım" },
        ]}
        onSelect={(v) => set({ street_id: v, street_text: v === OTHER ? value.street_text : "" })}
        freeText={{ label: (q) => `"${q}" olarak kullan`, onUse: (q) => set({ street_id: OTHER, street_text: q }) }}
        onClose={close}
      />

      {typing && !noStreetList && (
        <label className="block space-y-1 sm:col-span-2">
          <Lbl req>Cadde / sokak adı</Lbl>
          <input
            required
            autoFocus
            className="input"
            placeholder="Ör. Gül Sokak"
            value={value.street_text}
            onChange={(e) => set({ street_text: e.target.value })}
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-3">
        <label className="block space-y-1">
          <Lbl req>Dış kapı no</Lbl>
          <input required className="input" inputMode="text" maxLength={10} placeholder="Ör. 12" value={value.door_no} onChange={(e) => set({ door_no: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <Lbl>İç kapı (daire) no</Lbl>
          <input className="input" inputMode="text" maxLength={10} placeholder="Ör. 5" value={value.inner_no} onChange={(e) => set({ inner_no: e.target.value })} />
        </label>
        <label className="col-span-2 block space-y-1 sm:col-span-1">
          <Lbl>Apartman / site adı</Lbl>
          <input className="input" maxLength={80} placeholder="Ör. Güneş Apt." value={value.building} onChange={(e) => set({ building: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
