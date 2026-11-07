import React, { useEffect, useRef, useState } from "react";
import { ProfileType, MoyenType } from "../types";
import { createVehicle, updateVehicle } from "../lib/freightOffers";
import { createDriver } from "../lib/drivers";
import {
  type FleetAccess,
  type FleetVehicle,
  type FleetDriver,
  loadFleetAccess,
  loadFleetVehicles,
  loadFleetDrivers,
  deleteFleetVehicle,
} from "../lib/fleet";

type Log = (msg: string, type: "success" | "info" | "warning" | "danger") => void;

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1D9E75] bg-white text-slate-900";
const labelCls = "text-[10px] uppercase font-bold text-slate-500 block mb-1";
const TYPES = Object.values(MoyenType) as string[];
const fmtPhone = (p: string) => (p.startsWith("+") ? p : p ? `+${p}` : "—");

export default function FleetChip({ currentUser, triggerSystemLog }: { currentUser: any; triggerSystemLog: Log }) {
  const logRef = useRef<Log>(triggerSystemLog);
  logRef.current = triggerSystemLog;
  const eligible =
    (currentUser?.profil === ProfileType.DonneurOrdre || currentUser?.profil === ProfileType.Commissionnaire) &&
    currentUser?.status === "valide";

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<FleetAccess | null>(null);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);

  // formulaire camion
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vType, setVType] = useState<string>(TYPES[0] ?? "");
  const [vPlate, setVPlate] = useState("");
  const [vTons, setVTons] = useState("");
  const [vBrand, setVBrand] = useState("");
  const [vModel, setVModel] = useState("");
  const [vAvailable, setVAvailable] = useState(true);

  // formulaire chauffeur
  const [dNom, setDNom] = useState("");
  const [dPrenom, setDPrenom] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dCode, setDCode] = useState("");
  const [created, setCreated] = useState<{ phone: string; code: string } | null>(null);

  const ownerId: string | undefined = currentUser?.id;

  const refresh = async () => {
    if (!ownerId) return;
    try {
      const [a, v, d] = await Promise.all([loadFleetAccess(), loadFleetVehicles(ownerId), loadFleetDrivers(ownerId)]);
      setAccess(a);
      setVehicles(v);
      setDrivers(d);
    } catch (err) {
      console.error("Flotte propre:", err);
    }
  };

  useEffect(() => {
    if (eligible) void refresh();
  }, [eligible, ownerId]);
  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  if (!eligible) return null;

  const run = async (fn: () => Promise<void>, ok: string): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      logRef.current(ok, "success");
      await refresh();
      return true;
    } catch (err: any) {
      logRef.current(err?.message ?? "Opération impossible.", "danger");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const resetVehicleForm = () => {
    setEditingId(null);
    setShowVehicleForm(false);
    setVType(TYPES[0] ?? "");
    setVPlate("");
    setVTons("");
    setVBrand("");
    setVModel("");
    setVAvailable(true);
  };

  const editVehicle = (v: FleetVehicle) => {
    setEditingId(v.id);
    setVType(v.type || (TYPES[0] ?? ""));
    setVPlate(v.immatriculation);
    setVTons(v.capaciteKg ? String(v.capaciteKg / 1000) : "");
    setVBrand(v.marque);
    setVModel(v.modele);
    setVAvailable(v.disponible);
    setShowVehicleForm(true);
  };

  const saveVehicle = async () => {
    const tons = Number(vTons.replace(",", "."));
    if (!vPlate.trim()) return logRef.current("Indiquez l'immatriculation.", "warning");
    if (!Number.isFinite(tons) || tons <= 0) return logRef.current("Indiquez le poids utile en tonnes.", "warning");
    const input = {
      type: vType,
      immatriculation: vPlate.trim(),
      capaciteKg: Math.round(tons * 1000),
      isAvailable: vAvailable,
      marque: vBrand.trim(),
      modele: vModel.trim(),
    };
    const ok = await run(async () => {
      if (editingId != null) await updateVehicle(editingId, input);
      else await createVehicle(input);
    }, editingId != null ? "Camion modifié." : "Camion ajouté à votre flotte.");
    if (ok) resetVehicleForm();
  };

  const removeVehicle = (v: FleetVehicle) => {
    if (!window.confirm(`Retirer le camion ${v.immatriculation} de votre flotte ?`)) return;
    void run(() => deleteFleetVehicle(v.id), "Camion retiré.");
  };

  const saveDriver = async () => {
    if (!dNom.trim() || !dPrenom.trim()) return logRef.current("Nom et prénom obligatoires.", "warning");
    if (!/^\d{6}$/.test(dCode)) return logRef.current("Le code d'accès doit comporter exactement 6 chiffres.", "warning");
    const ok = await run(async () => {
      const r = await createDriver({ nom: dNom.trim(), prenom: dPrenom.trim(), phone: dPhone.trim(), password: dCode });
      setCreated({ phone: r.phone, code: dCode });
    }, "Chauffeur créé.");
    if (ok) {
      setDNom("");
      setDPrenom("");
      setDPhone("");
      setDCode("");
    }
  };

  const unlimited = (access?.limite ?? 0) >= 1000000;
  const locked = access ? !access.autorise : false;
  const atLimit = Boolean(access && access.autorise && access.actifs >= access.limite);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Ma flotte propre : camions et chauffeurs"
        className="px-2.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
      >
        🚛 <span>Ma flotte{access && access.autorise ? ` (${access.actifs})` : ""}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Ma flotte propre</h3>
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">
                Fermer
              </button>
            </div>

            {locked ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
                Votre forfait ne comprend pas l'option « flotte propre ». Choisissez un forfait qui l'inclut pour
                enregistrer vos camions et vos chauffeurs.
              </div>
            ) : (
              <>
                <p className="text-slate-500">
                  Enregistrez ici vos propres camions et vos chauffeurs. Les chauffeurs se connectent à NETLOG avec leur
                  numéro de téléphone et le code à 6 chiffres que vous leur donnez.
                </p>

                {/* ---------- CAMIONS ---------- */}
                <div className="border border-slate-100 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase text-slate-800">
                      Camions
                      {access ? ` : ${access.actifs} actif(s) sur ${unlimited ? "illimité" : access.limite}` : ""}
                      {access && access.total > access.actifs ? ` · ${access.total - access.actifs} désactivé(s)` : ""}
                    </span>
                    {!showVehicleForm && (
                      <button
                        disabled={atLimit}
                        title={atLimit ? "Limite de camions de votre forfait atteinte" : undefined}
                        onClick={() => {
                          resetVehicleForm();
                          setShowVehicleForm(true);
                        }}
                        className="px-3 py-1.5 bg-[#1D9E75] text-white rounded-lg font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        + Ajouter un camion
                      </button>
                    )}
                  </div>

                  {showVehicleForm && (
                    <div className="bg-slate-50 rounded-2xl p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Type</label>
                          <select className={inputCls} value={vType} onChange={(e) => setVType(e.target.value)}>
                            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Immatriculation</label>
                          <input className={inputCls} value={vPlate} onChange={(e) => setVPlate(e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Poids utile (tonnes)</label>
                          <input className={inputCls} inputMode="decimal" value={vTons} onChange={(e) => setVTons(e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Marque</label>
                          <input className={inputCls} value={vBrand} onChange={(e) => setVBrand(e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Modèle</label>
                          <input className={inputCls} value={vModel} onChange={(e) => setVModel(e.target.value)} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
                          <input type="checkbox" checked={vAvailable} onChange={(e) => setVAvailable(e.target.checked)} />
                          Disponible
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button disabled={busy} onClick={saveVehicle}
                          className="px-4 py-2 bg-[#1D9E75] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">
                          {editingId != null ? "Enregistrer" : "Ajouter"}
                        </button>
                        <button onClick={resetVehicleForm} className="px-4 py-2 border border-slate-200 rounded-xl font-bold cursor-pointer">
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {vehicles.length === 0 ? (
                    <p className="text-slate-500">Aucun camion enregistré.</p>
                  ) : (
                    vehicles.map((v) => (
                      <div key={v.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-0 ${v.desactive ? "opacity-50" : ""}`}>
                        <span>
                          <b className="text-slate-900">🚛 {v.immatriculation}</b>
                          <span className="text-slate-500">
                            {" "}· {v.type}{v.marque ? ` · ${v.marque}${v.modele ? " " + v.modele : ""}` : ""} · {v.capaciteKg / 1000} t
                          </span>
                          {v.desactive ? (
                            <span className="ml-2 font-bold text-rose-600">🔒 Désactivé par votre forfait</span>
                          ) : (
                            <span className={`ml-2 font-bold ${v.disponible ? "text-emerald-700" : "text-amber-700"}`}>
                              {v.disponible ? "Disponible" : "Non disponible"}
                            </span>
                          )}
                        </span>
                        <span className="flex gap-2">
                          <button disabled={busy || v.desactive} onClick={() => editVehicle(v)}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold cursor-pointer disabled:opacity-30">
                            Modifier
                          </button>
                          <button disabled={busy} onClick={() => removeVehicle(v)}
                            className="px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg font-bold cursor-pointer disabled:opacity-50">
                            Retirer
                          </button>
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* ---------- CHAUFFEURS ---------- */}
                <div className="border border-slate-100 rounded-2xl p-4 space-y-3">
                  <span className="text-[11px] font-black uppercase text-slate-800 block">Chauffeurs ({drivers.length})</span>
                  <div className="bg-slate-50 rounded-2xl p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nom</label>
                        <input className={inputCls} value={dNom} onChange={(e) => setDNom(e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Prénom</label>
                        <input className={inputCls} value={dPrenom} onChange={(e) => setDPrenom(e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Mobile (05, 06 ou 07…)</label>
                        <input className={inputCls} inputMode="tel" value={dPhone} onChange={(e) => setDPhone(e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Code d'accès (6 chiffres)</label>
                        <input className={inputCls} inputMode="numeric" maxLength={6} value={dCode}
                          onChange={(e) => setDCode(e.target.value.replace(/\D/g, ""))} />
                      </div>
                    </div>
                    <button disabled={busy} onClick={saveDriver}
                      className="px-4 py-2 bg-[#1D9E75] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">
                      + Ajouter un chauffeur
                    </button>
                    {created && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-emerald-900">
                        Chauffeur créé. Donnez-lui son identifiant <b className="font-mono">{fmtPhone(created.phone)}</b> et son
                        code <b className="font-mono">{created.code}</b> : il ne sera plus affiché.
                      </div>
                    )}
                  </div>

                  {drivers.length === 0 ? (
                    <p className="text-slate-500">Aucun chauffeur enregistré.</p>
                  ) : (
                    drivers.map((d) => (
                      <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <span>
                          <b className="text-slate-900">👤 {[d.prenom, d.nom].filter(Boolean).join(" ") || "Chauffeur"}</b>
                          <span className="text-slate-500"> · {fmtPhone(d.phone)}</span>
                        </span>
                        <span className={`font-bold ${d.actif ? "text-emerald-700" : "text-slate-400"}`}>{d.actif ? "Actif" : "Inactif"}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
