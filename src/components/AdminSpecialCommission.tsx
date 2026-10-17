import React, { useRef, useState } from "react";
import {
  type OfferBrief,
  type SpecialCommission,
  loadOfferBrief,
  loadSpecial,
  saveSpecial,
  deleteSpecial,
} from "../lib/commissions";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";
const labelCls = "text-[10px] uppercase font-bold text-slate-500 block mb-1";
const ROLES: { value: SpecialCommission["beneficiaire"]; label: string }[] = [
  { value: "transporteur", label: "Commercial du transporteur" },
  { value: "donneur", label: "Commercial du donneur d'ordre" },
  { value: "publieur", label: "Commercial qui a publié l'offre" },
];
const ORIGINE: Record<string, string> = { donneur: "le donneur d'ordre", commercial: "un commercial", admin: "NETLOG" };

export default function AdminSpecialCommission({ triggerSystemLog }: { triggerSystemLog: Log }) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const log: Log = (m, t) => logRef.current(m, t);

  const [offerNo, setOfferNo] = useState("");
  const [offer, setOffer] = useState<OfferBrief | null>(null);
  const [existing, setExisting] = useState<SpecialCommission | null>(null);
  const [pct, setPct] = useState("");
  const [fixe, setFixe] = useState("");
  const [who, setWho] = useState<SpecialCommission["beneficiaire"]>("transporteur");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const id = Number(offerNo);
    if (!Number.isInteger(id) || id <= 0) return log("Indiquez un numéro d'offre valide.", "warning");
    try {
      const o = await loadOfferBrief(id);
      if (!o) {
        setOffer(null);
        setExisting(null);
        return log("Offre introuvable.", "warning");
      }
      const s = await loadSpecial(id);
      setOffer(o);
      setExisting(s);
      setPct(s?.pct != null ? String(s.pct) : "");
      setFixe(s?.fixe != null ? String(s.fixe) : "");
      setWho(s?.beneficiaire ?? "transporteur");
      setNote(s?.note ?? "");
    } catch (err: any) {
      log(err?.message ?? "Chargement impossible.", "danger");
    }
  };

  const save = async () => {
    if (!offer) return;
    const p = pct.trim() === "" ? null : Number(pct.replace(",", "."));
    const f = fixe.trim() === "" ? null : Number(fixe.replace(",", "."));
    if (p == null && f == null) return log("Indiquez un pourcentage, un montant fixe, ou les deux.", "warning");
    if (p != null && (!Number.isFinite(p) || p < 0 || p > 100)) return log("Pourcentage invalide.", "warning");
    if (f != null && (!Number.isFinite(f) || f < 0)) return log("Montant fixe invalide.", "warning");
    setBusy(true);
    try {
      await saveSpecial({ offer_id: offer.id, pct: p, fixe: f, beneficiaire: who, note: note.trim() || null });
      log("Commission spéciale enregistrée.", "success");
      await load();
    } catch (err: any) {
      log(err?.message ?? "Enregistrement impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!offer) return;
    setBusy(true);
    try {
      await deleteSpecial(offer.id);
      log("Commission spéciale supprimée : les taux normaux s'appliquent.", "success");
      await load();
    } catch (err: any) {
      log(err?.message ?? "Suppression impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-4 text-xs">
      <p className="text-[11px] text-slate-500">
        Une commission spéciale remplace, pour ce fret seulement, le taux normal du bénéficiaire choisi. Les autres
        bénéficiaires gardent leur taux. Elle s'applique à la confirmation de livraison et n'est jamais plafonnée.
      </p>
      <div className="flex gap-2 max-w-md">
        <input className={inputCls} inputMode="numeric" placeholder="N° de l'offre" value={offerNo}
          onChange={(e) => setOfferNo(e.target.value.replace(/\D/g, ""))} />
        <button onClick={load} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer">Charger</button>
      </div>
      {offer && (
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-xl p-3">
            Offre n° <b>{offer.id}</b> · {offer.marchandise}{offer.poidsT ? ` · ${offer.poidsT} t` : ""} · statut {offer.status}
            {offer.publieParRole && <> · publiée par <b>{ORIGINE[offer.publieParRole] ?? offer.publieParRole}</b></>}
            {existing && <div className="text-amber-700 font-bold mt-1">Une commission spéciale est déjà enregistrée.</div>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className={labelCls}>Bénéficiaire</label>
              <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value as SpecialCommission["beneficiaire"])}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Pourcentage du CA HT (%)</label>
              <input className={inputCls} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Montant fixe (DA HT)</label>
              <input className={inputCls} inputMode="decimal" value={fixe} onChange={(e) => setFixe(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Note interne</label>
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={save} className="px-4 py-2 bg-[#1D9E75] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">
              Enregistrer
            </button>
            {existing && (
              <button disabled={busy} onClick={remove} className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold cursor-pointer disabled:opacity-50">
                Supprimer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
