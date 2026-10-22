import React, { useEffect, useRef, useState } from "react";
import { ProfileType } from "../types";
import {
  type Plan,
  type SubPayment,
  type SubSummary,
  type PayMode,
  type PaymentInstructions,
  loadMyRole,
  loadPlans,
  loadMyPayments,
  loadPaymentInstructions,
  loadMySubscription,
  loadWalletForSubscription,
  payWithWallet,
  uploadProof,
  requestPayment,
} from "../lib/subscriptions";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;

const ELIGIBLE: string[] = [
  ProfileType.DonneurOrdre,
  ProfileType.Transporteur,
  ProfileType.Manutentionnaire,
  ProfileType.Commissionnaire,
  ProfileType.Stockage,
];
const MODES: { value: PayMode; label: string }[] = [
  { value: "virement", label: "Virement bancaire" },
  { value: "ccp", label: "Versement CCP" },
  { value: "baridimob", label: "BaridiMob" },
  { value: "cib", label: "Carte CIB" },
  { value: "versement_especes", label: "Espèces versées sur le compte NETLOG" },
];
const MODE_LABEL: Record<string, string> = {
  virement: "Virement", ccp: "CCP", baridimob: "BaridiMob", cib: "CIB",
  versement_especes: "Espèces", portefeuille: "Portefeuille",
};
const money = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";
const labelCls = "text-[10px] uppercase font-bold text-slate-500 block mb-1";

export default function SubscriptionChip({ currentUser, triggerSystemLog }: { currentUser: any; triggerSystemLog: Log }) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const eligible = ELIGIBLE.includes(currentUser?.profil) && currentUser?.status === "valide";

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState<SubSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<SubPayment[]>([]);
  const [instr, setInstr] = useState<PaymentInstructions | null>(null);
  const [wallet, setWallet] = useState<{ utilisable: number; autorise: boolean }>({ utilisable: 0, autorise: false });
  const [planId, setPlanId] = useState<number | null>(null);
  const [mois, setMois] = useState(1);
  const [mode, setMode] = useState<PayMode>("virement");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const refreshSummary = async () => {
    try {
      setSub(await loadMySubscription());
    } catch (err) {
      console.error("Abonnement:", err);
    } finally {
      setLoaded(true);
    }
  };
  const refreshAll = async () => {
    try {
      const [role, all, pays, ins, s, w] = await Promise.all([
        loadMyRole(), loadPlans(), loadMyPayments(), loadPaymentInstructions(),
        loadMySubscription(), loadWalletForSubscription(),
      ]);
      const mine = all.filter((p) => p.actif && role && p.roles.includes(role));
      setPlans(mine);
      setPayments(pays);
      setInstr(ins);
      setSub(s);
      setWallet(w);
      setPlanId((cur) => cur ?? (s?.plan_id && mine.some((p) => p.id === s.plan_id) ? s.plan_id : mine[0]?.id ?? null));
    } catch (err: any) {
      logRef.current(err?.message ?? "Chargement impossible.", "danger");
    }
  };

  useEffect(() => {
    if (eligible) void refreshSummary();
  }, [eligible, currentUser?.id]);
  useEffect(() => {
    if (open) void refreshAll();
  }, [open]);

  if (!eligible) return null;

  const plan = plans.find((p) => p.id === planId) ?? null;
  const ht = plan ? plan.prix_mensuel_ht * mois : 0;
  const tva = instr?.tva_pct ?? 0;
  const ttc = Math.round(ht * (1 + tva / 100) * 100) / 100;
  const daysLeft = sub?.fin ? Math.ceil((new Date(sub.fin).getTime() - Date.now()) / 86400000) : null;
  const warn = loaded && (!sub || !sub.actif || (daysLeft !== null && daysLeft <= 7));
  const label = !loaded ? "…" : !sub ? "Abonnement" : sub.actif ? (sub.fin ? `Jusqu'au ${dmy(sub.fin)}` : "Actif") : "Expiré";
  const changing = Boolean(sub?.actif && sub.plan_id && plan && sub.plan_id !== plan.id);
  const walletOk = wallet.autorise && plan && ht >= 0 && wallet.utilisable >= ht;
  const pending = payments.find((p) => p.statut === "en_attente");

  const payWallet = async () => {
    if (!plan) return;
    if (!window.confirm(`Débiter ${money(ht)} DA HT de votre portefeuille pour ${mois} mois de « ${plan.nom} » ?`)) return;
    setBusy(true);
    try {
      await payWithWallet(plan.id, mois);
      logRef.current("Abonnement payé avec votre portefeuille et activé.", "success");
      window.dispatchEvent(new Event("netlog-wallet-refresh"));
      await refreshAll();
    } catch (err: any) {
      logRef.current(err?.message ?? "Paiement impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const sendProof = async () => {
    if (!plan) return logRef.current("Choisissez un forfait.", "warning");
    if (!reference.trim() && !file) return logRef.current("Indiquez la référence du versement ou joignez la preuve.", "warning");
    setBusy(true);
    try {
      const path = file ? await uploadProof(file) : undefined;
      await requestPayment({
        userId: currentUser.id, planId: plan.id, mois, mode,
        reference: reference.trim() || undefined, preuvePath: path,
      });
      logRef.current("Preuve envoyée. NETLOG vérifie votre paiement et prolonge votre abonnement.", "success");
      setReference("");
      setFile(null);
      await refreshAll();
    } catch (err: any) {
      logRef.current(err?.message ?? "Envoi impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Mon abonnement NETLOG"
        className={`px-2.5 py-1.5 rounded-full border text-[11px] font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
          warn ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        }`}
      >
        📅 <span>{label}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Mon abonnement NETLOG</h3>
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">
                Fermer
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 space-y-1">
              {!sub ? (
                <p className="text-slate-600">Vous n'avez pas encore d'abonnement actif.</p>
              ) : (
                <>
                  <div>Forfait : <b className="text-slate-900">{sub.plan_nom}</b>{sub.offerte ? " (offert)" : ""}</div>
                  <div>
                    État :{" "}
                    <b className={sub.actif ? "text-emerald-700" : "text-rose-600"}>{sub.actif ? "Actif" : "Expiré"}</b>
                    {sub.fin ? ` · jusqu'au ${dmy(sub.fin)}` : " · sans échéance"}
                    {daysLeft !== null && sub.actif && daysLeft <= 7 ? ` (dans ${Math.max(daysLeft, 0)} jour(s))` : ""}
                  </div>
                  {currentUser?.profil === ProfileType.Transporteur && (
                    <div>
                      Chauffeurs : <b>{sub.chauffeurs_actuels}</b> sur{" "}
                      <b>{sub.max_chauffeurs == null ? "illimité" : sub.max_chauffeurs}</b>
                    </div>
                  )}
                </>
              )}
            </div>

            {pending && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-amber-900">
                ⏳ Un paiement de {money(pending.montant_ttc)} DA est en cours de vérification par NETLOG.
              </div>
            )}

            {plans.length === 0 ? (
              <p className="text-slate-600">Aucun forfait n'est proposé pour votre type de compte. Contactez NETLOG.</p>
            ) : (
              <div className="border border-slate-100 rounded-2xl p-3 space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-800 block">Renouveler ou changer de forfait</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Forfait</label>
                    <select className={inputCls} value={planId ?? ""} onChange={(e) => setPlanId(Number(e.target.value))}>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom} — {money(p.prix_mensuel_ht)} DA HT / mois</option>
                      ))}
                    </select>
                    {plan?.description && <p className="text-[10px] text-slate-500 mt-1">{plan.description}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Durée (mois)</label>
                    <select className={inputCls} value={mois} onChange={(e) => setMois(Number(e.target.value))}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end font-mono text-slate-700">Total HT : <b className="ml-1 text-slate-900">{money(ht)} DA</b></div>
                </div>
                {changing && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-2">
                    Changer de forfait prend effet immédiatement : la période restante de votre forfait actuel n'est pas reportée.
                  </p>
                )}

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-800 block">Payer avec mon portefeuille</span>
                  <p className="text-slate-600">
                    Solde utilisable : <b className="font-mono">{money(wallet.utilisable)} DA HT</b>{" "}
                    <span className="text-slate-400">(hors engagements en cours et crédit de bienvenue)</span>
                  </p>
                  <button disabled={busy || !walletOk} onClick={payWallet}
                    className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl cursor-pointer disabled:opacity-30">
                    💼 Payer {money(ht)} DA HT avec mon portefeuille
                  </button>
                  {!wallet.autorise && <p className="text-slate-500">Le paiement par portefeuille n'est pas activé.</p>}
                  {wallet.autorise && plan && wallet.utilisable < ht && (
                    <p className="text-slate-500">Solde insuffisant : rechargez votre portefeuille ou payez par versement ci-dessous.</p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-800 block">Payer par versement et envoyer la preuve</span>
                  {instr && (instr.beneficiaire || instr.rib || instr.instructions) && (
                    <div className="bg-slate-50 rounded-xl p-2 space-y-0.5">
                      {instr.beneficiaire && <div>Bénéficiaire : <b>{instr.beneficiaire}</b></div>}
                      {instr.rib && <div>RIB / CCP : <b className="font-mono">{instr.rib}</b></div>}
                      {instr.instructions && <p className="text-slate-600 whitespace-pre-line">{instr.instructions}</p>}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as PayMode)}>
                      {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <input className={inputCls} placeholder="Référence du versement" value={reference} onChange={(e) => setReference(e.target.value)} />
                  </div>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-600">À verser : <b className="text-slate-900">{money(ttc)} DA</b>{tva > 0 ? ` (TVA ${tva} %)` : ""}</span>
                    <button disabled={busy || !!pending} onClick={sendProof}
                      className="px-4 py-2 bg-[#1D9E75] text-white font-bold rounded-xl cursor-pointer disabled:opacity-40">
                      Envoyer la preuve
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <span className="text-[10px] font-black uppercase text-slate-800 block mb-1">Historique</span>
              {payments.length === 0 ? (
                <p className="text-slate-500">Aucun paiement.</p>
              ) : (
                payments.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600">
                      {dmy(p.created_at)} · {p.plan_nom} · {p.mois} mois · {MODE_LABEL[p.mode] ?? p.mode}
                    </span>
                    <b className={p.statut === "validee" ? "text-emerald-700" : p.statut === "refusee" ? "text-rose-600" : "text-amber-700"}>
                      {p.statut === "en_attente" ? "en vérification" : p.statut === "validee" ? "validé" : "refusé"}
                    </b>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
