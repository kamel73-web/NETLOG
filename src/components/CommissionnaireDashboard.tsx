import React, { useState } from "react";
import { Network, Truck, FileText, Plus, Eye, MapPin, Phone } from "lucide-react";
import { ProfileType, OffreStatus } from "../types";
import type { UserProfile, OffreFret, MoyenTransport, PropositionPrix, Facture } from "../types";

interface CommissionnaireDashboardProps {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  lang: string;
  t: (key: string) => string;
  offres: OffreFret[];
  users: UserProfile[];
  moyens: MoyenTransport[];
  propositions: PropositionPrix[];
  factures: Facture[];
  saveState: (...args: any[]) => void;
  triggerSystemLog: (text: string, type: "success" | "danger" | "info") => void;
  setCurrentTab: (tab: string) => void;
}

export default function CommissionnaireDashboard({
  currentUser, lang, offres, users, moyens, propositions, factures, triggerSystemLog, setCurrentTab
}: CommissionnaireDashboardProps) {
  const [activeTab, setActiveTab] = useState<"apercu" | "reseau" | "offres">("apercu");

  const transporteurs = users.filter(u => u.profil === ProfileType.Transporteur);
  const mesOffres = offres.filter(o => o.donneurId === currentUser.id);
  const offresActives = mesOffres.filter(o => o.status === OffreStatus.Publie || o.status === OffreStatus.Attribue);
  const mesFactures = factures.filter(f => f.donneurId === currentUser.id);
  const caTotal = mesFactures.reduce((s, f) => s + (f.montant || 0), 0);

  const tabs = [
    { id: "apercu", label: "Apercu", icon: <FileText size={14}/> },
    { id: "reseau", label: "Mon Reseau", icon: <Network size={14}/> },
    { id: "offres", label: "Mes Offres", icon: <Truck size={14}/> },
  ];

  return (
    <div className="space-y-5 pb-10">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              🔗 Commissionnaire / Transitaire
            </span>
            <h2 className="text-base font-black mt-0.5">
              {currentUser.raisonSociale || currentUser.prenom + " " + currentUser.nom}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{currentUser.wilaya} — {currentUser.nrc}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Reseau actif</p>
            <p className="text-2xl font-black text-emerald-400">{transporteurs.length}</p>
            <p className="text-[10px] text-slate-400">transporteurs</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={"flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all " + (
              activeTab === tab.id
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
            )}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "apercu" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Offres actives", value: offresActives.length, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Total offres", value: mesOffres.length, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Transporteurs", value: transporteurs.length, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "CA total (DA)", value: caTotal.toLocaleString("fr-DZ"), color: "text-purple-600", bg: "bg-purple-50" },
            ].map((kpi, i) => (
              <div key={i} className={kpi.bg + " rounded-2xl p-4"}>
                <p className="text-[10px] text-slate-500 font-semibold">{kpi.label}</p>
                <p className={"text-xl font-black mt-1 " + kpi.color}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Offres recentes</h3>
              <button onClick={() => setActiveTab("offres")} className="text-[10px] text-emerald-600 font-bold hover:underline">Voir tout</button>
            </div>
            {mesOffres.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                Aucune offre publiee.
                <button onClick={() => setCurrentTab("publier")}
                  className="block mx-auto mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition">
                  + Publier une offre
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {mesOffres.slice(0, 5).map(o => (
                  <div key={o.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{o.depart} vers {o.arrivee}</p>
                      <p className="text-[10px] text-slate-400">{o.marchandise} - {o.poids}T</p>
                    </div>
                    <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + (
                      o.status === OffreStatus.Publie ? "bg-emerald-100 text-emerald-700"
                      : o.status === OffreStatus.Attribue ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-500"
                    )}>{o.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "reseau" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">Reseau de transporteurs</h3>
            <button onClick={() => triggerSystemLog("Invitation envoyee (LOT 3)", "info")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition">
              <Plus size={12}/> Inviter
            </button>
          </div>
          {transporteurs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <Network className="mx-auto text-slate-300 mb-3" size={32}/>
              <p className="text-xs text-slate-500">Votre reseau est vide.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {transporteurs.map(t => (
                <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Truck size={16} className="text-slate-600"/>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{t.raisonSociale || t.prenom + " " + t.nom}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <MapPin size={10}/> {t.wilaya}
                        {t.tel && <><Phone size={10} className="ml-2"/> {t.tel}</>}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                    {moyens.filter(m => m.transporteurId === t.id).length} vehicules
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "offres" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">Mes offres de fret</h3>
            <button onClick={() => setCurrentTab("publier")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition">
              <Plus size={12}/> Nouvelle offre
            </button>
          </div>
          {mesOffres.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <FileText className="mx-auto text-slate-300 mb-3" size={32}/>
              <p className="text-xs text-slate-500">Aucune offre publiee.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mesOffres.map(o => {
                const props = propositions.filter(p => p.offreId === o.id);
                return (
                  <div key={o.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-black text-slate-800">{o.depart} vers {o.arrivee}</p>
                        <p className="text-[10px] text-slate-400">{o.marchandise} - {o.poids}T - {o.nombreVoyages} voyage(s)</p>
                      </div>
                      <span className={"text-[10px] font-bold px-2 py-1 rounded-full " + (
                        o.status === OffreStatus.Publie ? "bg-emerald-100 text-emerald-700"
                        : o.status === OffreStatus.Attribue ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                      )}>{o.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{props.length} proposition(s)</span>
                      {o.prixFixe && <span className="font-bold text-slate-700">{o.prixFixe.toLocaleString("fr-DZ")} DA</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
