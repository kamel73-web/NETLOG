import React, { useEffect, useRef, useState } from "react";
import { ProfileType } from "../types";
import {
  type Affiliate,
  type Invitation,
  type CarrierHit,
  type AffiliateQuota,
  loadAffiliateQuota,
  loadMyAffiliates,
  loadMyInvitations,
  searchCarriers,
  inviteCarrier,
  respondAffiliation,
  removeAffiliation,
} from "../lib/affiliates";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;

const STATUT_LABEL: Record<string, string> = { en_attente: "En attente de réponse", accepte: "Affilié", refuse: "Refusé" };
const STATUT_TONE: Record<string, string> = {
  en_attente: "text-amber-700",
  accepte: "text-emerald-700",
  refuse: "text-rose-600",
};
const OWNER_LABEL: Record<string, string> = { donneur_ordre: "Donneur d'ordre", commissionnaire: "Commissionnaire" };
const dmy = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";

export default function AffiliationChip({ currentUser, triggerSystemLog }: { currentUser: any; triggerSystemLog: Log }) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const isOwner =
    currentUser?.profil === ProfileType.DonneurOrdre || currentUser?.profil === ProfileType.Commissionnaire;
  const isCarrier = currentUser?.profil === ProfileType.Transporteur;
  const eligible = (isOwner || isCarrier) && currentUser?.status === "valide";

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<AffiliateQuota | null>(null);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CarrierHit[]>([]);
  const [searched, setSearched] = useState(false);

  const refresh = async () => {
    try {
      if (isOwner) {
        const [q, a] = await Promise.all([loadAffiliateQuota(), loadMyAffiliates()]);
        setQuota(q);
        setAffiliates(a);
      } else if (isCarrier) {
        setInvitations(await loadMyInvitations());
      }
    } catch (err) {
      console.error("Affiliations:", err);
    }
  };

  useEffect(() => {
    if (eligible) void refresh();
  }, [eligible, currentUser?.id]);
  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  if (!eligible) return null;

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      logRef.current(ok, "success");
      await refresh();
    } catch (err: any) {
      logRef.current(err?.message ?? "Opération impossible.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const doSearch = async () => {
    if (query.trim().length < 3) {
      logRef.current("Saisissez au moins 3 caractères.", "warning");
      return;
    }
    try {
      setHits(await searchCarriers(query.trim()));
      setSearched(true);
    } catch (err: any) {
      logRef.current(err?.message ?? "Recherche impossible.", "danger");
    }
  };

  const accepted = affiliates.filter((a) => a.statut === "accepte").length;
  const pending = invitations.filter((i) => i.statut === "en_attente").length;
  const unlimited = (quota?.limite ?? 0) >= 1000000;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={isOwner ? "Mes transporteurs affiliés" : "Mes invitations d'affiliation"}
        className={`px-2.5 py-1.5 rounded-full border text-[11px] font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
          isCarrier && pending > 0
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        }`}
      >
        🤝 <span>{isOwner ? `Affiliés${quota ? ` (${accepted})` : ""}` : "Invitations"}</span>
        {isCarrier && pending > 0 && (
          <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{pending}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">
                {isOwner ? "Mes transporteurs affiliés" : "Mes affiliations"}
              </h3>
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">
                Fermer
              </button>
            </div>

            {isOwner && (
              <>
                <p className="text-slate-500">
                  Vos transporteurs affiliés peuvent recevoir des offres qui leur sont réservées, invisibles pour les
                  autres transporteurs. Un transporteur doit accepter votre invitation pour être affilié.
                </p>
                {quota && !quota.autorise ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
                    Votre forfait ne comprend pas l'option « transporteurs affiliés ». Choisissez un forfait qui l'inclut
                    pour réserver des offres à vos transporteurs.
                  </div>
                ) : (
                  <>
                    {quota && (
                      <div className="bg-slate-50 rounded-2xl p-3">
                        Transporteurs affiliés ou invités : <b>{quota.utilises}</b> sur <b>{unlimited ? "illimité" : quota.limite}</b>
                      </div>
                    )}
                    <div className="border border-slate-100 rounded-2xl p-3 space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-800 block">Inviter un transporteur</span>
                      <div className="flex gap-2">
                        <input
                          className={inputCls}
                          placeholder="Nom ou téléphone du transporteur (3 caractères minimum)"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void doSearch();
                          }}
                        />
                        <button onClick={doSearch} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer">
                          Chercher
                        </button>
                      </div>
                      {searched && hits.length === 0 && <p className="text-slate-500">Aucun transporteur validé ne correspond.</p>}
                      {hits.map((h) => (
                        <div key={h.carrier_id} className="flex items-center justify-between gap-2 border-t border-slate-50 pt-2">
                          <span>
                            <b className="text-slate-900">{h.nom}</b>
                            {h.wilaya ? <span className="text-slate-500"> · {h.wilaya}</span> : null}
                          </span>
                          {h.deja ? (
                            <span className="text-slate-500 font-bold">Déjà dans votre liste</span>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  await inviteCarrier(h.carrier_id);
                                  setHits((list) => list.map((x) => (x.carrier_id === h.carrier_id ? { ...x, deja: true } : x)));
                                }, `Invitation envoyée à ${h.nom}.`)
                              }
                              className="px-3 py-1.5 bg-[#1D9E75] text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
                            >
                              Inviter
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-800 block mb-1">Ma liste</span>
                  {affiliates.length === 0 ? (
                    <p className="text-slate-500">Aucun transporteur affilié pour le moment.</p>
                  ) : (
                    affiliates.map((a) => (
                      <div key={a.member_id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
                        <span>
                          <b className="text-slate-900">{a.nom}</b>
                          {a.wilaya ? <span className="text-slate-500"> · {a.wilaya}</span> : null}
                          <span className={`ml-2 font-bold ${STATUT_TONE[a.statut] ?? ""}`}>{STATUT_LABEL[a.statut] ?? a.statut}</span>
                        </span>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(`Retirer ${a.nom} de votre liste ? Il ne verra plus vos offres réservées ouvertes.`)) return;
                            void run(() => removeAffiliation(a.member_id), `${a.nom} retiré de votre liste.`);
                          }}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold cursor-pointer disabled:opacity-50"
                        >
                          Retirer
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {isCarrier && (
              <>
                <p className="text-slate-500">
                  Un donneur d'ordre ou un commissionnaire qui vous affilie peut vous réserver des offres de fret. Vous
                  gardez la liberté d'accepter ou de refuser, et de quitter une affiliation à tout moment.
                </p>
                {invitations.length === 0 ? (
                  <p className="text-slate-500">Aucune invitation pour le moment.</p>
                ) : (
                  invitations.map((i) => (
                    <div key={i.member_id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
                      <span>
                        <b className="text-slate-900">{i.owner_nom}</b>
                        <span className="text-slate-500"> · {OWNER_LABEL[i.owner_role] ?? i.owner_role} · {dmy(i.depuis)}</span>
                        <span className={`ml-2 font-bold ${STATUT_TONE[i.statut] ?? ""}`}>{STATUT_LABEL[i.statut] ?? i.statut}</span>
                      </span>
                      <span className="flex gap-2">
                        {i.statut === "en_attente" && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => run(() => respondAffiliation(i.member_id, true), `Affiliation avec ${i.owner_nom} acceptée.`)}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
                            >
                              Accepter
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => run(() => respondAffiliation(i.member_id, false), "Invitation refusée.")}
                              className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold cursor-pointer disabled:opacity-50"
                            >
                              Refuser
                            </button>
                          </>
                        )}
                        {i.statut === "accepte" && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Quitter l'affiliation avec ${i.owner_nom} ?`)) return;
                              void run(() => removeAffiliation(i.member_id), "Affiliation quittée.");
                            }}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold cursor-pointer disabled:opacity-50"
                          >
                            Quitter
                          </button>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
