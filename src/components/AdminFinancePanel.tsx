import React, { useEffect, useRef, useState } from "react";
import {
  type Plan,
  type SubPayment,
  type Topup,
  type Setting,
  type Account,
  loadPlans,
  savePlan,
  loadAdminPayments,
  decidePayment,
  proofUrl,
  loadAdminTopups,
  decideTopup,
  loadSettings,
  saveSetting,
  findAccounts,
  grantFree,
  adjustWallet,
} from "../lib/subscriptions";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;
type Tab = "paiements" | "recharges" | "forfaits" | "parametres" | "offert";

const ROLES = ["donneur_ordre", "transporteur", "commissionnaire", "manutentionnaire", "stockage"];
const money = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";
const labelCls = "text-[10px] uppercase font-bold text-slate-500 block mb-1";

type PlanForm = {
  id?: number; code: string; nom: string; description: string; roles: string[];
  prix: string; maxChauf: string; actif: boolean; ordre: string;
  commMode: "defaut" | "pct" | "fixe" | "mixte"; commPct: string; commFixe: string;
};
const EMPTY_PLAN: PlanForm = {
  code: "", nom: "", description: "", roles: [], prix: "0", maxChauf: "", actif: true, ordre: "0",
  commMode: "defaut", commPct: "", commFixe: "",
};
const SETTING_GROUPS: [string, string][] = [
  ["wallet_", "Portefeuille"],
  ["commission_", "Commission NETLOG (pourcentage + montant fixe, cumulables)"],
  ["commercial_", "Rémunération des commerciaux"],
  ["abonnement_", "Abonnements"],
  ["subscription_", "Abonnements"],
  ["tva_", "Abonnements"],
  ["chauffeurs_", "Abonnements"],
  ["netlog_", "Coordonnées de paiement NETLOG"],
];
const groupOf = (key: string): string => SETTING_GROUPS.find(([pre]) => key.startsWith(pre))?.[1] ?? "Autres";
const commissionLabel = (p: Plan): string => {
  if (p.commission_pct == null && p.commission_fixe == null) return "paramètres généraux";
  const parts: string[] = [];
  if (p.commission_pct != null) parts.push(`${p.commission_pct} %`);
  if (p.commission_fixe != null) parts.push(`${money(p.commission_fixe)} DA`);
  return parts.join(" + ");
};

export default function AdminFinancePanel({ triggerSystemLog }: { triggerSystemLog: Log }) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const log: Log = (m, t) => logRef.current(m, t);

  const [tab, setTab] = useState<Tab>("paiements");
  const [busy, setBusy] = useState(false);
  const [payments, setPayments] = useState<SubPayment[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [planForm, setPlanForm] = useState<PlanForm>(EMPTY_PLAN);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Account[]>([]);
  const [target, setTarget] = useState<Account | null>(null);
  const [giftPlan, setGiftPlan] = useState<number | null>(null);
  const [giftMois, setGiftMois] = useState("");
  const [giftValidate, setGiftValidate] = useState(true);
  const [creditQuery, setCreditQuery] = useState("");
  const [creditFound, setCreditFound] = useState<Account[]>([]);
  const [creditTarget, setCreditTarget] = useState<Account | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");

  const refresh = async () => {
    try {
      const [p, t, pl, s] = await Promise.all([loadAdminPayments(), loadAdminTopups(), loadPlans(), loadSettings()]);
      setPayments(p);
      setTopups(t);
      setPlans(pl);
      setSettings(s);
    } catch (err: any) {
      log(err?.message ?? "Chargement impossible.", "danger");
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      log(ok, "success");
      await refresh();
    } catch (err: any) {
      log(err?.message ?? "Opération impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const openProof = async (path: string) => {
    try {
      const url = await proofUrl(path);
      if (url) window.open(url, "_blank", "noopener");
    } catch (err: any) {
      log(err?.message ?? "Preuve illisible.", "danger");
    }
  };

  const pendingPays = payments.filter((p) => p.statut === "en_attente");
  const donePays = payments.filter((p) => p.statut !== "en_attente").slice(0, 20);
  const pendingTops = topups.filter((t) => t.status === "en_attente");

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "paiements", label: "Paiements d'abonnement", badge: pendingPays.length },
    { key: "recharges", label: "Recharges portefeuille", badge: pendingTops.length },
    { key: "forfaits", label: "Forfaits" },
    { key: "parametres", label: "Paramètres" },
    { key: "offert", label: "Abonnement offert" },
  ];

  const editPlan = (p: Plan) =>
    setPlanForm({
      id: p.id, code: p.code, nom: p.nom, description: p.description ?? "", roles: p.roles,
      prix: String(p.prix_mensuel_ht), maxChauf: p.max_chauffeurs == null ? "" : String(p.max_chauffeurs),
      actif: p.actif, ordre: String(p.ordre),
      commMode: p.commission_pct == null && p.commission_fixe == null ? "defaut"
        : p.commission_pct != null && p.commission_fixe != null ? "mixte"
        : p.commission_pct != null ? "pct" : "fixe",
      commPct: p.commission_pct == null ? "" : String(p.commission_pct),
      commFixe: p.commission_fixe == null ? "" : String(p.commission_fixe),
    });

  const submitPlan = async () => {
    const prix = Number(planForm.prix.replace(",", "."));
    const maxC = planForm.maxChauf.trim() === "" ? null : Number(planForm.maxChauf);
    if (!planForm.code.trim() || !planForm.nom.trim()) return log("Code et nom obligatoires.", "warning");
    if (!Number.isFinite(prix) || prix < 0) return log("Prix invalide.", "warning");
    if (maxC != null && (!Number.isInteger(maxC) || maxC < 0)) return log("Limite de chauffeurs invalide.", "warning");
    if (planForm.roles.length === 0) return log("Choisissez au moins un type de compte.", "warning");
    let cPct: number | null = null;
    let cFixe: number | null = null;
    if (planForm.commMode === "pct" || planForm.commMode === "mixte") {
      cPct = Number(planForm.commPct.replace(",", "."));
      if (!Number.isFinite(cPct) || cPct < 0 || cPct > 100) return log("Pourcentage de commission invalide.", "warning");
    }
    if (planForm.commMode === "fixe" || planForm.commMode === "mixte") {
      cFixe = Number(planForm.commFixe.replace(",", "."));
      if (!Number.isFinite(cFixe) || cFixe < 0) return log("Montant fixe de commission invalide.", "warning");
    }
    await run(
      () =>
        savePlan({
          id: planForm.id, code: planForm.code.trim(), nom: planForm.nom.trim(),
          description: planForm.description.trim() || null, roles: planForm.roles,
          prix_mensuel_ht: prix, max_chauffeurs: maxC, actif: planForm.actif, ordre: Number(planForm.ordre) || 0,
          commission_pct: cPct, commission_fixe: cFixe,
        }),
      "Forfait enregistré.",
    );
    setPlanForm(EMPTY_PLAN);
  };

  const saveOne = async (s: Setting) => {
    const raw = (edits[s.key] ?? (typeof s.value === "string" ? s.value : JSON.stringify(s.value))).trim();
    let value: unknown;
    if (typeof s.value === "boolean") value = raw === "true";
    else if (typeof s.value === "number") {
      value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value as number)) return log("Valeur numérique invalide.", "warning");
    } else value = raw;
    await run(() => saveSetting(s.key, value), `Paramètre « ${s.key} » enregistré.`);
    setEdits((e) => {
      const { [s.key]: _drop, ...rest } = e;
      return rest;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
              tab === t.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            {t.label}
            {t.badge ? <span className="ml-1.5 bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "paiements" && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">
            Rapprochez chaque preuve du relevé bancaire de NETLOG avant de valider. La validation active l'abonnement et valide le compte.
          </p>
          {pendingPays.length === 0 && <p className="text-xs text-slate-500">Aucun paiement en attente.</p>}
          {pendingPays.map((p) => (
            <div key={p.id} className="bg-white border border-slate-100 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <b className="text-slate-900">{p.membre} <span className="text-slate-400 font-normal">({p.membre_role})</span></b>
                <span className="font-mono font-bold">{money(p.montant_ttc)} DA TTC ({money(p.montant_ht)} HT)</span>
              </div>
              <div className="text-slate-600">
                {p.plan_nom} · {p.mois} mois · {p.mode} · réf. {p.reference || "—"} · {dmy(p.created_at)}
                {p.declare_par !== p.user_id && <span className="ml-2 text-amber-700 font-bold">déclaré par un tiers (commercial)</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {p.preuve_path && (
                  <button onClick={() => openProof(p.preuve_path!)} className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold cursor-pointer">
                    📎 Voir la preuve
                  </button>
                )}
                <input
                  className={inputCls + " max-w-xs"}
                  placeholder="Note (obligatoire si refus)"
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
                />
                <button
                  disabled={busy}
                  onClick={() => run(() => decidePayment(p.id, true, notes[p.id]), "Paiement validé, compte activé.")}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
                >
                  ✅ Valider le paiement et le compte
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (!(notes[p.id] ?? "").trim()) return log("Indiquez le motif du refus.", "warning");
                    void run(() => decidePayment(p.id, false, notes[p.id]), "Paiement refusé.");
                  }}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold cursor-pointer disabled:opacity-50"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
          {donePays.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <span className="text-[10px] uppercase font-black text-slate-400 block mb-2">Derniers paiements traités</span>
              {donePays.map((p) => (
                <div key={p.id} className="text-xs text-slate-600 py-1 border-b border-slate-50 last:border-0">
                  {p.membre} · {p.plan_nom} · {money(p.montant_ttc)} DA ·{" "}
                  <b className={p.statut === "validee" ? "text-emerald-700" : "text-rose-600"}>{p.statut}</b>
                  {p.periode_fin ? ` · jusqu'au ${dmy(p.periode_fin)}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "recharges" && (
        <div className="space-y-4">
          <div className="space-y-3">
            {pendingTops.length === 0 && <p className="text-xs text-slate-500">Aucune recharge en attente.</p>}
            {pendingTops.map((t) => (
              <div key={t.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <b className="text-slate-900">{t.membre}</b> · {money(t.amount_ht)} DA HT · {t.mode} · réf. {t.reference || "—"} · {dmy(t.created_at)}
                </div>
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => run(() => decideTopup(t.id, true), "Recharge créditée.")}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50">
                    ✅ Valider
                  </button>
                  <button disabled={busy} onClick={() => run(() => decideTopup(t.id, false, "Refusée"), "Recharge refusée.")}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold cursor-pointer disabled:opacity-50">
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 text-xs">
            <span className="text-xs font-black uppercase text-slate-800">Créditer ou corriger un portefeuille</span>
            <p className="text-[11px] text-slate-500">Montant négatif pour débiter. Le motif est obligatoire et conservé dans l'historique.</p>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="E-mail ou raison sociale (3 caractères minimum)" value={creditQuery} onChange={(e) => setCreditQuery(e.target.value)} />
              <button
                onClick={async () => {
                  try { setCreditFound(await findAccounts(creditQuery)); } catch (err: any) { log(err?.message ?? "Recherche impossible.", "danger"); }
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer">
                Chercher
              </button>
            </div>
            {creditFound.map((a) => (
              <div key={a.id} onClick={() => setCreditTarget(a)}
                className={`p-2 border rounded-xl cursor-pointer ${creditTarget?.id === a.id ? "border-[#1D9E75] bg-emerald-50" : "border-slate-100"}`}>
                <b>{a.nom}</b> · {a.role} · {a.email}
              </div>
            ))}
            {creditTarget && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className={labelCls}>Montant (DA HT)</label>
                  <input className={inputCls} inputMode="decimal" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Motif</label>
                  <input className={inputCls} value={creditNote} onChange={(e) => setCreditNote(e.target.value)} />
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    const amt = Number(creditAmount.replace(",", "."));
                    if (!Number.isFinite(amt) || amt === 0) return log("Montant invalide.", "warning");
                    if (!creditNote.trim()) return log("Le motif est obligatoire.", "warning");
                    void run(() => adjustWallet(creditTarget.id, amt, creditNote), `Portefeuille de ${creditTarget.nom} mis à jour.`)
                      .then(() => { setCreditAmount(""); setCreditNote(""); });
                  }}
                  className="px-4 py-2 bg-[#1D9E75] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">
                  Enregistrer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "forfaits" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
            <span className="text-xs font-black uppercase text-slate-800">{planForm.id ? "Modifier le forfait" : "Nouveau forfait"}</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelCls}>Code</label><input className={inputCls} value={planForm.code} onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })} /></div>
              <div><label className={labelCls}>Nom</label><input className={inputCls} value={planForm.nom} onChange={(e) => setPlanForm({ ...planForm, nom: e.target.value })} /></div>
              <div><label className={labelCls}>Prix mensuel HT (DA)</label><input className={inputCls} inputMode="decimal" value={planForm.prix} onChange={(e) => setPlanForm({ ...planForm, prix: e.target.value })} /></div>
              <div><label className={labelCls}>Chauffeurs max (vide = illimité)</label><input className={inputCls} inputMode="numeric" value={planForm.maxChauf} onChange={(e) => setPlanForm({ ...planForm, maxChauf: e.target.value.replace(/\D/g, "") })} /></div>
              <div><label className={labelCls}>Ordre d'affichage</label><input className={inputCls} inputMode="numeric" value={planForm.ordre} onChange={(e) => setPlanForm({ ...planForm, ordre: e.target.value.replace(/\D/g, "") })} /></div>
              <div><label className={labelCls}>Description</label><input className={inputCls} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelCls}>Commission NETLOG pour ce forfait</label>
                <select className={inputCls} value={planForm.commMode}
                  onChange={(e) => setPlanForm({ ...planForm, commMode: e.target.value as PlanForm["commMode"] })}>
                  <option value="defaut">Paramètres généraux</option>
                  <option value="pct">Pourcentage du prix HT</option>
                  <option value="fixe">Montant fixe par mission</option>
                  <option value="mixte">Pourcentage + montant fixe</option>
                </select>
              </div>
              {(planForm.commMode === "pct" || planForm.commMode === "mixte") && (
                <div>
                  <label className={labelCls}>Pourcentage (%)</label>
                  <input className={inputCls} inputMode="decimal" value={planForm.commPct}
                    onChange={(e) => setPlanForm({ ...planForm, commPct: e.target.value })} />
                </div>
              )}
              {(planForm.commMode === "fixe" || planForm.commMode === "mixte") && (
                <div>
                  <label className={labelCls}>Montant fixe (DA HT)</label>
                  <input className={inputCls} inputMode="decimal" value={planForm.commFixe}
                    onChange={(e) => setPlanForm({ ...planForm, commFixe: e.target.value })} />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={planForm.roles.includes(r)}
                    onChange={(e) => setPlanForm({ ...planForm, roles: e.target.checked ? [...planForm.roles, r] : planForm.roles.filter((x) => x !== r) })} />
                  {r}
                </label>
              ))}
              <label className="flex items-center gap-1 cursor-pointer ml-4">
                <input type="checkbox" checked={planForm.actif} onChange={(e) => setPlanForm({ ...planForm, actif: e.target.checked })} /> Actif
              </label>
            </div>
            <button disabled={busy} onClick={submitPlan} className="px-4 py-2 bg-[#1D9E75] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">
              Enregistrer le forfait
            </button>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead><tr className="text-[10px] uppercase text-slate-400"><th className="p-2">Forfait</th><th className="p-2">Comptes</th><th className="p-2 text-right">HT / mois</th><th className="p-2">Chauffeurs</th><th className="p-2">Commission</th><th className="p-2">État</th><th className="p-2"></th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2 font-bold">{p.nom} <span className="text-slate-400 font-normal">({p.code})</span></td>
                    <td className="p-2">{p.roles.join(", ")}</td>
                    <td className="p-2 text-right font-mono">{money(p.prix_mensuel_ht)}</td>
                    <td className="p-2">{p.max_chauffeurs == null ? "illimité" : p.max_chauffeurs}</td><td className="p-2">{commissionLabel(p)}</td>
                    <td className="p-2">{p.actif ? "actif" : "inactif"}</td>
                    <td className="p-2 text-right"><button onClick={() => editPlan(p)} className="px-2 py-1 border border-slate-200 rounded-lg font-bold cursor-pointer">Modifier</button></td>
                  </tr>
                ))}
                {plans.length === 0 && <tr><td className="p-2 text-slate-500" colSpan={7}>Aucun forfait.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "parametres" && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
          <p className="text-[11px] text-slate-500">Tous les montants sont en dinars, hors taxes. Les pourcentages sont en %.</p>
          {[...settings]
            .sort((a, b) => groupOf(a.key).localeCompare(groupOf(b.key)) || a.key.localeCompare(b.key))
            .map((s, i, arr) => {
              const current = edits[s.key] ?? (typeof s.value === "string" ? s.value : JSON.stringify(s.value));
              return (
                <React.Fragment key={s.key}>
                  {(i === 0 || groupOf(arr[i - 1].key) !== groupOf(s.key)) && (
                    <div className="pt-3 text-[10px] font-black uppercase tracking-widest text-[#1D9E75] border-b border-slate-100 pb-1">
                      {groupOf(s.key)}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs border-b border-slate-50 pb-2">
                    <div className="sm:col-span-5">
                      <b className="text-slate-900 font-mono">{s.key}</b>
                      <div className="text-[10px] text-slate-500">{s.description}</div>
                    </div>
                    <div className="sm:col-span-5">
                      {typeof s.value === "boolean" ? (
                        <select className={inputCls} value={current} onChange={(e) => setEdits({ ...edits, [s.key]: e.target.value })}>
                          <option value="true">oui</option>
                          <option value="false">non</option>
                        </select>
                      ) : (
                        <input className={inputCls} value={current} onChange={(e) => setEdits({ ...edits, [s.key]: e.target.value })} />
                      )}
                    </div>
                    <div className="sm:col-span-2 text-right">
                      <button disabled={busy || edits[s.key] === undefined} onClick={() => saveOne(s)}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold cursor-pointer disabled:opacity-30">
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
        </div>
      )}

      {tab === "offert" && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 text-xs">
          <p className="text-[11px] text-slate-500">Offrir un abonnement, par exemple à un donneur d'ordre recruté directement par NETLOG.</p>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="E-mail ou raison sociale (3 caractères minimum)" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button onClick={async () => { try { setFound(await findAccounts(query)); } catch (err: any) { log(err?.message ?? "Recherche impossible.", "danger"); } }} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer">Chercher</button>
          </div>
          {found.map((a) => (
            <div key={a.id} onClick={() => { setTarget(a); setGiftPlan(plans.find((p) => p.roles.includes(a.role))?.id ?? null); }}
              className={`p-2 border rounded-xl cursor-pointer ${target?.id === a.id ? "border-[#1D9E75] bg-emerald-50" : "border-slate-100"}`}>
              <b>{a.nom}</b> · {a.role} · {a.email} · <span className="text-slate-500">{a.status}</span>
            </div>
          ))}
          {target && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelCls}>Forfait</label>
                <select className={inputCls} value={giftPlan ?? ""} onChange={(e) => setGiftPlan(Number(e.target.value))}>
                  {plans.filter((p) => p.roles.includes(target.role)).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Durée en mois (vide = sans échéance)</label>
                <input className={inputCls} inputMode="numeric" value={giftMois} onChange={(e) => setGiftMois(e.target.value.replace(/\D/g, ""))} />
              </div>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={giftValidate} onChange={(e) => setGiftValidate(e.target.checked)} /> Valider aussi le compte</label>
              <button disabled={busy || !giftPlan} onClick={() => run(() => grantFree({ userId: target.id, planId: giftPlan!, mois: giftMois ? Number(giftMois) : null, validate: giftValidate }), "Abonnement offert enregistré.")}
                className="px-4 py-2 bg-[#1D9E75] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">Offrir l'abonnement</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
