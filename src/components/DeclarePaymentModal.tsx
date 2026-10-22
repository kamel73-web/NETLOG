import React, { useEffect, useRef, useState } from "react";
import {
  type Plan,
  type PayMode,
  type PaymentInstructions,
  loadPlans,
  loadPaymentInstructions,
  uploadProof,
  requestPayment,
} from "../lib/subscriptions";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;

const MODES: { value: PayMode; label: string }[] = [
  { value: "versement_especes", label: "Espèces versées sur le compte NETLOG" },
  { value: "virement", label: "Virement bancaire" },
  { value: "ccp", label: "Versement CCP" },
  { value: "baridimob", label: "BaridiMob" },
  { value: "cib", label: "Carte CIB" },
];
const money = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";
const labelCls = "text-[10px] uppercase font-bold text-slate-500 block mb-1";

export default function DeclarePaymentModal({
  member,
  onClose,
  triggerSystemLog,
}: {
  member: { id: string; nom: string; role: string };
  onClose: () => void;
  triggerSystemLog: Log;
}) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [instr, setInstr] = useState<PaymentInstructions | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [mois, setMois] = useState(1);
  const [mode, setMode] = useState<PayMode>("versement_especes");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadPlans(), loadPaymentInstructions()])
      .then(([all, ins]) => {
        if (!alive) return;
        const mine = all.filter((p) => p.actif && p.roles.includes(member.role));
        setPlans(mine);
        setPlanId(mine[0]?.id ?? null);
        setInstr(ins);
      })
      .catch((err) => logRef.current(err?.message ?? "Chargement impossible.", "danger"));
    return () => {
      alive = false;
    };
  }, [member.role]);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const ht = plan ? plan.prix_mensuel_ht * mois : 0;
  const tva = instr?.tva_pct ?? 0;
  const ttc = Math.round(ht * (1 + tva / 100) * 100) / 100;

  const submit = async () => {
    if (!planId) return logRef.current("Choisissez un forfait.", "warning");
    if (!reference.trim() && !file) return logRef.current("Indiquez la référence du versement ou joignez la preuve.", "warning");
    setBusy(true);
    try {
      const path = file ? await uploadProof(file) : undefined;
      await requestPayment({
        userId: member.id, planId, mois, mode,
        reference: reference.trim() || undefined, preuvePath: path,
      });
      logRef.current(`Paiement déclaré pour ${member.nom}. NETLOG vérifie le versement avant d'activer l'abonnement.`, "success");
      onClose();
    } catch (err: any) {
      logRef.current(err?.message ?? "Envoi impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Déclarer un paiement d'abonnement</h3>
          <button onClick={onClose} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">
            Fermer
          </button>
        </div>
        <p className="text-slate-500">
          Membre : <b className="text-slate-900">{member.nom}</b>. Le versement doit être effectué sur le compte de NETLOG,
          puis la preuve est vérifiée avant activation.
        </p>
        {instr && (instr.beneficiaire || instr.rib || instr.instructions) && (
          <div className="bg-slate-50 rounded-xl p-2 space-y-0.5">
            {instr.beneficiaire && <div>Bénéficiaire : <b>{instr.beneficiaire}</b></div>}
            {instr.rib && <div>RIB / CCP : <b className="font-mono">{instr.rib}</b></div>}
            {instr.instructions && <p className="text-slate-600 whitespace-pre-line">{instr.instructions}</p>}
          </div>
        )}
        {plans.length === 0 ? (
          <p className="text-slate-600">Aucun forfait n'est proposé pour ce type de compte.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Forfait</label>
                <select className={inputCls} value={planId ?? ""} onChange={(e) => setPlanId(Number(e.target.value))}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom} — {money(p.prix_mensuel_ht)} DA HT / mois</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Durée (mois)</label>
                <select className={inputCls} value={mois} onChange={(e) => setMois(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Mode de versement</label>
                <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as PayMode)}>
                  {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Référence du versement</label>
                <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Preuve (image ou PDF, 5 Mo max)</label>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="font-mono text-slate-600">
                HT {money(ht)} DA{tva > 0 ? ` · TVA ${tva} %` : ""} · <b className="text-slate-900">À verser {money(ttc)} DA</b>
              </div>
              <button disabled={busy} onClick={submit}
                className="px-4 py-2 bg-[#1D9E75] text-white font-black rounded-xl cursor-pointer disabled:opacity-50">
                Envoyer la déclaration
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
