"use client";
import type { DeliveryAreas } from "@/lib/data/areas";

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

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block space-y-1">
        <Lbl>İl</Lbl>
        <select disabled className="input bg-bg font-semibold text-ink opacity-100" value="tekirdag">
          <option value="tekirdag">Tekirdağ</option>
        </select>
      </label>

      <label className="block space-y-1">
        <Lbl req>İlçe</Lbl>
        <select
          required
          className="input"
          value={value.district_id}
          onChange={(e) => set({ district_id: e.target.value, neighborhood_id: "", street_id: "", street_text: "" })}
        >
          {areas.districts.map((d) => (
            <option key={d.id} value={d.id} disabled={!d.is_active}>
              {d.name}
              {d.is_active ? "" : " — yakında"}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <Lbl req>Mahalle</Lbl>
        <select
          required
          className="input"
          value={value.neighborhood_id}
          onChange={(e) => set({ neighborhood_id: e.target.value, street_id: "", street_text: "" })}
        >
          <option value="">Mahalle seç</option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} Mah.
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <Lbl req>Cadde / Sokak</Lbl>
        {noStreetList ? (
          <input
            required
            className="input"
            placeholder="Cadde / sokak adını yaz"
            value={value.street_text}
            onChange={(e) => set({ street_id: OTHER, street_text: e.target.value })}
          />
        ) : (
          <select
            required
            disabled={!value.neighborhood_id}
            className="input disabled:opacity-50"
            value={value.street_id}
            onChange={(e) => set({ street_id: e.target.value, street_text: "" })}
          >
            <option value="">{value.neighborhood_id ? "Cadde / sokak seç" : "Önce mahalle seç"}</option>
            {streets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            {value.neighborhood_id && <option value={OTHER}>✏️ Listede yok, kendim yazacağım</option>}
          </select>
        )}
      </label>

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
