import React from "react";
import type { ShareRule } from "../lib/commissions";

const LINES: { label: string; keys: string[]; base: string }[] = [
  { label: "Abonnement d'un membre rattaché à un commercial", keys: ["abonnement"], base: "du montant HT de l'abonnement" },
  { label: "Cas 1 — donneur d'ordre dans le même réseau", keys: ["meme_reseau_transporteur"], base: "de la commission" },
  { label: "Cas 2 — donneur d'ordre d'un autre commercial", keys: ["reseaux_differents_transporteur", "reseaux_differents_donneur"], base: "de la commission" },
  { label: "Cas 3 — offre publiée par NETLOG", keys: ["offre_netlog_transporteur"], base: "de la commission" },
  { label: "Cas 4 — offre publiée par un commercial", keys: ["offre_commercial_publieur", "offre_commercial_transporteur"], base: "de la commission" },
];
const fmt = (v: number) => Number(v.toFixed(4)).toLocaleString("fr-FR");

export default function NetlogShareSummary({ rules }: { rules: ShareRule[] }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-2 text-xs">
      <span className="text-xs font-black uppercase text-slate-800">Ce que NETLOG conserve</span>
      <p className="text-[11px] text-slate-500">
        La part de NETLOG est ce qui reste après les parts des commerciaux. Sans commercial rattaché, NETLOG conserve 100 %.
        Les valeurs affichées sont celles enregistrées.
      </p>
      {LINES.map((l) => {
        const rs = rules.filter((r) => l.keys.includes(r.key));
        const pct = rs.reduce((s, r) => s + r.pct, 0);
        const fixe = rs.reduce((s, r) => s + r.fixe, 0);
        const net = 100 - pct;
        const over = net < 0;
        return (
          <div key={l.label} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 pb-1.5">
            <span className="text-slate-700">{l.label}</span>
            <span className={over ? "text-rose-600 font-bold" : "text-slate-900"}>
              NETLOG conserve <b className="font-mono">{fmt(net)} %</b>
              {fixe > 0 ? <> moins <b className="font-mono">{fmt(fixe)} DA</b></> : null} {l.base}
              {over ? " — les parts dépassent 100 % : elles seront plafonnées" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
