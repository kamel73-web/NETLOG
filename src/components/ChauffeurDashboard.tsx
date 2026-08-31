import React, { useState } from "react";
import { 
  MapPin, 
  Activity, 
  User, 
  CheckCircle, 
  AlertCircle,
  AlertTriangle, 
  Check, 
  Truck, 
  Calendar, 
  Smartphone, 
  Navigation,
  Info
} from "lucide-react";
import { OffreFret, OffreStatus, UserProfile, ProfileType } from "../types";
import { getMissionIdByOfferId, validateLoading, validateUnload } from "../lib/missions";

interface ChauffeurDashboardProps {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  offres: OffreFret[];
  users: UserProfile[];
  saveState: (
    users?: UserProfile[],
    moyens?: any[],
    offres?: OffreFret[],
    propositions?: any[],
    factures?: any[],
    devis?: any[]
  ) => void;
  lang: string;
  t: (key: string) => string;
  triggerSystemLog: (text: string, type: "success" | "danger" | "info") => void;
  translateCity: (city: string, lang: string) => string;
  translateMarchandise: (march: any, lang: string) => string;
}

export default function ChauffeurDashboard({
  currentUser,
  setCurrentUser,
  offres,
  users,
  saveState,
  lang,
  t,
  triggerSystemLog,
  translateCity,
  translateMarchandise
}: ChauffeurDashboardProps) {
  
  // Tab within Driver Dashboard: "missions" or "profil"
  const [driverTab, setDriverTab] = useState<"missions" | "profil">("missions");

  // State for driver profile updates
  const [positionInput, setPositionInput] = useState(currentUser.positionChauffeur || "");
  const [dispoState, setDispoState] = useState(currentUser.disponibiliteChauffeur || "Disponible");

  // Problem reporting states
  const [activeProblemOffreId, setActiveProblemOffreId] = useState<string | null>(null);
  const [problemText, setProblemText] = useState("");
  const [problemType, setProblemType] = useState("Retard de circulation");

  // OTP/Confirmation code validation state
  const [confirmingOffreId, setConfirmingOffreId] = useState<string | null>(null);
  const [enteredOtpCode, setEnteredOtpCode] = useState("");

  // Loading/Unloading Reserves tracking states
  const [loadingConfirmId, setLoadingConfirmId] = useState<string | null>(null);
  const [loadingReserves, setLoadingReserves] = useState("");
  const [hasLoadingReserves, setHasLoadingReserves] = useState(false);

  const [unloadingReserves, setUnloadingReserves] = useState("");
  const [hasUnloadingReserves, setHasUnloadingReserves] = useState(false);

  // Get carrier parent info
  const carrierParent = users.find(u => u.id === currentUser.transporteurParentId);

  // Filter assigned missions
  const assignedMissions = offres.filter(
    o => o.chauffeurId === currentUser.id && o.status !== OffreStatus.Publie
  );

  // Handle Driver Availability & Position save
  const handleSaveDriverStatus = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updatedUsers = users.map(u => {
      if (u.id === currentUser.id) {
        return {
          ...u,
          positionChauffeur: positionInput,
          disponibiliteChauffeur: dispoState as "Disponible" | "Indisponible"
        };
      }
      return u;
    });

    const updatedSelf = {
      ...currentUser,
      positionChauffeur: positionInput,
      disponibiliteChauffeur: dispoState as "Disponible" | "Indisponible"
    };

    setCurrentUser(updatedSelf);
    saveState(updatedUsers);
    
    const successMsg = lang === "ar"
      ? "تم تحديث حالتك المهنية وموقعك بنجاح !"
      : "Votre disponibilité et votre position ont été mises à jour !";
    triggerSystemLog(successMsg, "success");
  };

  // Handle Problem report
  const handleReportProblemSubmit = (e: React.FormEvent, offreId: string) => {
    e.preventDefault();
    if (!problemText.trim()) return;

    const fullProblemMsg = `[${problemType}] : ${problemText.trim()}`;

    const updatedOffres = offres.map(o => {
      if (o.id === offreId) {
        return {
          ...o,
          chauffeurSignaleProbleme: fullProblemMsg
        };
      }
      return o;
    });

    saveState(undefined, undefined, updatedOffres);
    
    const successMsg = lang === "ar"
      ? "تم إرسال بلاغ المشكلة إلى الناقل شريكك !"
      : "Le signalement d'anomalie a été transmis au transporteur !";
    triggerSystemLog(successMsg, "success");
    
    // Reset state
    setActiveProblemOffreId(null);
    setProblemText("");
  };

  // Clear reported problem
  const handleClearProblem = (offreId: string) => {
    const updatedOffres = offres.map(o => {
      if (o.id === offreId) {
        const { chauffeurSignaleProbleme, ...rest } = o;
        return rest as OffreFret;
      }
      return o;
    });

    saveState(undefined, undefined, updatedOffres);
    triggerSystemLog(
      lang === "ar" ? "تم وضع علامة حل للمشكلة !" : "Le problème a été résolu !",
      "success"
    );
  };

  // Handle Loading confirmation
  const handleConfirmLoading = async (offreId: string, reservesText?: string) => {
    const offerIdNum = Number(offreId);
    if (!Number.isFinite(offerIdNum)) {
      triggerSystemLog(lang === "ar" ? "معرف غير صالح" : "ID offre invalide.", "danger");
      return;
    }
    try {
      const missionId = await getMissionIdByOfferId(offerIdNum);
      await validateLoading(missionId, reservesText);
      const updated = offres.map(o => {
        if (o.id === offreId) {
          return {
            ...o,
            status: OffreStatus.Charge,
            reservesChargement: reservesText || undefined
          };
        }
        return o;
      });
      saveState(undefined, undefined, updated);
      setLoadingConfirmId(null);
      setLoadingReserves("");
      setHasLoadingReserves(false);
      triggerSystemLog(
        lang === "ar" ? "تم تأكيد التحميل" : "Chargement validé avec succès ! Véhicule en route.",
        "success"
      );
    } catch (err: any) {
      triggerSystemLog(`Échec chargement : ${err?.message ?? "erreur"}`, "danger");
    }
  };

  // Handle Unloading confirmation (requires confirmation code checking)
  const handleConfirmUnloading = async (e: React.FormEvent, offer: OffreFret) => {
    e.preventDefault();
    if (enteredOtpCode.trim() !== offer.codeConfirmation) {
      triggerSystemLog(
        lang === "ar"
          ? "رمز التأكيد غير صحيح"
          : "Code de confirmation incorrect ! Veuillez demander le bon code au client destinataire.",
        "danger"
      );
      return;
    }
    const offerIdNum = Number(offer.id);
    if (!Number.isFinite(offerIdNum)) {
      triggerSystemLog("ID offre invalide.", "danger");
      return;
    }
    try {
      const missionId = await getMissionIdByOfferId(offerIdNum);
      await validateUnload(missionId, hasUnloadingReserves ? unloadingReserves.trim() : undefined);
      const updated = offres.map(o => {
        if (o.id === offer.id) {
          return {
            ...o,
            status: OffreStatus.Decharge,
            reserves: hasUnloadingReserves ? unloadingReserves.trim() : o.reserves
          };
        }
        return o;
      });
      saveState(undefined, undefined, updated);
      setConfirmingOffreId(null);
      setEnteredOtpCode("");
      setUnloadingReserves("");
      setHasUnloadingReserves(false);
      triggerSystemLog(
        lang === "ar" ? "تم تأكيد التسليم" : "Livraison validée avec succès ! Le déchargement est clos.",
        "success"
      );
    } catch (err: any) {
      triggerSystemLog(`Échec déchargement : ${err?.message ?? "erreur"}`, "danger");
    }
  };

  return (
    <div className="space-y-6 select-none font-sans text-slate-800 dark:text-slate-100 max-w-7xl mx-auto px-1 sm:px-4">
      
      {/* HEADER CARD FOR DRIVER */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-6 sm:p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden ring-1 ring-white/10">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse"></span>
                {lang === "ar" ? "سائق معتمد" : "Chauffeur routier officiel"}
              </span>
              <span className="text-xs text-indigo-200">
                {lang === "ar" ? `تحت إشراف الناقل: ${carrierParent?.raisonSociale || "NETLOG Partner"}` : `Rattaché à : ${carrierParent?.raisonSociale || "NETLOG Partner"}`}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-serif uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-indigo-100">
              {currentUser.prenom} {currentUser.nom}
            </h1>
            <p className="text-xs text-indigo-200 font-medium max-w-lg leading-relaxed">
              {lang === "ar" 
                ? "مرحبًا بك في لوحة القيادة الخاصة بالسائقين. أدر حالة توفرك وموقعك، وقم بتأكيد عمليات التحميل والتسليم للمهام الموكلة إليك بكامل الموثوقية القانونية."
                : "Bienvenue dans votre console chauffeur. Gérez votre disponibilité, actualisez votre position en temps réel et validez les étapes de vos missions de fret de façon certifiée."
              }
            </p>
          </div>

          <div className="flex flex-col xs:flex-row gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl">
                <Activity className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <span className="text-[10px] text-indigo-200 font-semibold block uppercase tracking-wider">
                  {lang === "ar" ? "الحالة الحالية" : "Disponibilité"}
                </span>
                <span className="text-xs font-black text-amber-300">
                  {currentUser.disponibiliteChauffeur === "Indisponible" 
                    ? (lang === "ar" ? "غير متاح ⛔" : "Indisponible ⛔")
                    : currentUser.disponibiliteChauffeur === "En route"
                    ? (lang === "ar" ? "في الطريق 🚚" : "En route 🚚")
                    : (lang === "ar" ? "متاح للعمل 🟢" : "Disponible 🟢")
                  }
                </span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <span className="text-[10px] text-indigo-200 font-semibold block uppercase tracking-wider">
                  {lang === "ar" ? "الموقع الحالي" : "Position actuelle"}
                </span>
                <span className="text-xs font-black text-emerald-300 truncate max-w-[120px] block">
                  {currentUser.positionChauffeur || (lang === "ar" ? "غير محدد" : "Non définie")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD TABS (MISSIONS vs PROFIL) */}
      <div className="flex gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setDriverTab("missions")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
            driverTab === "missions" 
              ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/10" 
              : "bg-white dark:bg-slate-900 text-slate-750 dark:text-slate-200 border border-slate-100 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <span>🚚 {lang === "ar" ? "المهام الموكلة إليّ" : "Mes missions affectées"}</span>
          <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {assignedMissions.length}
          </span>
        </button>

        <button
          onClick={() => setDriverTab("profil")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
            driverTab === "profil" 
              ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/10" 
              : "bg-white dark:bg-slate-900 text-slate-750 dark:text-slate-200 border border-slate-100 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <span>👤 {lang === "ar" ? "تعديل حالتي وموقعي" : "Statut & Position"}</span>
        </button>
      </div>

      {/* SUBTAB 1: MISSIONS ASSIGNED TO THIS DRIVER */}
      {driverTab === "missions" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-850">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                {lang === "ar" ? "متابعة الرحلات النشطة" : "Suivi opérationnel des expéditions"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {lang === "ar" 
                  ? "قم بتحديث مراحل النقل (مسؤولية تامة وموثقة)."
                  : "Assurez la traçabilité de vos chargements et livraisons de bout en bout."
                }
              </p>
            </div>
            
            <span className="text-xs font-semibold text-slate-500 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-indigo-950/20 rounded-xl">
              ⚙️ {lang === "ar" ? "مزامنة لوحة القيادة حية" : "Mise à jour en temps réel"}
            </span>
          </div>

          {assignedMissions.length === 0 ? (
            <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 p-12 rounded-[2rem] text-center max-w-2xl mx-auto">
              <span className="text-5xl block mb-4">📭</span>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                {lang === "ar" ? "لا توجد مهام موكلة حاليًا" : "Aucune mission planifiée"}
              </h3>
              <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
                {lang === "ar" 
                  ? "لم يقم الناقل بتعيين أي رحلات شحن نشطة لك حتى الآن. اتصل بمشرف الأسطول للتخصيص."
                  : "Le transporteur ne vous a attribué aucune mission de transport active pour le moment. Rapprochez-vous de votre responsable d'exploitation."
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedMissions.map((offer) => {
                const hasProblemReported = !!offer.chauffeurSignaleProbleme;
                return (
                  <div 
                    key={offer.id}
                    className={`bg-white dark:bg-slate-900 border rounded-[2rem] p-5 shadow-sm transition-all flex flex-col justify-between ${
                      hasProblemReported 
                        ? "border-rose-400 dark:border-rose-900 ring-4 ring-rose-50/70 dark:ring-rose-950/20" 
                        : "border-slate-100 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-750"
                    }`}
                  >
                    <div>
                      {/* HEAD OF MISSION CARD */}
                      <div className="flex justify-between items-start gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                        <div>
                          <span className="font-mono text-[10px] text-slate-400 font-extrabold block">
                            MISSION REF
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            #{offer.id}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-xl shadow-xs ${
                          offer.status === OffreStatus.Attribue ? "bg-amber-100 text-amber-800 border border-amber-200" :
                          offer.status === OffreStatus.Charge ? "bg-blue-100 text-blue-800 border border-blue-200 animate-pulse" :
                          offer.status === OffreStatus.Decharge ? "bg-purple-100 text-purple-800 border border-purple-200" :
                          "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}>
                          {offer.status}
                        </span>
                      </div>

                      {/* ROUTE */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 flex items-center justify-center font-bold text-xs">
                            A
                          </span>
                          <div className="leading-tight">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">
                              {lang === "ar" ? "نقطة الشحن" : "Lieu de départ"}
                            </span>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                              {translateCity(offer.depart, lang)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 flex items-center justify-center font-bold text-xs">
                            B
                          </span>
                          <div className="leading-tight">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">
                              {lang === "ar" ? "نقطة التفريغ" : "Lieu d'arrivée"}
                            </span>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                              {translateCity(offer.arrivee, lang)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARGO DETAILS */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl space-y-2 mb-4">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500 font-bold">{lang === "ar" ? "المادة شحن :" : "Marchandise :"}</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-right">
                            {translateMarchandise(offer.marchandise, lang)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500 font-bold">{lang === "ar" ? "الحمولة الإجمالية :" : "Poids Total :"}</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200">
                            🏗️ {offer.poids} Tonnes
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500 font-bold">{lang === "ar" ? "المطلوب :" : "Exigence véhicule :"}</span>
                          <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            🚛 {offer.moyenExige}
                          </span>
                        </div>
                      </div>

                      {/* CRITICAL WARNING: PROBLEM DISPLAY */}
                      {hasProblemReported && (
                        <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-900 dark:text-rose-200 space-y-1.5 mb-4">
                          <div className="flex items-center gap-1.5 font-bold uppercase text-[9.5px]">
                            <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
                            <span>⚠️ {lang === "ar" ? "مشكلة تم إبلاغها للناقل :" : "Problème signalé au bureau :"}</span>
                          </div>
                          <p className="italic font-semibold bg-white dark:bg-slate-900 px-2 py-1.5 rounded-lg border border-rose-100 dark:border-rose-950 leading-relaxed">
                            "{offer.chauffeurSignaleProbleme}"
                          </p>
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleClearProblem(offer.id)}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              💡 {lang === "ar" ? "مارك كمحلول" : "Marquer comme résolu"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* OPERATIONS PANEL (DRIVER TASKS) */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2 space-y-2 shrink-0">
                      
                      {/* Active Actions */}
                      {offer.status === OffreStatus.Attribue && (
                        <div>
                          {loadingConfirmId === offer.id ? (
                            <div className="bg-amber-50/70 border border-amber-200 dark:bg-slate-950 p-4 rounded-2xl space-y-3 shadow-inner text-xs">
                              <h4 className="font-extrabold text-amber-950 dark:text-amber-200 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                🏢 {lang === "ar" ? "تأكيد واستلام الشحنة" : "Confirmation de Chargement / Enregistrement"}
                              </h4>
                              
                              <div className="space-y-1.5">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={hasLoadingReserves}
                                    onChange={(e) => {
                                      setHasLoadingReserves(e.target.checked);
                                      if (!e.target.checked) setLoadingReserves("");
                                    }}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="font-extrabold text-slate-700 dark:text-slate-300">
                                    ⚠️ {lang === "ar" ? "تسجيل تحفظات على الشحن" : "Signaler des réserves au chargement"}
                                  </span>
                                </label>
                                
                                {hasLoadingReserves && (
                                  <textarea
                                    value={loadingReserves}
                                    onChange={(e) => setLoadingReserves(e.target.value)}
                                    placeholder={lang === "ar" ? "اكتب التحفظات هنا (مثال: بضاعة مبللة، تغليف ممزق...)" : "Saisir les précisions de réserve (ex: colis cassé, palettes mouillées, emballage détérioré...)"}
                                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-amber-500 focus:outline-none"
                                    rows={2}
                                  />
                                )}
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleConfirmLoading(offer.id, hasLoadingReserves ? loadingReserves.trim() : undefined)}
                                  disabled={hasLoadingReserves && !loadingReserves.trim()}
                                  className="flex-1 py-1.5 bg-[#1d9e75] hover:bg-[#157a5a] text-white rounded-xl text-[11px] font-extrabold cursor-pointer transition disabled:opacity-50"
                                >
                                  ✅ {lang === "ar" ? "تأكيد المغادرة" : "Confirmer"}
                                </button>
                                <button
                                  onClick={() => {
                                    setLoadingConfirmId(null);
                                    setLoadingReserves("");
                                    setHasLoadingReserves(false);
                                  }}
                                  className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-[11px] font-extrabold cursor-pointer hover:bg-slate-300"
                                >
                                  {lang === "ar" ? "إلغاء" : "Annuler"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setLoadingConfirmId(offer.id);
                                setLoadingReserves("");
                                setHasLoadingReserves(false);
                              }}
                              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition select-none uppercase tracking-wide animate-bounce-slow"
                            >
                              📦 {lang === "ar" ? "بدء التحميل ومغادرة الموقع !" : "Valider Chargement exécuté !"}
                            </button>
                          )}
                        </div>
                      )}

                      {offer.status === OffreStatus.Charge && (
                        <div>
                          {confirmingOffreId === offer.id ? (
                            <form onSubmit={(e) => handleConfirmUnloading(e, offer)} className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-150 space-y-3">
                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-indigo-950 dark:text-indigo-200 uppercase">
                                  {lang === "ar" ? "كود تأكيد العميل (4 أرقام) :" : "Saisir Code de déchargement destinataire :"}
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    maxLength={4}
                                    placeholder="Ex: 1234"
                                    required
                                    value={enteredOtpCode}
                                    onChange={(e) => setEnteredOtpCode(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-center font-mono font-black text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                              </div>

                              <div className="space-y-2 pt-1.5 border-t border-indigo-100/30">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={hasUnloadingReserves}
                                    onChange={(e) => {
                                      setHasUnloadingReserves(e.target.checked);
                                      if (!e.target.checked) setUnloadingReserves("");
                                    }}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="font-extrabold text-slate-700 dark:text-slate-300 text-[11px]">
                                    ⚠️ {lang === "ar" ? "تحفظات عند الاستلام" : "Signaler des réserves au déchargement"}
                                  </span>
                                </label>

                                {hasUnloadingReserves && (
                                  <textarea
                                    value={unloadingReserves}
                                    onChange={(e) => setUnloadingReserves(e.target.value)}
                                    placeholder={lang === "ar" ? "اكتب التحفظات على التسليم هنا..." : "Saisir les anomalies de déchargement/état..."}
                                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none text-xs"
                                    rows={2}
                                  />
                                )}
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  type="submit"
                                  disabled={hasUnloadingReserves && !unloadingReserves.trim()}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition disabled:opacity-50"
                                >
                                  🏁 OK {lang === "ar" ? "تأكيد التسليم" : "Valider livraison"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmingOffreId(null);
                                    setEnteredOtpCode("");
                                    setUnloadingReserves("");
                                    setHasUnloadingReserves(false);
                                  }}
                                  className="px-3 py-1.5 bg-slate-200 text-slate-700 dark:bg-slate-850 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-300"
                                >
                                  {lang === "ar" ? "إلغاء" : "Annuler"}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              onClick={() => {
                                setConfirmingOffreId(offer.id);
                                setEnteredOtpCode("");
                                setUnloadingReserves("");
                                setHasUnloadingReserves(false);
                              }}
                              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition uppercase tracking-wide"
                            >
                              🏁 {lang === "ar" ? "تسليم البضاعة (أدخل كود التفريغ)" : "Déchargement exécuté !"}
                            </button>
                          )}
                        </div>
                      )}

                      {offer.status === OffreStatus.Decharge && (
                        <div className="p-2.5 bg-purple-50 dark:bg-[#1C182A] border border-purple-150 rounded-2xl text-center flex items-center justify-center gap-2 text-[11px] text-purple-950 dark:text-purple-200">
                          <CheckCircle className="w-4 h-4 text-purple-600" />
                          <span className="font-extrabold">
                            {lang === "ar" ? "بإنتظار المصادقة النهائية للكلينت" : "Livraison effectuée. En attente de clôture."}
                          </span>
                        </div>
                      )}

                      {offer.status === OffreStatus.Valide && (
                        <div className="p-2.5 bg-emerald-50 dark:bg-[#0C1E14] border border-emerald-150 rounded-2xl text-center flex items-center justify-center gap-2 text-[11px] text-emerald-950 dark:text-emerald-250">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="font-extrabold">
                            {lang === "ar" ? "رحلة مغلقة بنجاح ومصادق عليها !" : "Mission clôturée avec succès !"}
                          </span>
                        </div>
                      )}

                      {/* REPORT PROBLEM BUTTON OR SCREEN */}
                      {offer.status !== OffreStatus.Valide && (
                        <div>
                          {activeProblemOffreId === offer.id ? (
                            <form onSubmit={(e) => handleReportProblemSubmit(e, offer.id)} className="bg-rose-50 dark:bg-slate-900 border border-rose-100 p-3 rounded-2xl space-y-2 mt-2">
                              <span className="text-[10px] font-black text-rose-800 uppercase block">🚨 Signaler un incident</span>
                              
                              <select
                                value={problemType}
                                onChange={(e) => setProblemType(e.target.value)}
                                className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold cursor-pointer focus:outline-none"
                              >
                                <option value="Panne moteur">👨‍🔧 Panne moteur / Camion bloqué</option>
                                <option value="Retard de circulation">🚗 Retard (Trafic / Bouchons)</option>
                                <option value="Accident de la route">⚠️ Accident / Sinistre routier</option>
                                <option value="Contrôle de gendarmerie">🚔 Contrôle par les forces de l'ordre</option>
                                <option value="Litige marchandise">📦 Problème d'arrimage / Litige marchandise</option>
                                <option value="Problème climat (Intempéries)">☁️ Intempéries extrêmes</option>
                              </select>

                              <textarea
                                rows={2}
                                value={problemText}
                                onChange={(e) => setProblemText(e.target.value)}
                                placeholder="Détaillez brièvement le problème pour l'exploitant..."
                                className="w-full p-2 bg-white text-xs text-slate-950 border border-slate-300 rounded-xl"
                                required
                              />

                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  className="flex-1 py-1.5 bg-red-650 hover:bg-red-750 text-white rounded-lg text-[10px] font-extrabold cursor-pointer transition select-none"
                                >
                                  Transmettre l'alerte
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveProblemOffreId(null)}
                                  className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 text-[10px] font-extrabold cursor-pointer"
                                >
                                  Annuler
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              onClick={() => {
                                setActiveProblemOffreId(offer.id);
                                setProblemText("");
                              }}
                              className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-extrabold text-[10px] rounded-xl cursor-pointer hover:shadow-xs flex items-center justify-center gap-1 transition"
                            >
                              🚨 {lang === "ar" ? "تبليغ الناقل بحدوث مشكلة أو تأخير" : "Signaler une anomalie / un retard"}
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: DRIVER PROFILE EDIT */}
      {driverTab === "profil" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-6 shadow-sm max-w-2xl mx-auto">
          <div className="border-b pb-4 mb-5 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/25 rounded-2xl">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                {lang === "ar" ? "إعدادات المهنة والجاهزية" : "Actualiser ma situation professionnelle"}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === "ar" 
                  ? "قم بتعديل موقعك الجغرافي وحالة نشاطك لتمكين فريق النقل من تخصيص عقود الشحن بدقة."
                  : "Mettez à jour vos indicateurs pour recevoir des propositions de fret ciblées par votre transporteur."
                }
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveDriverStatus} className="space-y-5 text-xs font-semibold">
            {/* STATUS SELECT */}
            <div className="space-y-2">
              <label className="block text-slate-600 font-bold uppercase tracking-wide text-[10px]">
                {lang === "ar" ? "حالة التوفر المهني للحمولات *" : "Ma disponibilité actuelle *"}
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setDispoState("Disponible")}
                  className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                    dispoState === "Disponible"
                      ? "bg-emerald-50/70 text-emerald-950 border-emerald-400 font-extrabold shadow-sm ring-2 ring-emerald-500/10"
                      : "bg-white dark:bg-slate-950 text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-lg">🟢</span>
                  <span className="text-xs font-black">{lang === "ar" ? "متاح للعمل" : "Disponible"}</span>
                  <span className="text-[9.5px] text-slate-400 font-medium">Prêt pour un chargement immédiat</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDispoState("En route")}
                  className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                    dispoState === "En route"
                      ? "bg-amber-50/70 text-amber-950 border-amber-400 font-extrabold shadow-sm ring-2 ring-amber-500/10"
                      : "bg-white dark:bg-slate-950 text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-lg">🚚</span>
                  <span className="text-xs font-black">{lang === "ar" ? "في الطريق" : "En route"}</span>
                  <span className="text-[9.5px] text-slate-400 font-medium">Actuellement sur la route (Transport)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDispoState("Indisponible")}
                  className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                    dispoState === "Indisponible"
                      ? "bg-rose-50/70 text-rose-950 border-rose-400 font-extrabold shadow-sm ring-2 ring-rose-500/10"
                      : "bg-white dark:bg-slate-950 text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-lg">🚫</span>
                  <span className="text-xs font-black">{lang === "ar" ? "غير متاح" : "Indisponible / Occupé"}</span>
                  <span className="text-[9.5px] text-slate-400 font-medium">En pause ou absent temporairement</span>
                </button>
              </div>
            </div>

            {/* LOCATION INPUT */}
            <div className="space-y-1.5">
              <label className="block text-slate-600 font-bold uppercase tracking-wide text-[10px]">
                {lang === "ar" ? "موقعي الجغرافي الحالي / الولاية *" : "Ma position routière actuelle (Wilaya) *"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={positionInput}
                  onChange={(e) => setPositionInput(e.target.value)}
                  placeholder="Ex: Alger center, Oran, Sétif... "
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 border border-slate-250 dark:border-slate-800 rounded-xl font-bold font-sans text-xs focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                />
                <MapPin className="w-4 h-4 text-slate-450 absolute left-3 top-3.5" />
              </div>
              <p className="text-[10px] text-slate-400 italic">
                {lang === "ar" 
                  ? "هذا المؤشر حيوي لإطلاع مشغلي النقل على موقع سيارتك."
                  : "Utile pour que le répartiteur puisse visualiser au mieux la situation géo-logistique de votre ensemble routier."
                }
              </p>
            </div>

            {/* DRIVER INFO INFOS CARD READONLY */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2">
              <span className="text-[9.5px] font-black uppercase text-indigo-700 tracking-wider block">🏢 NETLOG PRO-DRIVE CARD</span>
              <div className="grid grid-cols-2 gap-4 text-[11px] font-medium text-slate-600 dark:text-slate-350">
                <p><b>Nom complet :</b> {currentUser.prenom} {currentUser.nom}</p>
                <p><b>Raison démo :</b> {currentUser.raisonSociale}</p>
                <p><b>Téléphone pro :</b> {currentUser.tel}</p>
                <p><b>Rôle système :</b> CHAUFFEUR ROUTIER</p>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-650 dark:hover:bg-indigo-750 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer text-center uppercase tracking-wide transition"
            >
              💾 {lang === "ar" ? "حفظ التعديلات على الملف" : "Enregistrer les modifications sur mon profil"}
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
