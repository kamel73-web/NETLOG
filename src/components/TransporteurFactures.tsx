import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type BillableMission,
  type BillingProfile,
  type Invoice,
  type PaymentMode,
  createInvoice,
  invoiceDisplayStatus,
  loadBillableMissions,
  loadBillingProfile,
  loadMyInvoices,
  markInvoicePaid,
  saveBillingProfile,
} from "../lib/billing";
import FactureDocument from "./FactureDocument";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;

const MODES: { value: PaymentMode; label: string }[] = [
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces" },
  { value: "traite", label: "Traite (effet de commerce)" },
];
const TONE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  late: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};
const money = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const toNum = (v: string) => Number(v.replace(",", ".").trim());
const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";
const labelCls = "text-[10px] uppercase font-bold text-slate-500 block mb-1";

export default function TransporteurFactures({
  currentUser,
  triggerSystemLog,
}: {
  currentUser: any;
  triggerSystemLog: Log;
}) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const log: Log = (m, t) => logRef.current(m, t);
  const initialised = useRef(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [missions, setMissions] = useState<BillableMission[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [delai, setDelai] = useState("0");
  const [mode, setMode] = useState<PaymentMode>("virement");
  const [timbre, setTimbre] = useState("");
  const [notes, setNotes] = useState("");
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payMode, setPayMode] = useState<PaymentMode>("virement");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [fRegime, setFRegime] = useState<"tva" | "ifu">("tva");
  const [fTva, setFTva] = useState("");
  const [fNis, setFNis] = useState("");
  const [fAi, setFAi] = useState("");
  const [fRib, setFRib] = useState("");
  const [fDelai, setFDelai] = useState("0");
  const [fMentions, setFMentions] = useState("");

  const refresh = async () => {
    try {
      const [p, m, i] = await Promise.all([loadBillingProfile(), loadBillableMissions(), loadMyInvoices()]);
      setProfile(p);
      setMissions(m);
      setInvoices(i);
      if (p && !initialised.current) {
        setDelai(String(p.delai_paiement_defaut));
        initialised.current = true;
      }
    } catch (err: any) {
      log(err?.message ?? "Chargement de la facturation impossible.", "danger");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  const openProfileForm = () => {
    setFRegime(profile?.regime ?? "tva");
    setFTva(profile?.taux_tva != null ? String(profile.taux_tva) : "");
    setFNis(profile?.nis ?? "");
    setFAi(profile?.article_imposition ?? "");
    setFRib(profile?.rib ?? "");
    setFDelai(String(profile?.delai_paiement_defaut ?? 0));
    setFMentions(profile?.mentions_legales ?? "");
    setEditingProfile(true);
  };

  const submitProfile = async () => {
    let taux: number | null = null;
    if (fRegime === "tva") {
      taux = fTva.trim() === "" ? NaN : toNum(fTva);
      if (!Number.isFinite(taux) || taux < 0 || taux > 100) {
        log("Indiquez un taux de TVA valide (entre 0 et 100).", "danger");
        return;
      }
    }
    const d = Number(fDelai);
    if (!Number.isInteger(d) || d < 0 || d > 365) {
      log("Le délai de paiement doit être un nombre de jours entre 0 et 365.", "danger");
      return;
    }
    setBusy(true);
    try {
      await saveBillingProfile({
        regime: fRegime,
        taux_tva: taux,
        nis: fNis.trim() || null,
        article_imposition: fAi.trim() || null,
        rib: fRib.trim() || null,
        delai_paiement_defaut: d,
        mentions_legales: fMentions.trim() || null,
      });
      log("Profil de facturation enregistré.", "success");
      setEditingProfile(false);
      initialised.current = false;
      await refresh();
    } catch (err: any) {
      log(err?.message ?? "Enregistrement impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, BillableMission[]>();
    for (const m of missions) {
      const arr = map.get(m.donneurId) ?? [];
      arr.push(m);
      map.set(m.donneurId, arr);
    }
    return Array.from(map.entries());
  }, [missions]);

  const selectedMissions = missions.filter((m) => selected.includes(m.missionId));
  const selectedDonor = selectedMissions[0]?.donneurId ?? null;
  const toggle = (m: BillableMission) =>
    setSelected((s) => (s.includes(m.missionId) ? s.filter((x) => x !== m.missionId) : [...s, m.missionId]));
  const toggleGroup = (items: BillableMission[]) => {
    const ids = items.filter((m) => m.prixHT != null).map((m) => m.missionId);
    const allIn = ids.length > 0 && ids.every((id) => selected.includes(id));
    setSelected(allIn ? selected.filter((id) => !ids.includes(id)) : Array.from(new Set([...selected, ...ids])));
  };

  const ht = selectedMissions.reduce((s, m) => s + (m.prixHT ?? 0), 0);
  const taux = profile?.regime === "tva" ? profile.taux_tva ?? 0 : 0;
  const tva = Math.round(ht * taux) / 100;
  const timbreN = timbre.trim() === "" ? 0 : toNum(timbre);
  const ttc = ht + tva + (Number.isFinite(timbreN) ? timbreN : 0);

  const generate = async () => {
    if (selected.length === 0) {
      log("Sélectionnez au moins une mission à facturer.", "warning");
      return;
    }
    const d = Number(delai);
    if (!Number.isInteger(d) || d < 0 || d > 365) {
      log("Le délai de paiement doit être un nombre de jours entre 0 et 365.", "danger");
      return;
    }
    if (!Number.isFinite(timbreN) || timbreN < 0) {
      log("Droit de timbre invalide.", "danger");
      return;
    }
    if (!window.confirm("Émettre la facture ? Elle sera numérotée définitivement et ne pourra plus être modifiée.")) return;
    setBusy(true);
    try {
      const inv = await createInvoice({
        missionIds: selected,
        delaiPaiement: d,
        modeReglement: mode,
        timbre: timbreN,
        notes: notes.trim() || undefined,
      });
      log(`Facture n° ${inv.numero} émise.`, "success");
      setSelected([]);
      setTimbre("");
      setNotes("");
      await refresh();
      setViewInvoice(inv);
    } catch (err: any) {
      log(err?.message ?? "Émission impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const confirmPay = async () => {
    if (!payTarget) return;
    setBusy(true);
    try {
      await markInvoicePaid({ invoiceId: payTarget.id, mode: payMode, reference: payRef, paidOn: payDate });
      log(`Règlement de la facture n° ${payTarget.numero} enregistré.`, "success");
      setPayTarget(null);
      setPayRef("");
      await refresh();
    } catch (err: any) {
      log(err?.message ?? "Enregistrement impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const identityOk = Boolean(currentUser?.nif && currentUser?.adresse);
  const live = invoices.filter((i) => i.status !== "annulee");
  const aEncaisser = live.filter((i) => i.status === "emise").reduce((s, i) => s + i.montant_ttc, 0);
  const enRetard = live
    .filter((i) => invoiceDisplayStatus(i).tone === "late")
    .reduce((s, i) => s + i.montant_ttc, 0);
  const encaisse = live.filter((i) => i.status === "payee").reduce((s, i) => s + i.montant_ttc, 0);
  const showProfileForm = !loading && (!profile || editingProfile);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">Facturation</h2>
        <p className="text-[11px] text-slate-500">
          Vos factures sont émises en votre nom. Le donneur d'ordre les consulte ; vous enregistrez les règlements reçus.
        </p>
      </div>

      {loading && <p className="text-xs text-slate-500">Chargement…</p>}

      {!identityOk && !loading && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl p-3">
          ⚠️ Votre fiche ne comporte pas de NIF ou d'adresse : ils sont obligatoires pour facturer. L'identité est
          verrouillée après validation du compte : contactez l'administration pour la compléter.
        </div>
      )}

      {showProfileForm && (
        <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800">Profil de facturation</h3>
          <p className="text-[11px] text-slate-500">
            Raison sociale, adresse, NIF et NRC viennent de votre compte. Complétez le reste une seule fois.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Régime fiscal *</label>
              <select className={inputCls} value={fRegime} onChange={(e) => setFRegime(e.target.value as any)}>
                <option value="tva">Assujetti à la TVA</option>
                <option value="ifu">Régime forfaitaire (sans TVA)</option>
              </select>
            </div>
            {fRegime === "tva" && (
              <div>
                <label className={labelCls}>Taux de TVA (%) *</label>
                <input className={inputCls} inputMode="decimal" value={fTva} onChange={(e) => setFTva(e.target.value)} placeholder="Taux en %" />
              </div>
            )}
            <div>
              <label className={labelCls}>Délai de paiement par défaut (jours)</label>
              <input className={inputCls} inputMode="numeric" value={fDelai} onChange={(e) => setFDelai(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div>
              <label className={labelCls}>NIS</label>
              <input className={inputCls} value={fNis} onChange={(e) => setFNis(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Article d'imposition</label>
              <input className={inputCls} value={fAi} onChange={(e) => setFAi(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>RIB / CCP</label>
              <input className={inputCls} value={fRib} onChange={(e) => setFRib(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Mentions légales (pied de facture)</label>
            <textarea className={inputCls} rows={2} value={fMentions} onChange={(e) => setFMentions(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={submitProfile}
              className="px-4 py-2 bg-[#1D9E75] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              Enregistrer
            </button>
            {profile && (
              <button onClick={() => setEditingProfile(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">
                Annuler
              </button>
            )}
          </div>
        </div>
      )}

      {profile && !editingProfile && !loading && (
        <div className="bg-white border border-slate-100 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-600">
            <b className="text-slate-900">{currentUser?.raisonSociale}</b> · {profile.regime === "tva" ? `TVA ${profile.taux_tva} %` : "Régime forfaitaire (sans TVA)"} · délai par défaut {profile.delai_paiement_defaut} j
          </div>
          <button onClick={openProfileForm} className="px-3 py-1.5 border border-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer">
            Modifier mon profil de facturation
          </button>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">À encaisser (TTC)</span>
            <span className="text-lg font-black font-mono text-slate-900">{money(aEncaisser)} DA</span>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-bold text-rose-500 block">Dont en retard</span>
            <span className="text-lg font-black font-mono text-rose-600">{money(enRetard)} DA</span>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Encaissé</span>
            <span className="text-lg font-black font-mono text-emerald-700">{money(encaisse)} DA</span>
          </div>
        </div>
      )}

      {profile && !loading && (
        <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800">Missions à facturer</h3>
          {groups.length === 0 ? (
            <p className="text-xs text-slate-500">
              Aucune mission à facturer. Une mission devient facturable quand le donneur d'ordre a confirmé la livraison.
            </p>
          ) : (
            groups.map(([donorId, items]) => (
              <div key={donorId} className="border border-slate-100 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">🏢 {items[0].donneurNom}</span>
                  <button
                    disabled={selectedDonor !== null && selectedDonor !== donorId}
                    onClick={() => toggleGroup(items)}
                    className="text-[10px] font-bold text-[#1D9E75] cursor-pointer disabled:opacity-40"
                  >
                    Tout sélectionner
                  </button>
                </div>
                <ul className="divide-y divide-slate-50">
                  {items.map((m) => {
                    const blocked = m.prixHT == null || (selectedDonor !== null && selectedDonor !== donorId);
                    return (
                      <li key={m.missionId} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          disabled={blocked}
                          checked={selected.includes(m.missionId)}
                          onChange={() => toggle(m)}
                          className="cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-slate-900">{m.trajet}</span>
                          <span className="text-slate-500"> · {m.marchandise}{m.poidsT ? ` · ${m.poidsT} t` : ""} · offre n° {m.offerId} · {dmy(m.datePrestation)}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          {m.prixHT == null ? "Prix introuvable" : `${money(m.prixHT)} DA HT`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}

          {selected.length > 0 && (
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Délai de paiement (jours)</label>
                  <input className={inputCls} inputMode="numeric" value={delai} onChange={(e) => setDelai(e.target.value.replace(/\D/g, ""))} />
                  <span className="text-[10px] text-slate-400">0 = comptant</span>
                </div>
                <div>
                  <label className={labelCls}>Mode de règlement prévu</label>
                  <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
                    {MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Droit de timbre (DA, si applicable)</label>
                  <input className={inputCls} inputMode="decimal" value={timbre} onChange={(e) => setTimbre(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Observation</label>
                  <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600 font-mono">
                  {selected.length} mission(s) · HT {money(ht)} DA
                  {profile.regime === "tva" ? ` · TVA ${money(tva)} DA` : " · TVA non applicable"}
                  {timbreN > 0 ? ` · Timbre ${money(timbreN)} DA` : ""} · <b className="text-slate-900">Total {money(ttc)} DA</b>
                </div>
                <button
                  disabled={busy}
                  onClick={generate}
                  className="px-5 py-2.5 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
                >
                  🧾 Générer la facture
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && (
        <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-3">
          <h3 className="text-xs font-black uppercase text-slate-800">Journal des factures</h3>
          {invoices.length === 0 ? (
            <p className="text-xs text-slate-500">Aucune facture émise.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400">
                    <th className="p-2">N°</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Client</th>
                    <th className="p-2 text-right">Missions</th>
                    <th className="p-2 text-right">Total TTC</th>
                    <th className="p-2">Échéance</th>
                    <th className="p-2">Statut</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoices.map((inv) => {
                    const st = invoiceDisplayStatus(inv);
                    return (
                      <tr key={inv.id}>
                        <td className="p-2 font-mono font-bold">{inv.numero}</td>
                        <td className="p-2">{dmy(inv.date_emission)}</td>
                        <td className="p-2">{inv.client?.raison_sociale}</td>
                        <td className="p-2 text-right">{inv.lines.length}</td>
                        <td className="p-2 text-right font-mono font-bold">{money(inv.montant_ttc)} DA</td>
                        <td className="p-2">{inv.date_echeance ? dmy(inv.date_echeance) : "Comptant"}</td>
                        <td className="p-2">
                          <span className={`border px-2 py-0.5 rounded-full text-[10px] font-black ${TONE[st.tone]}`}>{st.label}</span>
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <button onClick={() => setViewInvoice(inv)} className="px-2 py-1 border border-slate-200 rounded-lg font-bold cursor-pointer">
                            👁 Voir
                          </button>
                          {inv.status === "emise" && (
                            <button
                              onClick={() => {
                                setPayTarget(inv);
                                setPayMode(inv.mode_reglement_prevu);
                              }}
                              className="ml-1 px-2 py-1 bg-emerald-600 text-white rounded-lg font-bold cursor-pointer"
                            >
                              Encaisser
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {payTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-sm font-black text-slate-900">Règlement de la facture n° {payTarget.numero}</h3>
            <p className="text-xs text-slate-500">Montant : {money(payTarget.montant_ttc)} DA — à enregistrer une fois le paiement réellement reçu.</p>
            <div>
              <label className={labelCls}>Mode de règlement reçu</label>
              <select className={inputCls} value={payMode} onChange={(e) => setPayMode(e.target.value as PaymentMode)}>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Référence (n° de chèque, de virement, de traite)</label>
              <input className={inputCls} value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Date de réception</label>
              <input type="date" className={inputCls} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPayTarget(null)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">
                Annuler
              </button>
              <button disabled={busy} onClick={confirmPay} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">
                Enregistrer le règlement
              </button>
            </div>
          </div>
        </div>
      )}

      {viewInvoice && <FactureDocument invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
    </div>
  );
}
