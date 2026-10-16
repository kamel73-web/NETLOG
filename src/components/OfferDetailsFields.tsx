import React, { useState } from "react";
import {
  DEST_NAME_MAX,
  DESIGNATION_MAX,
  GOODS_LINES_MAX,
  GoodsUnit,
  OfferPrivateDetailsInput,
  UNITS,
  hasDetails,
} from "../lib/ldv";

/**
 * Bloc FACULTATIF du formulaire de publication d'offre.
 * Usage dans le formulaire parent :
 *   const [details, setDetails] = useState(EMPTY_DETAILS);
 *   <OfferDetailsFields value={details} onChange={setDetails} lang={lang} />
 *   // après l'insertion de l'offre (id retourné) :
 *   if (hasDetails(details)) await savePrivateDetails(newOffer.id, details);
 */
const L = {
  fr: {
    title: "Détails de l'expédition (facultatif)",
    hint: "Ces informations figureront sur la lettre de voiture. Elles ne sont visibles que par vous, puis par le transporteur retenu.",
    lines: "Composition de la marchandise",
    designation: "Désignation",
    unit: "Unité",
    qty: "Qté",
    add: "+ Ajouter une ligne",
    weight: "Poids total précis (kg)",
    dest: "Destinataire",
    destName: "Raison sociale ou nom et prénom",
    destTel: "Téléphone du destinataire",
    remove: "Supprimer",
  },
  ar: {
    title: "تفاصيل الشحنة (اختياري)",
    hint: "ستظهر هذه المعلومات في وثيقة النقل. لا يراها إلا أنت ثم الناقل المختار.",
    lines: "مكونات البضاعة",
    designation: "التسمية",
    unit: "الوحدة",
    qty: "الكمية",
    add: "+ إضافة سطر",
    weight: "الوزن الإجمالي الدقيق (كغ)",
    dest: "المستلم",
    destName: "اسم الشركة أو الاسم واللقب",
    destTel: "هاتف المستلم",
    remove: "حذف",
  },
} as const;

export default function OfferDetailsFields({
  value,
  onChange,
  lang = "fr",
}: {
  value: OfferPrivateDetailsInput;
  onChange: (v: OfferPrivateDetailsInput) => void;
  lang?: "fr" | "ar";
}) {
  const t = L[lang];
  const [open, setOpen] = useState(hasDetails(value));
  const set = (patch: Partial<OfferPrivateDetailsInput>) => onChange({ ...value, ...patch });
  const setLine = (i: number, patch: Partial<OfferPrivateDetailsInput["lignes"][number]>) =>
    set({ lignes: value.lignes.map((l, k) => (k === i ? { ...l, ...patch } : l)) });

  const input = "w-full rounded-lg border border-slate-300 px-2 py-2 text-sm";

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="rounded-xl border border-slate-200 p-3">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-start text-sm font-bold">
        {open ? "▾" : "▸"} {t.title}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-slate-500">{t.hint}</p>

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase text-slate-600">{t.lines}</div>
            {value.lignes.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  className={`${input} col-span-6`}
                  placeholder={t.designation}
                  maxLength={DESIGNATION_MAX}
                  value={l.designation}
                  onChange={(e) => setLine(i, { designation: e.target.value })}
                />
                <input
                  className={`${input} col-span-2`}
                  placeholder={t.qty}
                  inputMode="decimal"
                  value={l.quantite}
                  onChange={(e) => setLine(i, { quantite: e.target.value.replace(/[^0-9.,]/g, "") })}
                />
                <select
                  className={`${input} col-span-3`}
                  aria-label={t.unit}
                  value={l.unite}
                  onChange={(e) => setLine(i, { unite: e.target.value as GoodsUnit })}
                >
                  {(Object.keys(UNITS) as GoodsUnit[]).map((u) => (
                    <option key={u} value={u}>
                      {UNITS[u][0]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={t.remove}
                  className="col-span-1 text-rose-600"
                  onClick={() => set({ lignes: value.lignes.filter((_, k) => k !== i) })}
                >
                  ✕
                </button>
              </div>
            ))}
            {value.lignes.length < GOODS_LINES_MAX && (
              <button
                type="button"
                className="text-sm font-bold text-emerald-700"
                onClick={() => set({ lignes: [...value.lignes, { designation: "", unite: "palette", quantite: "" }] })}
              >
                {t.add}
              </button>
            )}
          </div>

          <label className="block text-sm">
            <span className="text-xs font-bold uppercase text-slate-600">{t.weight}</span>
            <input
              className={input}
              inputMode="decimal"
              value={value.poidsTotalKg}
              onChange={(e) => set({ poidsTotalKg: e.target.value.replace(/[^0-9.,]/g, "") })}
            />
          </label>

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase text-slate-600">{t.dest}</div>
            <input
              className={input}
              placeholder={t.destName}
              maxLength={DEST_NAME_MAX}
              value={value.destinataireNom}
              onChange={(e) => set({ destinataireNom: e.target.value })}
            />
            <input
              className={input}
              placeholder={t.destTel}
              inputMode="tel"
              value={value.destinataireTel}
              onChange={(e) => set({ destinataireTel: e.target.value.replace(/[^0-9+\s.\-()]/g, "") })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
