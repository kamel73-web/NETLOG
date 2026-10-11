import React from "react";
import type { Invoice } from "../lib/billing";

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function below100(n: number, final: boolean): string {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return TENS[t] + (u === 1 ? " et un" : u ? "-" + UNITS[u] : "");
  }
  if (n < 80) {
    const r = n - 60;
    return "soixante" + (r === 11 ? " et onze" : "-" + UNITS[r]);
  }
  const r = n - 80;
  return r === 0 ? (final ? "quatre-vingts" : "quatre-vingt") : "quatre-vingt-" + UNITS[r];
}

function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let out = "";
  if (h > 0) {
    out = h === 1 ? "cent" : UNITS[h] + " cent" + (r === 0 && final ? "s" : "");
    if (r > 0) out += " ";
  }
  if (r > 0 || h === 0) out += below100(r, final);
  return out;
}

function numberToFrench(n: number): string {
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1e3);
  const rest = n % 1e3;
  if (billions) parts.push(below1000(billions, false) + (billions > 1 ? " milliards" : " milliard"));
  if (millions) parts.push(below1000(millions, false) + (millions > 1 ? " millions" : " million"));
  if (thousands) parts.push(thousands === 1 ? "mille" : below1000(thousands, false) + " mille");
  if (rest) parts.push(below1000(rest, true));
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  const total = Math.round(amount * 100);
  const dinars = Math.floor(total / 100);
  const cents = total % 100;
  let s = `${numberToFrench(dinars)} dinar${dinars > 1 ? "s" : ""} algérien${dinars > 1 ? "s" : ""}`;
  if (cents > 0) s += ` et ${numberToFrench(cents)} centime${cents > 1 ? "s" : ""}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const money = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");
const MODES: Record<string, string> = {
  especes: "Espèces",
  cheque: "Chèque",
  virement: "Virement",
  traite: "Traite (effet de commerce)",
};

const Line = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <div>
      <span className="text-slate-500">{label} : </span>
      <span className="font-semibold">{value}</span>
    </div>
  ) : null;

export default function FactureDocument({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const e = invoice.emetteur || {};
  const c = invoice.client || {};
  const isTva = e.regime === "tva";
  const lines = invoice.lines.filter((l) => l.active || invoice.status === "annulee");

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 overflow-auto p-4">
      <style>{`@media print {
        body * { visibility: hidden; }
        #facture-print, #facture-print * { visibility: visible; }
        #facture-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
        .no-print { display: none !important; }
      }`}</style>
      <div className="max-w-3xl mx-auto">
        <div className="no-print flex justify-end gap-2 mb-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#1D9E75] text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            🖨️ Imprimer / Enregistrer en PDF
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-white text-slate-700 text-xs font-bold rounded-xl cursor-pointer">
            Fermer
          </button>
        </div>

        <div id="facture-print" className="bg-white text-slate-900 p-8 text-[12px] leading-relaxed shadow-xl">
          {invoice.status === "annulee" && (
            <div className="mb-4 border-2 border-rose-500 text-rose-600 font-black text-center py-2 uppercase">
              Facture annulée{invoice.motif_annulation ? ` — ${invoice.motif_annulation}` : ""}
            </div>
          )}

          <div className="flex justify-between gap-6">
            <div className="space-y-0.5">
              <div className="text-base font-black uppercase">{e.raison_sociale}</div>
              <div>{e.adresse}</div>
              <Line label="Tél" value={e.telephone} />
              <Line label="NIF" value={e.nif} />
              <Line label="N° RC" value={e.nrc} />
              <Line label="NIS" value={e.nis} />
              <Line label="Article d'imposition" value={e.article_imposition} />
              <Line label="RIB / CCP" value={e.rib} />
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-xl font-black tracking-wide">FACTURE</div>
              <div className="font-bold">N° {invoice.numero}</div>
              <div>Date d'émission : {dmy(invoice.date_emission)}</div>
              <div>{invoice.date_echeance ? `Échéance : ${dmy(invoice.date_echeance)}` : "Paiement comptant"}</div>
            </div>
          </div>

          <div className="mt-6 border border-slate-300 rounded p-3 space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-slate-500">Facturé à</div>
            <div className="font-black uppercase">{c.raison_sociale}</div>
            <div>{c.adresse}</div>
            <Line label="NIF" value={c.nif} />
            <Line label="N° RC" value={c.nrc} />
          </div>

          <table className="w-full mt-6 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 p-2">Désignation</th>
                <th className="border border-slate-300 p-2 w-24">Date</th>
                <th className="border border-slate-300 p-2 w-14 text-right">Qté</th>
                <th className="border border-slate-300 p-2 w-28 text-right">P.U. HT</th>
                <th className="border border-slate-300 p-2 w-28 text-right">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="border border-slate-300 p-2">{l.designation}</td>
                  <td className="border border-slate-300 p-2">{dmy(l.date_prestation)}</td>
                  <td className="border border-slate-300 p-2 text-right">{l.quantite}</td>
                  <td className="border border-slate-300 p-2 text-right">{money(l.prix_unitaire_ht)}</td>
                  <td className="border border-slate-300 p-2 text-right">{money(l.montant_ht)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <table className="w-72 border-collapse">
              <tbody>
                <tr>
                  <td className="p-1.5">Total HT</td>
                  <td className="p-1.5 text-right font-semibold">{money(invoice.montant_ht)} DA</td>
                </tr>
                {isTva ? (
                  <tr>
                    <td className="p-1.5">TVA ({invoice.taux_tva} %)</td>
                    <td className="p-1.5 text-right font-semibold">{money(invoice.montant_tva)} DA</td>
                  </tr>
                ) : (
                  <tr>
                    <td className="p-1.5 text-slate-500" colSpan={2}>TVA non applicable</td>
                  </tr>
                )}
                {invoice.timbre_fiscal > 0 && (
                  <tr>
                    <td className="p-1.5">Droit de timbre</td>
                    <td className="p-1.5 text-right font-semibold">{money(invoice.timbre_fiscal)} DA</td>
                  </tr>
                )}
                <tr className="border-t-2 border-slate-900">
                  <td className="p-1.5 font-black">{isTva ? "Total TTC" : "Total à payer"}</td>
                  <td className="p-1.5 text-right font-black">{money(invoice.montant_ttc)} DA</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4">
            Arrêtée la présente facture à la somme de : <b>{amountInWords(invoice.montant_ttc)}</b>.
          </p>
          <p className="mt-1">
            Mode de règlement : <b>{MODES[invoice.mode_reglement_prevu] ?? invoice.mode_reglement_prevu}</b>
          </p>
          {invoice.status === "payee" && (
            <p className="mt-1 font-bold text-emerald-700">
              Acquittée le {dmy(invoice.paid_at)}
              {invoice.mode_reglement_effectif ? ` — ${MODES[invoice.mode_reglement_effectif]}` : ""}
              {invoice.reference_reglement ? ` (réf. ${invoice.reference_reglement})` : ""}
            </p>
          )}
          {invoice.notes && <p className="mt-2 text-slate-600">{invoice.notes}</p>}
          {e.mentions_legales && <p className="mt-6 text-[10px] text-slate-500 whitespace-pre-line">{e.mentions_legales}</p>}
        </div>
      </div>
    </div>
  );
}
