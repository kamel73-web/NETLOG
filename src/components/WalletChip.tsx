import React, { useEffect, useRef, useState } from "react";
import { ProfileType } from "../types";
import {
  type WalletSummary,
  type WalletTx,
  type WalletTopup,
  loadMyWallet,
  loadMyWalletTx,
  loadMyTopups,
  requestTopup,
} from "../lib/wallet";
import { loadPaymentInstructions, type PaymentInstructions } from "../lib/subscriptions";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;

const ELIGIBLE: string[] = [
  ProfileType.DonneurOrdre,
  ProfileType.Transporteur,
  ProfileType.Manutentionnaire,
  ProfileType.Commissionnaire,
  ProfileType.Stockage,
];
const MODES = [
  { value: "virement", label: "Virement bancaire" },
  { value: "ccp", label: "Versement CCP" },
  { value: "baridimob", label: "BaridiMob" },
  { value: "cib", label: "Carte CIB" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces versées sur le compte NETLOG" },
];
const TX_LABEL: Record<string, string> = {
  credit_bienvenue: "Crédit de bienvenue",
  recharge: "Recharge",
  debit_commission: "Commission NETLOG",
  ajustement: "Ajustement",
};
const money = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";

export default function WalletChip({ currentUser, triggerSystemLog }: { currentUser: any; triggerSystemLog: Log }) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const eligible = ELIGIBLE.includes(currentUser?.profil) && currentUser?.status === "valide";

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [topups, setTopups] = useState<WalletTopup[]>([]);
  const [instr, setInstr] = useState<PaymentInstructions | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("virement");
  const [reference, setReference] = useState("");

  const refreshSummary = async () => {
    try {
      setWallet(await loadMyWallet());
    } catch (err) {
      console.error("Portefeuille:", err);
    }
  };
  const refreshDetails = async () => {
    try {
      const [t, tp, i] = await Promise.all([loadMyWalletTx(), loadMyTopups(), loadPaymentInstructions()]);
      setTxs(t);
      setTopups(tp);
      setInstr(i);
    } catch (err) {
      console.error("Détail du portefeuille:", err);
    }
  };

  useEffect(() => {
    if (eligible) void refreshSummary();
  }, [eligible, currentUser?.id]);
  useEffect(() => {
    const h = () => void refreshSummary();
    window.addEventListener("netlog-wallet-refresh", h);
    return () => window.removeEventListener("netlog-wallet-refresh", h);
  }, []);
  useEffect(() => {
    if (open) {
      void refreshSummary();
      void refreshDetails();
    }
  }, [open]);

  if (!eligible) return null;

  const submit = async () => {
    const a = Number(amount.replace(",", "."));
    if (!Number.isFinite(a) || a <= 0) {
      logRef.current("Indiquez un montant valide.", "warning");
      return;
    }
    if (!reference.trim()) {
      logRef.current("Indiquez la référence du versement.", "warning");
      return;
    }
    setBusy(true);
    try {
      await requestTopup(a, mode, reference.trim());
      logRef.current("Demande envoyée : votre portefeuille sera crédité après vérification par NETLOG.", "success");
      setAmount("");
      setReference("");
      await refreshDetails();
    } catch (err: any) {
      logRef.current(err?.message ?? "Demande impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const low = Boolean(wallet && wallet.blocage_actif && wallet.disponible <= 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Mon portefeuille NETLOG"
        className={`px-2.5 py-1.5 rounded-full border text-[11px] font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
          low ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        }`}
      >
        💼 <span className="font-mono">{wallet ? money(wallet.disponible) : "…"} DA</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Mon portefeuille NETLOG</h3>
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">
                Fermer
              </button>
            </div>
            <p className="text-slate-500">Crédit prépayé en dinars, hors taxes.</p>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-2xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Solde</span>
                <span className="font-mono font-black text-slate-900">{money(wallet?.solde ?? 0)}</span>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Réservé</span>
                <span className="font-mono font-black text-slate-900">{money(wallet?.reserve ?? 0)}</span>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-3">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Disponible</span>
                <span className="font-mono font-black text-emerald-800">{money(wallet?.disponible ?? 0)}</span>
              </div>
            </div>
            {currentUser?.profil === ProfileType.Transporteur && wallet?.blocage_actif && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-2">
                Vous ne pouvez soumissionner que si votre solde disponible couvre la commission NETLOG de la mission,
                en plus de vos engagements en cours.
              </p>
            )}

            <div className="border border-slate-100 rounded-2xl p-3 space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-800 block">Recharger mon portefeuille</span>
              {instr && (instr.beneficiaire || instr.rib || instr.instructions) && (
                <div className="bg-slate-50 rounded-xl p-2 space-y-0.5">
                  {instr.beneficiaire && <div>Bénéficiaire : <b>{instr.beneficiaire}</b></div>}
                  {instr.rib && <div>RIB / CCP : <b className="font-mono">{instr.rib}</b></div>}
                  {instr.instructions && <p className="text-slate-600 whitespace-pre-line">{instr.instructions}</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} inputMode="decimal" placeholder="Montant HT (DA)" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <input className={inputCls} placeholder="Référence du versement" value={reference} onChange={(e) => setReference(e.target.value)} />
              <button
                disabled={busy}
                onClick={submit}
                className="px-4 py-2 bg-[#1D9E75] text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                Envoyer la demande de recharge
              </button>
              {topups.length > 0 && (
                <div className="space-y-1">
                  {topups.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex justify-between text-slate-600">
                      <span>{dmy(t.created_at)} · {money(t.amount_ht)} DA · {t.mode}</span>
                      <b className={t.status === "validee" ? "text-emerald-700" : t.status === "refusee" ? "text-rose-600" : "text-amber-700"}>
                        {t.status === "en_attente" ? "en vérification" : t.status}
                      </b>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black uppercase text-slate-800 block mb-1">Derniers mouvements</span>
              {txs.length === 0 ? (
                <p className="text-slate-500">Aucun mouvement pour le moment.</p>
              ) : (
                txs.map((t) => (
                  <div key={t.id} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600">
                      {dmy(t.created_at)} · {TX_LABEL[t.type] ?? t.type}
                      {t.note && t.type === "ajustement" ? ` (${t.note})` : ""}
                    </span>
                    <b className={`font-mono ${t.amount_ht >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {t.amount_ht >= 0 ? "+" : ""}{money(t.amount_ht)}
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
