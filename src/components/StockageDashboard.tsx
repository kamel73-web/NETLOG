import React, { useState } from "react";
import { Warehouse, MapPin, Package, Edit, BarChart3, Clock } from "lucide-react";
import type { UserProfile } from "../types";

interface StockageDashboardProps {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  lang: string;
  t: (key: string) => string;
  triggerSystemLog: (text: string, type: "success" | "danger" | "info") => void;
}

export default function StockageDashboard({
  currentUser, triggerSystemLog
}: StockageDashboardProps) {
  const [disponibilite, setDisponibilite] = useState<"Disponible" | "Complet" | "Partiel">("Disponible");
  const [editMode, setEditMode] = useState(false);

  const metadata = currentUser.metadata ?? {};
  const commune =
    typeof metadata.commune === "string" ? metadata.commune : "";

  const dipoColors: Record<string, string> = {
    "Disponible": "bg-emerald-100 text-emerald-700",
    "Complet": "bg-red-100 text-red-700",
    "Partiel": "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-700 text-white p-5 rounded-3xl shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">
              🏭 Prestataire de Stockage
            </span>
            <h2 className="text-base font-black mt-0.5">
              {currentUser.raisonSociale || `${currentUser.prenom} ${currentUser.nom}`}
            </h2>
            <p className="text-xs text-blue-200 mt-0.5 flex items-center gap-1">
              <MapPin size={11}/> {currentUser.wilaya}
              {commune && ` • ${commune}`}
            </p>
          </div>
          <span className={`text-xs font-black px-3 py-1.5 rounded-full ${dipoColors[disponibilite]}`}>
            {disponibilite}
          </span>
        </div>
      </div>

      {/* Fiche entrepôt */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Fiche entrepôt</h3>
          <button onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition">
            <Edit size={12}/> {editMode ? "Fermer" : "Modifier"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Type d'entrepôt</p>
            <p className="font-bold text-slate-800">{currentUser.typeEntite || "Non renseigné"}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Capacité</p>
            <p className="font-bold text-slate-800">
              {currentUser.volumeFret ? `${currentUser.volumeFret} m²` : "Non renseignée"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Wilaya</p>
            <p className="font-bold text-slate-800">{currentUser.wilaya || "Non renseignée"}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Commune</p>
            <p className="font-bold text-slate-800">{commune || "Non renseignée"}</p>
          </div>
        </div>

        {editMode && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <div>
              <label className="text-[10px] text-slate-500 font-semibold block mb-1">
                Disponibilité de l'espace
              </label>
              <div className="flex gap-2">
                {(["Disponible", "Partiel", "Complet"] as const).map(d => (
                  <button key={d} onClick={() => {
                    setDisponibilite(d);
                    triggerSystemLog(`Disponibilité mise à jour : ${d}`, "success");
                  }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      disponibilite === d ? dipoColors[d] + " ring-2 ring-current" : "bg-slate-100 text-slate-500"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Lots stockés", value: "0", icon: <Package size={16} className="text-blue-600"/>, bg: "bg-blue-50" },
          { label: "Taux remplissage", value: "0%", icon: <BarChart3 size={16} className="text-orange-600"/>, bg: "bg-orange-50" },
          { label: "Jours actifs", value: "0", icon: <Clock size={16} className="text-emerald-600"/>, bg: "bg-emerald-50" },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-4 text-center`}>
            <div className="flex justify-center mb-1">{s.icon}</div>
            <p className="text-lg font-black text-slate-800">{s.value}</p>
            <p className="text-[10px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Demandes de stockage */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Demandes de stockage disponibles
          </h3>
        </div>
        <div className="p-6 text-center text-slate-400">
          <Warehouse className="mx-auto mb-3 text-slate-300" size={28}/>
          <p className="text-xs">Les demandes de stockage apparaîtront ici.</p>
          <p className="text-[10px] text-slate-400 mt-1">Fonctionnalité complète disponible en LOT 5.</p>
        </div>
      </div>
    </div>
  );
}
