import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type NetworkMember,
  type EarningRow,
  type Payout,
  loadMyNetwork,
  loadMyEarnings,
  loadMyPayouts,
  loadMyReferral,
} from "../lib/commercial";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;
type Tab = "reseau" | "gains" | "reglements";

const money = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const SOURCE: Record<string, string> = {
  abonnement: "Abonnement",
  commission_transporteur: "Commission — transporteur",
  commission_donneur: "Commission — donneur d'ordre",
  commission_publieur: "Commission — offre publiée",
};
const STATUT: Record<string, string> = { a_payer: "À régler", releve: "Relevé", paye: "Payé" };
const ROLE: Record<string, string> = {
  donneur_ordre: "Donneur d'ordre",
  transporteur: "Transporteur",
  commissionnaire: "Commissionnaire",
  manutentionnaire: "Manutentionnaire",
  stockage: "Stockage",
};

export default function CommercialEspace({ currentUser, triggerSystemLog }: { currentUser: any; triggerSystemLog: Log }) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;

  const [tab, setTab] = useState<Tab>("gains");
  const [loading, setLoading] = useState(true);
  const [network, setNetwork] = useState<NetworkMember[]>([]);
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [month, setMonth] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([loadMyNetwork(), loadMyEarnings(), loadMyPayouts(), loadMyReferral()])
      .then(([n, e, p, c]) => {
        if (!alive) return;
        setNetwork(n);
        setEarnings(e);
        setPayouts(p);
        setCode(c);
      })
      .catch((err) => logRef.current(err?.message ?? "Chargement impossible.", "danger"))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const months = useMemo(
    () => Array.from(new Set(earnings.map((e) => e.created_at.slice(0, 7)))).sort().reverse(),
    [earnings],
  );
  const shown = month ? earnings.filter((e) => e.created_at.slice(0, 7) === month) : earnings;
  const aRegler = earnings.filter((e) => e.statut === "a_payer").reduce((s, e) => s + e.montant_ht, 0);
  const paye = payouts.reduce((s, p) => s + p.montant_ht, 0);
  const abosActifs = network.filter((m) => m.abonnement_actif).length;
  const totalShown = shown.reduce((s, e) => s + e.montant_ht, 0);
  const name = currentUser?.raisonSociale || [currentUser?.prenom, currentUser?.nom].filter(Boolean).join(" ");

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      logRef.current("Code copié.", "success");
    } catch {
      logRef.current(`Votre code : ${code}`, "info");
    }
  };

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
        tab === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <style>{`
        .print-only { display: none; }
        @media print {
          body * { visibility: hidden; }
          #releve-print, #releve-print * { visibility: visible; }
          #releve-print { position: absolute; left: 0; top: 0; width: 100%; }
          .print-only { display: block; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-white border border-slate-100 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">Espace commercial</h2>
          <p className="text-[11px] text-slate-500">{name}</p>
        </div>
        <div className="text-xs flex items-center gap-2">
          <span className="text-slate-500">Mon code de recommandation :</span>
          <b className="font-mono text-slate-900">{code ?? "non attribué"}</b>
          {code && (
            <button onClick={copy} className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold cursor-pointer">
              Copier
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">À régler (HT)</span>
          <span className="text-lg font-black font-mono text-amber-600">{money(aRegler)} DA</span>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Déjà réglé (HT)</span>
          <span className="text-lg font-black font-mono text-emerald-700">{money(paye)} DA</span>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Membres de mon réseau</span>
          <span className="text-lg font-black font-mono text-slate-900">{network.length}</span>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Abonnements actifs</span>
          <span className="text-lg font-black font-mono text-slate-900">{abosActifs}</span>
        </div>
      </div>

      <div className="flex gap-2 no-print">
        {tabBtn("gains", "Mes gains")}
        {tabBtn("reseau", "Mon réseau")}
        {tabBtn("reglements", "Mes règlements")}
      </div>

      {loading && <p className="text-xs text-slate-500">Chargement…</p>}

      {!loading && tab === "gains" && (
        <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 no-print">
            <select value={month} onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs">
              <option value="">Tous les mois</option>
              {months.map((m) => <option key={m} value={m}>{m.split("-").reverse().join("/")}</option>)}
            </select>
            <button onClick={() => window.print()} className="px-4 py-2 bg-[#1D9E75] text-white font-bold rounded-xl cursor-pointer">
              🖨️ Imprimer le relevé
            </button>
          </div>
          <div id="releve-print" className="space-y-3">
            <div className="print-only">
              <h3 className="text-base font-black">Relevé de rémunération</h3>
              <p>{name} — période : {month ? month.split("-").reverse().join("/") : "toutes les périodes"}</p>
              <p>Montants hors taxes. Ce relevé sert de base à votre facture.</p>
            </div>
            {shown.length === 0 ? (
              <p className="text-slate-500">
                Aucun gain pour le moment. Un gain est enregistré à la confirmation de livraison d'une mission d'un
                transporteur de votre réseau, ou à la validation d'un abonnement de l'un de vos membres.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400">
                      <th className="p-2">Date</th>
                      <th className="p-2">Origine</th>
                      <th className="p-2">Membre</th>
                      <th className="p-2 text-right">Base HT</th>
                      <th className="p-2 text-right">Part</th>
                      <th className="p-2 text-right">Montant HT</th>
                      <th className="p-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {shown.map((e) => (
                      <tr key={e.id}>
                        <td className="p-2">{dmy(e.created_at)}</td>
                        <td className="p-2">
                          {SOURCE[e.source] ?? e.source}
                          {e.special && <span className="ml-1 text-[9px] font-black text-purple-700">SPÉCIALE</span>}
                          {e.plafonne && <span className="ml-1 text-[9px] font-black text-amber-700">PLAFONNÉE</span>}
                        </td>
                        <td className="p-2">{e.membre}</td>
                        <td className="p-2 text-right font-mono">{money(e.base_ht)}</td>
                        <td className="p-2 text-right font-mono">
                          {e.taux_pct > 0 ? `${e.taux_pct} %` : ""}{e.taux_pct > 0 && e.fixe_ht > 0 ? " + " : ""}{e.fixe_ht > 0 ? `${money(e.fixe_ht)} DA` : ""}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">{money(e.montant_ht)}</td>
                        <td className="p-2">{STATUT[e.statut] ?? e.statut}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-900">
                      <td className="p-2 font-black" colSpan={5}>Total</td>
                      <td className="p-2 text-right font-mono font-black">{money(totalShown)} DA</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && tab === "reseau" && (
        <div className="bg-white border border-slate-100 rounded-3xl p-5 text-xs">
          {network.length === 0 ? (
            <p className="text-slate-500">
              Aucun membre dans votre réseau. Vos recrues doivent indiquer votre code de recommandation à l'inscription,
              ou être rattachées par NETLOG.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400">
                    <th className="p-2">Membre</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Compte</th>
                    <th className="p-2">Inscrit le</th>
                    <th className="p-2">Abonnement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {network.map((m) => (
                    <tr key={m.member_id}>
                      <td className="p-2 font-bold">{m.nom}</td>
                      <td className="p-2">{ROLE[m.role] ?? m.role}</td>
                      <td className="p-2">{m.statut_compte === "valide" ? "Validé" : m.statut_compte === "en_attente" ? "En attente" : m.statut_compte}</td>
                      <td className="p-2">{dmy(m.inscrit_le)}</td>
                      <td className="p-2">
                        {m.abonnement_actif
                          ? `Actif${m.abonnement_fin ? ` jusqu'au ${dmy(m.abonnement_fin)}` : ""}`
                          : <span className="text-rose-600 font-bold">Inactif</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === "reglements" && (
        <div className="bg-white border border-slate-100 rounded-3xl p-5 text-xs">
          {payouts.length === 0 ? (
            <p className="text-slate-500">Aucun règlement pour le moment.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400">
                  <th className="p-2">Date</th>
                  <th className="p-2">Gains jusqu'au</th>
                  <th className="p-2 text-right">Lignes</th>
                  <th className="p-2 text-right">Montant HT</th>
                  <th className="p-2">Référence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2">{dmy(p.created_at)}</td>
                    <td className="p-2">{dmy(p.periode_fin)}</td>
                    <td className="p-2 text-right">{p.nb_lignes}</td>
                    <td className="p-2 text-right font-mono font-bold">{money(p.montant_ht)} DA</td>
                    <td className="p-2">{p.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
