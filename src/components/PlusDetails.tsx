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
 * Deux blocs facultatifs « Plus de détails » du formulaire de publication d'offre :
 *  - <PlusDetailsItineraire>  (section 1) : contact au chargement + destinataire
 *  - <PlusDetailsMarchandise> (section 2) : composition de la marchandise + poids précis
 * Les deux lisent et écrivent le même objet « value » (OfferPrivateDetailsInput).
 */
type Lang = "fr" | "ar";

const L = {
  fr: {
    title: "Plus de détails",
    optional: "(facultatif)",
    hintItin: "Ces informations figureront sur la lettre de voiture. Elles ne sont visibles que par vous, puis par le transporteur retenu.",
    hintMarch: "Ces informations figureront sur la lettre de voiture. Si vous indiquez un poids précis, il remplace le poids en tonnes pour la recherche de véhicules.",
    loadTitle: "Contact sur le lieu de chargement",
    loadName: "Nom de la personne à contacter",
    loadTel: "Téléphone du contact",
    destTitle: "Destinataire",
    destName: "Raison sociale ou nom et prénom",
    destTel: "Téléphone du destinataire",
    lines: "Composition de la marchandise",
    designation: "Désignation",
    unit: "Unité",
    qty: "Qté",
    add: "+ Ajouter une ligne",
    weight: "Poids total précis (kg)",
    remove: "Supprimer",
  },
  ar: {
    title: "مزيد من التفاصيل",
    optional: "(اختياري)",
    hintItin: "ستظهر هذه المعلومات في وثيقة النقل. لا يراها إلا أنت ثم الناقل المختار.",
    hintMarch: "ستظهر هذه المعلومات في وثيقة النقل. الوزن الدقيق يحل محل الوزن بالطن عند البحث عن المركبات.",
    loadTitle: "جهة الاتصال في مكان التحميل",
    loadName: "اسم الشخص المكلف",
    loadTel: "هاتف جهة الاتصال",
    destTitle: "المستلم",
    destName: "اسم الشركة أو الاسم واللقب",
    destTel: "هاتف المستلم",
    lines: "مكونات البضاعة",
    designation: "التسمية",
    unit: "الوحدة",
    qty: "الكمية",
    add: "+ إضافة سطر",
    weight: "الوزن الإجمالي الدقيق (كغ)",
    remove: "حذف",
  },
} as const;

const inputCls = "w-full rounded-lg border border-slate-300 px-2 py-2 text-sm";
const phoneFilter = (v: string) => v.replace(/[^0-9+\s.\-()]/g, "");
const numFilter = (v: string) => v.replace(/[^0-9.,]/g, "");

interface Props {
  value: OfferPrivateDetailsInput;
  onChange: (v: OfferPrivateDetailsInput) => void;
  lang?: Lang;
}

function Shell({
  lang,
  startOpen,
  hint,
  children,
}: {
  lang: Lang;
  startOpen: boolean;
  hint: string;
  children: React.ReactNode;
}) {
  const t = L[lang];
  const [open, setOpen] = useState(startOpen);
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-start text-xs font-extrabold text-slate-700">
        {open ? "▾" : "▸"} {t.title} <span className="font-medium text-slate-400">{t.optional}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-[11px] text-slate-500">{hint}</p>
          {children}
        </div>
      )}
    </div>
  );
}

/** Section 1 — Trajet & Itinéraire */
export function PlusDetailsItineraire({ value, onChange, lang = "fr" }: Props) {
  const t = L[lang];
  const set = (patch: Partial<OfferPrivateDetailsInput>) => onChange({ ...value, ...patch });
  const startOpen = Boolean(
    value.chargementContactNom || value.chargementContactTel || value.destinataireNom || value.destinataireTel,
  );
  return (
    <Shell lang={lang} startOpen={startOpen} hint={t.hintItin}>
      <div className="space-y-2">
        <div className="text-[10px] font-extrabold uppercase text-slate-600">{t.loadTitle}</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            className={inputCls}
            placeholder={t.loadName}
            maxLength={DEST_NAME_MAX}
            value={value.chargementContactNom}
            onChange={(e) => set({ chargementContactNom: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder={t.loadTel}
            inputMode="tel"
            value={value.chargementContactTel}
            onChange={(e) => set({ chargementContactTel: phoneFilter(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-extrabold uppercase text-slate-600">{t.destTitle}</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            className={inputCls}
            placeholder={t.destName}
            maxLength={DEST_NAME_MAX}
            value={value.destinataireNom}
            onChange={(e) => set({ destinataireNom: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder={t.destTel}
            inputMode="tel"
            value={value.destinataireTel}
            onChange={(e) => set({ destinataireTel: phoneFilter(e.target.value) })}
          />
        </div>
      </div>
    </Shell>
  );
}

/** Section 2 — Détail & Descriptif de la marchandise */
export function PlusDetailsMarchandise({ value, onChange, lang = "fr" }: Props) {
  const t = L[lang];
  const set = (patch: Partial<OfferPrivateDetailsInput>) => onChange({ ...value, ...patch });
  const setLine = (i: number, patch: Partial<OfferPrivateDetailsInput["lignes"][number]>) =>
    set({ lignes: value.lignes.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const startOpen = Boolean(value.poidsTotalKg || value.lignes.length > 0);

  return (
    <Shell lang={lang} startOpen={startOpen} hint={t.hintMarch}>
      <div className="space-y-2">
        <div className="text-[10px] font-extrabold uppercase text-slate-600">{t.lines}</div>
        {value.lignes.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              className={`${inputCls} col-span-6`}
              placeholder={t.designation}
              maxLength={DESIGNATION_MAX}
              value={l.designation}
              onChange={(e) => setLine(i, { designation: e.target.value })}
            />
            <input
              className={`${inputCls} col-span-2`}
              placeholder={t.qty}
              inputMode="decimal"
              value={l.quantite}
              onChange={(e) => setLine(i, { quantite: numFilter(e.target.value) })}
            />
            <select
              className={`${inputCls} col-span-3`}
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
        <span className="text-[10px] font-extrabold uppercase text-slate-600">{t.weight}</span>
        <input
          className={inputCls}
          inputMode="decimal"
          value={value.poidsTotalKg}
          onChange={(e) => set({ poidsTotalKg: numFilter(e.target.value) })}
        />
      </label>
    </Shell>
  );
}

export { hasDetails };
