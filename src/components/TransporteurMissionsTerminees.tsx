import React, { useEffect, useRef, useState } from "react";
import { type CompletedMission, loadCompletedMissions } from "../lib/billing";

const money = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

export default function TransporteurMissionsTerminees({
  onGoToBilling,
  triggerSystemLog,
}: {
  onGoToBilling: () => void;
  triggerSystemLog: (msg: string, type: "success" | "info" | "warning" | "danger") => void;
}) {
  const logRef = useRef(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<CompletedMission[]>([]);

  useEffect(() => {
    let alive = true;
    loadCompletedMissions()
      .then((list) => {
        if (alive) setMissions(list);
      })
      .catch((err) => logRef.current(err?.message ?? "Chargement des missions impossible.", "danger"))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const toBill = missions.filter((m) => !m.invoiceNumero && m.prixHT != null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Missions dont la livraison a été confirmée par le donneur d'ordre.
        </p>
        {toBill > 0 && (
          <button
            onClick={onGoToBilling}
            className="px-4 py-2 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-xs font-black rounded-xl cursor-pointer"
          >
            🧾 {toBill} mission(s) à facturer — Aller à la facturation
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-5">
        {loading ? (
          <p className="text-xs text-slate-500">Chargement…</p>
        ) : missions.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune mission terminée pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400">
                  <th className="p-2">Offre</th>
                  <th className="p-2">Trajet</th>
                  <th className="p-2">Marchandise</th>
                  <th className="p-2">Donneur d'ordre</th>
                  <th className="p-2">Livraison</th>
                  <th className="p-2 text-right">Prix HT</th>
                  <th className="p-2">Facture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {missions.map((m) => (
                  <tr key={m.missionId}>
                    <td className="p-2 font-mono">n° {m.offerId}</td>
                    <td className="p-2 font-bold text-slate-900">{m.trajet}</td>
                    <td className="p-2">
                      {m.marchandise}
                      {m.poidsT ? ` · ${m.poidsT} t` : ""}
                    </td>
                    <td className="p-2">{m.donneurNom}</td>
                    <td className="p-2">{dmy(m.datePrestation)}</td>
                    <td className="p-2 text-right font-mono font-bold">
                      {m.prixHT == null ? "—" : `${money(m.prixHT)} DA`}
                    </td>
                    <td className="p-2">
                      {m.invoiceNumero ? (
                        <span className="font-mono font-bold text-emerald-700">n° {m.invoiceNumero}</span>
                      ) : (
                        <span className="text-amber-700 font-bold">À facturer</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
