import React, { useEffect, useRef, useState } from "react";
import { type RevenueLine, loadRevenue } from "../lib/commissions";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;

const money = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LABEL: Record<string, string> = { abonnements: "Abonnements", commissions: "Commissions sur missions" };
const monthRange = (ym: string): [string, string] => {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`];
};

export default function AdminRevenue({ triggerSystemLog }: { triggerSystemLog: Log }) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const [period, setPeriod] = useState<string>(new Date().toISOString().slice(0, 7));
  const [lines, setLines] = useState<RevenueLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const [from, to] = period ? monthRange(period) : [null, null];
    loadRevenue(from, to)
      .then((l) => {
        if (alive) setLines(l);
      })
      .catch((err) => logRef.current(err?.message ?? "Chargement impossible.", "danger"))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [period]);

  const total = lines.reduce(
    (t, l) => ({ brut: t.brut + l.brut, parts: t.parts + l.parts, net: t.net + l.net }),
    { brut: 0, parts: 0, net: 0 },
  );

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black uppercase text-slate-800">Recettes de NETLOG (hors taxes)</span>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs" />
        <button onClick={() => setPeriod("")} className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold cursor-pointer">
          Tout
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Recette brute : abonnements validés et commissions prélevées sur les transporteurs. Net NETLOG : ce qui reste après
        les parts des commerciaux.
      </p>
      {loading ? (
        <p className="text-slate-500">Chargement…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400">
                <th className="p-2">Source</th>
                <th className="p-2 text-right">Nombre</th>
                <th className="p-2 text-right">Recette brute</th>
                <th className="p-2 text-right">Parts des commerciaux</th>
                <th className="p-2 text-right">Net NETLOG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.map((l) => (
                <tr key={l.source}>
                  <td className="p-2 font-bold">{LABEL[l.source] ?? l.source}</td>
                  <td className="p-2 text-right font-mono">{l.nb}</td>
                  <td className="p-2 text-right font-mono">{money(l.brut)} DA</td>
                  <td className="p-2 text-right font-mono">{money(l.parts)} DA</td>
                  <td className="p-2 text-right font-mono font-black text-emerald-700">{money(l.net)} DA</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-900">
                <td className="p-2 font-black">Total</td>
                <td className="p-2"></td>
                <td className="p-2 text-right font-mono font-black">{money(total.brut)} DA</td>
                <td className="p-2 text-right font-mono font-black">{money(total.parts)} DA</td>
                <td className="p-2 text-right font-mono font-black text-emerald-700">{money(total.net)} DA</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
