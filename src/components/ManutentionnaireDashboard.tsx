import React, { useState } from "react";
import { MapPin, Package, Edit } from "lucide-react";
import type { UserProfile, OffreFret } from "../types";

interface Props {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  lang: string;
  t: (key: string) => string;
  offres: OffreFret[];
  triggerSystemLog: (text: string, type: "success" | "danger" | "info") => void;
}

export default function ManutentionnaireDashboard({ currentUser, triggerSystemLog }: Props) {
  const [disponibilite, setDisponibilite] = useState<"Disponible" | "Occupé" | "Congé">("Disponible");
  const [editMode, setEditMode] = useState(false);

  const dipoColors: Record<string, string> = {
    "Disponible": "bg-emerald-100 text-emerald-700",
    "Occupé": "bg-orange-100 text-orange-700",
    "Congé": "bg-slate-100 text-slate-500",
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-5 rounded-3xl shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-200">🏗️ Manutentionnaire</span>
            <h2 className="text-base font-black mt-0.5">{currentUser.raisonSociale || `${currentUser.prenom} ${currentUser.nom}`}</h2>
            <p className="text-xs text-amber-100 mt-0.5 flex items-center gap-1"><MapPin size={11}/> {currentUser.wilaya}</p>
          </div>
          <span className={`text-xs font-black px-3 py-1.5 rounded-full ${dipoColors[disponibilite]}`}>{disponibilite}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Ma fiche prestataire</h3>
          <button onClick={() => setEditMode(!editMode)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition">
            <Edit size={12}/> {editMode ? "Fermer" : "Modifier"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: "Type d'engins", value: currentUser.typeEntite },
            { label: "Zone d'intervention", value: currentUser.wilaya },
            { label: "Wilaya d'activité", value: currentUser.wilayaActivite },
            { label: "Contact", value: currentUser.tel },
          ].map((item, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 font-semibold mb-0.5">{item.label}</p>
              <p className="font-bold text-slate-800">{item.value || "Non renseigné"}</p>
            </div>
          ))}
        </div>
        {editMode && (
          <div className="border-t border-slate-100 pt-3">
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Disponibilité</label>
            <div className="flex gap-2">
              {(["Disponible", "Occupé", "Congé"] as const).map(d => (
                <button key={d} onClick={() => { setDisponibilite(d); triggerSystemLog(`Disponibilité : ${d}`, "success"); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${disponibilite === d ? dipoColors[d] + " ring-2 ring-current" : "bg-slate-100 text-slate-500"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Demandes disponibles</h3>
        </div>
        <div className="p-6 text-center text-slate-400">
          <Package className="mx-auto mb-3 text-slate-300" size={28}/>
          <p className="text-xs">Les demandes de manutention apparaîtront ici (LOT 5).</p>
        </div>
      </div>
    </div>
  );
}
