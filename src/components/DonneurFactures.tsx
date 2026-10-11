import React, { useState } from "react";
import { type Invoice, invoiceDisplayStatus } from "../lib/billing";
import FactureDocument from "./FactureDocument";

const money = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const TONE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  late: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};
type Filter = "toutes" | "attente" | "retard" | "payees";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "toutes", label: "Toutes" },
  { key: "attente", label: "En attente" },
  { key: "retard", label: "En retard" },
  { key: "payees", label: "Payées" },
];

export default function DonneurFactures({ invoices, loading }: { invoices: Invoice[]; loading: boolean }) {
  const [filter, setFilter] = useState<Filter>("toutes");
  const [view, setView] = useState<Invoice | null>(null);

  const live = invoices.filter((i) => i.status !== "annulee");
  const aPayer = live.filter((i) => i.status === "emise").reduce((s, i) => s + i.montant_ttc, 0);
  const enRetard = live.filter((i) => invoiceDisplayStatus(i).tone === "late").reduce((s, i) => s + i.montant_ttc, 0);
  const paye = live.filter((i) => i.status === "payee").reduce((s, i) => s + i.montant_ttc, 0);

  const shown = invoices.filter((i) => {
    const tone = invoiceDisplayStatus(i).tone;
    if (filter === "attente") return tone === "pending";
    if (filter === "retard") return tone === "late";
    if (filter === "payees") return tone === "paid";
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">Factures reçues</h2>
        <p className="text-[11px] text-slate-500">
          Le règlement s'effectue directement auprès du transporteur (coordonnées et RIB sur la facture). C'est lui
          qui enregistre la réception du paiement.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">À payer (TTC)</span>
          <span className="text-lg font-black font-mono text-slate-900">{money(aPayer)} DA</span>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-rose-500 block">Dont en retard</span>
          <span className="text-lg font-black font-mono text-rose-600">{money(enRetard)} DA</span>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block">Payé</span>
          <span className="text-lg font-black font-mono text-emerald-700">{money(paye)} DA</span>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit text-xs font-bold">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg cursor-pointer ${filter === f.key ? "bg-slate-900 text-white" : "text-slate-500"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-5">
        {loading ? (
          <p className="text-xs text-slate-500">Chargement…</p>
        ) : shown.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune facture.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400">
                  <th className="p-2">N°</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Émetteur</th>
                  <th className="p-2 text-right">Missions</th>
                  <th className="p-2 text-right">Total TTC</th>
                  <th className="p-2">Échéance</th>
                  <th className="p-2">Statut</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shown.map((inv) => {
                  const st = invoiceDisplayStatus(inv);
                  return (
                    <tr key={inv.id}>
                      <td className="p-2 font-mono font-bold">{inv.numero}</td>
                      <td className="p-2">{dmy(inv.date_emission)}</td>
                      <td className="p-2">{inv.emetteur?.raison_sociale}</td>
                      <td className="p-2 text-right">{inv.lines.length}</td>
                      <td className="p-2 text-right font-mono font-bold">{money(inv.montant_ttc)} DA</td>
                      <td className="p-2">{inv.date_echeance ? dmy(inv.date_echeance) : "Comptant"}</td>
                      <td className="p-2">
                        <span className={`border px-2 py-0.5 rounded-full text-[10px] font-black ${TONE[st.tone]}`}>{st.label}</span>
                      </td>
                      <td className="p-2 text-right">
                        <button onClick={() => setView(inv)} className="px-2 py-1 border border-slate-200 rounded-lg font-bold cursor-pointer">
                          👁 Voir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {view && <FactureDocument invoice={view} onClose={() => setView(null)} />}
    </div>
  );
}
