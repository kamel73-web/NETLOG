import React, { useEffect, useRef, useState } from "react";
import {
  type Plan,
  type SubPayment,
  type PayMode,
  type PaymentInstructions,
  loadMyRole,
  loadPlans,
  loadMyPayments,
  loadPaymentInstructions,
  uploadProof,
  requestPayment,
} from "../lib/subscriptions";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;

const MODES: { value: PayMode; label: string }[] = [
  { value: "virement", label: "Virement bancaire" },
  { value: "ccp", label: "Versement CCP" },
  { value: "baridimob", label: "BaridiMob" },
  { value: "cib", label: "Carte CIB" },
  { value: "versement_especes", label: "Espèces versées sur le compte NETLOG" },
];
const money = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";
const labelCls = "text-[10px] uppercase font-bold text-slate-500 block mb-1";

export default function ActivationScreen({
  currentUser,
  onRefresh,
  onSignOut,
  triggerSystemLog,
}: {
  currentUser: any;
  onRefresh: () => Promise<void> | void;
  onSignOut: () => void;
  triggerSystemLog: Log;
}) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const log: Log = (m, t) => logRef.current(m, t);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<SubPayment[]>([]);
  const [instr, setInstr] = useState<PaymentInstructions | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [mois, setMois] = useState(1);
  const [mode, setMode] = useState<PayMode>("virement");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const refresh = async () => {
    try {
      const [role, allPlans, pays, ins] = await Promise.all([
        loadMyRole(),
        loadPlans(),
        loadMyPayments(),
        loadPaymentInstructions(),
      ]);
      const mine = allPlans.filter((p) => p.actif && role && p.roles.includes(role));
      setPlans(mine);
      setPayments(pays);
      setInstr(ins);
      setPlanId((cur) => cur ?? mine[0]?.id ?? null);
    } catch (err: any) {
      log(err?.message ?? "Chargement impossible.", "danger");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const ht = plan ? plan.prix_mensuel_ht * mois : 0;
  const tva = instr?.tva_pct ?? 0;
  const ttc = Math.round(ht * (1 + tva / 100) * 100) / 100;
  const pending = payments.find((p) => p.statut === "en_attente");
  const lastRefused = payments.find((p) => p.statut === "refusee");

  const submit = async () => {
    if (!planId) {
      log("Choisissez un forfait.", "warning");
      return;
    }
    if (!reference.trim() && !file) {
      log("Indiquez la référence du versement ou joignez la preuve.", "warning");
      return;
    }
    setBusy(true);
    try {
      const path = file ? await uploadProof(file) : undefined;
      await requestPayment({
        userId: currentUser.id,
        planId,
        mois,
        mode,
        reference: reference.trim() || undefined,
        preuvePath: path,
      });
      log("Preuve envoyée. NETLOG vérifie votre paiement et active votre compte.", "success");
      setReference("");
      setFile(null);
      await refresh();
    } catch (err: any) {
      log(err?.message ?? "Envoi impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75]">Activation de votre compte</span>
        <h2 className="text-base font-black text-slate-900">
          Bienvenue {currentUser?.raisonSociale || currentUser?.prenom}
        </h2>
        <p className="text-xs text-slate-500">
          Votre compte est créé. Il sera activé par NETLOG après vérification du paiement de votre abonnement.
          Choisissez votre forfait, effectuez le paiement sur le compte NETLOG, puis envoyez la preuve ci-dessous.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={async () => {
              await onRefresh();
            }}
            className="px-4 py-2 bg-[#1D9E75] text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            🔄 Vérifier l'état de mon compte
          </button>
          <button onClick={onSignOut} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">
            Se déconnecter
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 text-center">Chargement…</p>
      ) : (
        <>
          {pending && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
              <b>⏳ Paiement en cours de vérification</b>
              <p>
                {pending.plan_nom} · {pending.mois} mois · {money(pending.montant_ttc)} DA — envoyé le{" "}
                {pending.created_at.slice(0, 10).split("-").reverse().join("/")}. Vous serez activé dès la validation.
              </p>
            </div>
          )}
          {!pending && lastRefused && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 space-y-1">
              <b>Dernier paiement refusé</b>
              <p>{lastRefused.decision_note || "Aucun motif indiqué."} Vous pouvez envoyer une nouvelle preuve.</p>
            </div>
          )}

          {instr && (instr.beneficiaire || instr.rib || instr.instructions) && (
            <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-1 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Où payer</span>
              {instr.beneficiaire && <div>Bénéficiaire : <b>{instr.beneficiaire}</b></div>}
              {instr.rib && <div>RIB / CCP : <b className="font-mono">{instr.rib}</b></div>}
              {instr.instructions && <p className="text-slate-600 whitespace-pre-line">{instr.instructions}</p>}
            </div>
          )}

          {plans.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-5 text-xs text-slate-600">
              Aucun forfait n'est encore proposé pour votre type de compte. Contactez NETLOG.
            </div>
          ) : (
            !pending && (
              <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-4">
                <span className="text-xs font-black uppercase text-slate-800">Votre paiement</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Forfait</label>
                    <select className={inputCls} value={planId ?? ""} onChange={(e) => setPlanId(Number(e.target.value))}>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nom} — {money(p.prix_mensuel_ht)} DA HT / mois
                        </option>
                      ))}
                    </select>
                    {plan?.description && <p className="text-[10px] text-slate-500 mt-1">{plan.description}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Durée (mois)</label>
                    <select className={inputCls} value={mois} onChange={(e) => setMois(Number(e.target.value))}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Mode de paiement</label>
                    <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as PayMode)}>
                      {MODES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Référence du versement</label>
                    <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Preuve de paiement (image ou PDF, 5 Mo max)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="text-xs text-slate-600 font-mono">
                    HT {money(ht)} DA{tva > 0 ? ` · TVA ${tva} %` : ""} · <b className="text-slate-900">À payer {money(ttc)} DA</b>
                  </div>
                  <button
                    disabled={busy}
                    onClick={submit}
                    className="px-5 py-2.5 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Envoyer la preuve de paiement
                  </button>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
