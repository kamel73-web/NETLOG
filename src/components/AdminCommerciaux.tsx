import React, { useEffect, useRef, useState } from "react";
import {
  type ShareRule,
  type Commercial,
  type Overrides,
  loadShareRules,
  saveShareRule,
  loadCommerciaux,
  saveOverrides,
  generateReferralCode,
  attachMember,
} from "../lib/commissions";
import { type Account, findAccounts } from "../lib/subscriptions";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;
type Draft = Record<string, { pct: string; fixe: string }>;

const money = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";
const labelCls = "text-[10px] uppercase font-bold text-slate-500 block mb-1";
const num = (s: string): number | null => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export default function AdminCommerciaux({ triggerSystemLog }: { triggerSystemLog: Log }) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const log: Log = (m, t) => logRef.current(m, t);

  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<ShareRule[]>([]);
  const [ruleDraft, setRuleDraft] = useState<Draft>({});
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ovDraft, setOvDraft] = useState<Draft>({});
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Account[]>([]);
  const [target, setTarget] = useState<Account | null>(null);
  const [attachTo, setAttachTo] = useState("");

  const refresh = async () => {
    try {
      const [r, c] = await Promise.all([loadShareRules(), loadCommerciaux()]);
      setRules(r);
      setCommerciaux(c);
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

  const saveRule = (r: ShareRule) => {
    const d = ruleDraft[r.key];
    const pct = d ? num(d.pct) ?? 0 : r.pct;
    const fixe = d ? num(d.fixe) ?? 0 : r.fixe;
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return log("Pourcentage invalide (0 à 100).", "warning");
    if (!Number.isFinite(fixe) || fixe < 0) return log("Montant fixe invalide.", "warning");
    void run(() => saveShareRule(r.key, pct, fixe), "Valeur enregistrée.").then(() =>
      setRuleDraft((x) => {
        const { [r.key]: _d, ...rest } = x;
        return rest;
      }),
    );
  };

  const openOverrides = (c: Commercial) => {
    setOpenId(openId === c.id ? null : c.id);
    const d: Draft = {};
    for (const [k, v] of Object.entries(c.overrides)) {
      d[k] = { pct: v?.pct != null ? String(v.pct) : "", fixe: v?.fixe != null ? String(v.fixe) : "" };
    }
    setOvDraft(d);
  };

  const saveOv = (c: Commercial) => {
    const ov: Overrides = {};
    for (const r of rules) {
      const d = ovDraft[r.key];
      if (!d) continue;
      const pct = num(d.pct);
      const fixe = num(d.fixe);
      if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) return log(`Pourcentage invalide pour « ${r.label} ».`, "warning");
      if (fixe != null && (!Number.isFinite(fixe) || fixe < 0)) return log(`Montant fixe invalide pour « ${r.label} ».`, "warning");
      if (pct != null || fixe != null) ov[r.key] = { pct, fixe };
    }
    void run(() => saveOverrides(c.id, ov), `Valeurs de ${c.nom} enregistrées.`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 text-xs">
        <span className="text-xs font-black uppercase text-slate-800">Parts des commerciaux — valeurs générales</span>
        <p className="text-[11px] text-slate-500">
          Chaque part se calcule sur la recette de NETLOG : la commission de la mission, ou le montant HT de l'abonnement.
          Pourcentage et montant fixe s'additionnent. NETLOG prélève toujours sa commission : les parts sont prélevées dessus.
        </p>
        {rules.map((r) => {
          const d = ruleDraft[r.key] ?? { pct: String(r.pct), fixe: String(r.fixe) };
          return (
            <div key={r.key} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center border-b border-slate-50 pb-2">
              <div className="sm:col-span-6">
                <b className="text-slate-900">{r.label}</b>
                <div className="text-[10px] text-slate-500">
                  Calculé sur : {r.base === "abonnement" ? "l'abonnement HT" : "la commission NETLOG de la mission"}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Pourcentage (%)</label>
                <input className={inputCls} inputMode="decimal" value={d.pct}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, [r.key]: { ...d, pct: e.target.value } })} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Fixe (DA HT)</label>
                <input className={inputCls} inputMode="decimal" value={d.fixe}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, [r.key]: { ...d, fixe: e.target.value } })} />
              </div>
              <div className="sm:col-span-2 text-right">
                <button disabled={busy || !ruleDraft[r.key]} onClick={() => saveRule(r)}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold cursor-pointer disabled:opacity-30">
                  Enregistrer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 text-xs">
        <span className="text-xs font-black uppercase text-slate-800">Commerciaux</span>
        {commerciaux.length === 0 && <p className="text-slate-500">Aucun commercial validé.</p>}
        {commerciaux.map((c) => (
          <div key={c.id} className="border border-slate-100 rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <b className="text-slate-900">{c.nom}</b> <span className="text-slate-500">{c.email}</span>
                <div className="text-[11px] text-slate-600">
                  {c.membres} membre(s) rattaché(s) · à régler : <b className="font-mono">{money(c.aPayer)} DA HT</b> · code :{" "}
                  <b className="font-mono">{c.code ?? "—"}</b>
                </div>
              </div>
              <div className="flex gap-2">
                {!c.code && (
                  <button disabled={busy} onClick={() => run(async () => { await generateReferralCode(c.id); }, "Code de recommandation créé.")}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold cursor-pointer">
                    Créer son code
                  </button>
                )}
                <button onClick={() => openOverrides(c)} className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold cursor-pointer">
                  {openId === c.id ? "Fermer" : "Valeurs individuelles"}
                </button>
              </div>
            </div>
            {openId === c.id && (
              <div className="space-y-2 pt-2 border-t border-slate-50">
                <p className="text-[10px] text-slate-500">Un champ vide reprend la valeur générale.</p>
                {rules.map((r) => {
                  const d = ovDraft[r.key] ?? { pct: "", fixe: "" };
                  return (
                    <div key={r.key} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-6 text-slate-700">{r.label}</div>
                      <div className="sm:col-span-3">
                        <input className={inputCls} inputMode="decimal" placeholder={`% (général : ${r.pct})`} value={d.pct}
                          onChange={(e) => setOvDraft({ ...ovDraft, [r.key]: { ...d, pct: e.target.value } })} />
                      </div>
                      <div className="sm:col-span-3">
                        <input className={inputCls} inputMode="decimal" placeholder={`Fixe (général : ${r.fixe})`} value={d.fixe}
                          onChange={(e) => setOvDraft({ ...ovDraft, [r.key]: { ...d, fixe: e.target.value } })} />
                      </div>
                    </div>
                  );
                })}
                <button disabled={busy} onClick={() => saveOv(c)} className="px-4 py-2 bg-[#1D9E75] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">
                  Enregistrer ses valeurs
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 text-xs">
        <span className="text-xs font-black uppercase text-slate-800">Rattacher un compte à un commercial</span>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="E-mail ou raison sociale (3 caractères minimum)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button
            onClick={async () => {
              try { setFound(await findAccounts(query)); } catch (err: any) { log(err?.message ?? "Recherche impossible.", "danger"); }
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer">
            Chercher
          </button>
        </div>
        {found.map((a) => (
          <div key={a.id} onClick={() => setTarget(a)}
            className={`p-2 border rounded-xl cursor-pointer ${target?.id === a.id ? "border-[#1D9E75] bg-emerald-50" : "border-slate-100"}`}>
            <b>{a.nom}</b> · {a.role} · {a.email}
          </div>
        ))}
        {target && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className={labelCls}>Commercial</label>
              <select className={inputCls} value={attachTo} onChange={(e) => setAttachTo(e.target.value)}>
                <option value="">— Aucun (recruté directement par NETLOG) —</option>
                {commerciaux.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <button disabled={busy} onClick={() => run(() => attachMember(target.id, attachTo || null), `${target.nom} : rattachement enregistré.`)}
              className="px-4 py-2 bg-[#1D9E75] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">
              Enregistrer le rattachement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
