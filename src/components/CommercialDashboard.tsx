import React, { useState } from "react";
import { 
  Briefcase, 
  Users, 
  Truck, 
  Building, 
  DollarSign, 
  TrendingUp, 
  PlusCircle, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  FolderOpen, 
  MapPin, 
  Award, 
  Calendar, 
  Clock, 
  Grid,
  ChevronRight,
  ArrowUpRight,
  X,
  CreditCard,
  UserCheck
} from "lucide-react";
import { UserProfile, ProfileType, OffreFret, OffreStatus, MoyenType } from "../types";

interface CommercialDashboardProps {
  currentUser: UserProfile;
  setCurrentUser: (u: UserProfile) => void;
  lang: "fr" | "ar";
  t: (key: any) => string;
  saveState: (
    users?: UserProfile[],
    moyens?: any[],
    offres?: OffreFret[],
    propositions?: any[],
    factures?: any[]
  ) => void;
  offres: OffreFret[];
  users: UserProfile[];
  propositions: any[];
  factures: any[];
  triggerSystemLog: (text: string, type: "success" | "danger" | "info") => void;
}

export default function CommercialDashboard({
  currentUser,
  lang,
  saveState,
  offres,
  users,
  propositions,
  factures,
  triggerSystemLog
}: CommercialDashboardProps) {
  // Tabs: dashboard, transporteurs, affreteurs, commissions
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "transporteurs" | "affreteurs" | "commissions">("dashboard");

  // Filter or search state for tables
  const [transporteurSearch, setTransporteurSearch] = useState("");
  const [doSearch, setDoSearch] = useState("");

  // Recruitment Forms visibility
  const [showRecrutTrans, setShowRecrutTrans] = useState(false);
  const [showRecrutDO, setShowRecrutDO] = useState(false);

  // Transporteur Form State
  const [transNom, setTransNom] = useState("");
  const [transPrenom, setTransPrenom] = useState("");
  const [transTel, setTransTel] = useState("");
  const [transWilaya, setTransWilaya] = useState("31 - Oran");
  const [transCamion, setTransCamion] = useState(MoyenType.Tautliner);
  const [transImmat, setTransImmat] = useState("");

  // DO Form State
  const [doRaisonSociale, setDoRaisonSociale] = useState("");
  const [doNomContact, setDoNomContact] = useState("");
  const [doTel, setDoTel] = useState("");
  const [doWilaya, setDoWilaya] = useState("16 - Alger");
  const [doSecteur, setDoSecteur] = useState("BTP / Matériaux de Construction");

  // Virement Modal State
  const [showVirementModal, setShowVirementModal] = useState(false);
  const [virementAmount, setVirementAmount] = useState("11100");
  const [virementRIB, setVirementRIB] = useState("");
  const [virementType, setVirementType] = useState<"CCP" | "AGB" | "BNA" | "BEA">("CCP");
  const [virementMsg, setVirementMsg] = useState("");

  // Current selected user for detail modal view
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserProfile | null>(null);

  // Fictional local payouts logs for commissions history
  const [payoutRequests, setPayoutRequests] = useState<any[]>([
    { id: "pay-1", date: "2026-04-12", type: "CCP", amount: 15400, status: "Payé", ref: "CCP-992182-DZ" },
    { id: "pay-2", date: "2026-05-05", type: "AGB", amount: 12100, status: "Payé", ref: "AGB-881261-DZ" }
  ]);

  // Farid's reference code
  const referralCode = "NETLOG-BVF-781";

  // Seeding effect: ensures that the 18 default portfolio actors are injected into the global synchronized store on mount if missing
  React.useEffect(() => {
    const hasPortfolioUsers = users.some(u => u.sourceDecouverte === referralCode);
    if (!hasPortfolioUsers) {
      const seeded: UserProfile[] = Array.from({ length: 18 }).map((_, i) => {
        const isDO = (i % 3 === 0);
        const nameIndex = i % 8;
        const orgIndex = i % 5;
        return {
          id: isDO ? `sim-aff-do-${i}` : `sim-aff-trans-${i}`,
          nom: ["Benzekri", "Hamidi", "Mekid", "Kaci", "Belkacem", "Zaoui", "Bouzid", "Khelil"][nameIndex],
          prenom: ["Ahmed", "Yacine", "Karim", "Farid", "Sofia", "Amine", "Nour", "Walid"][nameIndex],
          raisonSociale: isDO
            ? ["SARL BATIMEX", "SPA ALGERIA FOOD", "Etablissement Bois d'Algérie", "Sarl Nord-Sud Fret", "SPA AGROAL"][orgIndex]
            : ["Trans-Benzekri Eurl", "Eurl Hamidi Logistique", "Sté Belkacem & Fils", "Kaci Transports Internationaux", "Mekid Transport"][orgIndex],
          nrc: `31/00-0982737 B ${26 + i}`,
          adresse: isDO ? "Zone Industrielle Dar El Beida, Alger" : "Zone Industrielle Hassi Ameur, Oran",
          email: `${isDO ? "do" : "trans"}-affilie-${i + 1}@bvf.dz`,
          tel: `0555 ${12 + i} 45 89`,
          profil: isDO ? ProfileType.DonneurOrdre : ProfileType.Transporteur,
          status: "valide",
          wilaya: isDO ? "16 - Alger" : "31 - Oran",
          nbCamions: isDO ? undefined : String(2 + (i % 4)),
          secteur: isDO ? ["Matériaux de construction", "Agroalimentaire", "Bois & Dérivés", "Logistique", "Alimentation"][orgIndex] : undefined,
          sourceDecouverte: referralCode,
          dateInscription: `2026-05-${Math.min(25, 1 + i * 2)}`,
          // Base status: active for some, pending/inactive for others to allow instant testing of the toggles
          hasAbonnement: !isDO && (i % 2 === 0), 
          conventionSignee: isDO && (i % 2 === 0)
        };
      });
      saveState([...users, ...seeded], undefined, undefined, undefined, undefined);
    }
  }, [users, saveState]);

  // Live filtered users from global shared store
  const networkTransporteurs = users.filter(
    u => u.profil === ProfileType.Transporteur && u.sourceDecouverte === referralCode
  );

  const networkDOs = users.filter(
    u => u.profil === ProfileType.DonneurOrdre && u.sourceDecouverte === referralCode
  );

  // Quick Action Toggles to persist modifications across reloads
  const toggleTransporteurSubscription = (userId: string) => {
    const updated = users.map(u => {
      if (u.id === userId) {
        const nextState = !u.hasAbonnement;
        triggerSystemLog(
          nextState 
            ? `Abonnement conclu pour le transporteur ! Commission fixe de 5 000 DA enregistrée.` 
            : `Abonnement réinitialisé pour le transporteur.`,
          nextState ? "success" : "info"
        );
        return {
          ...u,
          hasAbonnement: nextState,
          dateAbonnement: nextState ? new Date().toISOString().split("T")[0] : undefined,
          typeAbonnement: nextState ? "mensuel" : undefined
        };
      }
      return u;
    });
    saveState(updated, undefined, undefined, undefined, undefined);
  };

  const toggleDOConvention = (userId: string) => {
    const updated = users.map(u => {
      if (u.id === userId) {
        const nextState = !u.conventionSignee;
        triggerSystemLog(
          nextState 
            ? `Convention commerciale signée ! Les commissions de 5% sur son chiffre d'affaires sont débloquées.` 
            : `Signature de la convention révoquée. Commissions suspendues.`,
          nextState ? "success" : "info"
        );
        return {
          ...u,
          conventionSignee: nextState,
          dateConvention: nextState ? new Date().toISOString().split("T")[0] : undefined
        };
      }
      return u;
    });
    saveState(updated, undefined, undefined, undefined, undefined);
  };

  // Compute the exact financial figures from the real updated data
  const subscribedTransporteursCount = networkTransporteurs.filter(t => t.hasAbonnement).length;
  const fixedCommissions = subscribedTransporteursCount * 5000;

  // Calcul unique pour chaque DO : volume d'affaires (simulate base + add real offers matched)
  const getDoStatistics = (doUser: UserProfile) => {
    const isBatimex = doUser.raisonSociale.includes("BATIMEX");
    
    // To make it clear that the commission is paid ONLY on amounts actually paid by the Donneur d'Ordre!
    // We split simulated baseline and real freight transactions into Paid and Unpaid/Pending amounts.
    const baseSimulatedVolume = isBatimex ? 350000 : 150000;
    // 80% is actually paid, 20% is pending invoice payment
    const baseSimulatedPaid = isBatimex ? 280000 : 120000;
    const baseSimulatedUnpaid = baseSimulatedVolume - baseSimulatedPaid;

    // Real offers published by this DO
    const matchedOffres = offres.filter(o => o.donneurRaisonSociale === doUser.raisonSociale || o.donneurId === doUser.id);
    
    // Real paid/settled amount = matched offers that are Fully Validated/Closed AND have an associated PAID invoice.
    // Or simplied matching with our factures store: 
    const realPaidPrestations = factures
      .filter(f => (f.donneurId === doUser.id || f.donneurRaisonSociale === doUser.raisonSociale) && f.status === "Facture Réglée")
      .reduce((sum, f) => sum + f.montant, 0);

    const realUnpaidPrestations = factures
      .filter(f => (f.donneurId === doUser.id || f.donneurRaisonSociale === doUser.raisonSociale) && f.status !== "Facture Réglée")
      .reduce((sum, f) => sum + f.montant, 0);

    // If there are no custom invoices in the state but the offers are validated, we assume they are paid.
    // This allows seamless fallback for simple matches.
    const settledOffres = matchedOffres.filter(o => o.status === OffreStatus.Valide);
    const hasAnyInvoices = factures.some(f => f.donneurId === doUser.id || f.donneurRaisonSociale === doUser.raisonSociale);
    
    let realPaidAmount = realPaidPrestations;
    let realUnpaidAmount = realUnpaidPrestations;
    
    if (!hasAnyInvoices) {
      // Fallback: If no invoices are created yet for this DO, count OffreStatus.Valide as paid, and progress/en route as pending.
      realPaidAmount = settledOffres.reduce((sum, o) => sum + (o.prixFixe || 65000), 0);
      const pendingOffres = matchedOffres.filter(o => o.status !== OffreStatus.Valide);
      realUnpaidAmount = pendingOffres.reduce((sum, o) => sum + (o.prixFixe || 10000), 0);
    }

    const totalTurnover = baseSimulatedVolume + realPaidAmount + realUnpaidAmount;
    const paidTurnover = baseSimulatedPaid + realPaidAmount;
    const unpaidTurnover = baseSimulatedUnpaid + realUnpaidAmount;

    // Variable commission is 5% ON THE PAID AMOUNT ONLY IF convention is signed!
    const variableCommEarned = doUser.conventionSignee ? Math.round(paidTurnover * 0.05) : 0;
    const potentialUnpaidComm = doUser.conventionSignee ? Math.round(unpaidTurnover * 0.05) : 0;

    return {
      totalTurnover,
      paidTurnover,
      unpaidTurnover,
      realPrestationsCount: settledOffres.length,
      realMatchedOffersCount: matchedOffres.filter(o => o.status === OffreStatus.Valide).length,
      variableCommEarned,
      potentialUnpaidComm
    };
  };

  const variableCommissions = networkDOs.reduce((sum, doUser) => sum + getDoStatistics(doUser).variableCommEarned, 0);
  const unpaidVariableCommissions = networkDOs.reduce((sum, doUser) => sum + getDoStatistics(doUser).potentialUnpaidComm, 0);

  // Combined real-time commissions sum
  const totalCommissionsValidees = fixedCommissions + variableCommissions;
  const totalCommissionsEnAttente = (networkDOs.filter(doUser => !doUser.conventionSignee).length * 4500) + unpaidVariableCommissions;

  // Render a lovely transaction ledger from network activity
  const recentTransactions = [
    { date: "2026-05-24", subject: "SARL BATIMEX", mission: "Alger ➔ Oran (Cargaison ciment réglée par DO)", comm: 2500, status: "Validée" },
    { date: "2026-05-23", subject: "Trans-Benzekri Eurl", mission: "Abonnement Mensuel Conclu", comm: 5000, status: "Validée" },
    { date: "2026-05-20", subject: "Eurl Hamidi Logistique", mission: "Abonnement Mensuel Conclu", comm: 5000, status: "Payée" },
    { date: "2026-05-24", subject: "SARL BATIMEX", mission: "Oran ➔ Béchar (18t céramique)", comm: 500, status: "Validée" },
    { date: "2026-05-23", subject: "Eurl Hamidi Logistique", mission: "Sétif ➔ Alger (12t boissons)", comm: 200, status: "Validée" },
    { date: "2026-05-22", subject: "SPA ALGERIA FOOD", mission: "Alger ➔ Oran (20t semoule)", comm: 500, status: "En attente" },
    { date: "2026-05-21", subject: "Sté Belkacem & Fils", mission: "Boumerdès ➔ Constantine (8t câbles)", comm: 500, status: "Validée" },
    { date: "2026-05-18", subject: "Mekid Transport", mission: "Oran ➔ Alger (15t acier)", comm: 200, status: "Payée" }
  ];

  // Handler for adding a transporteur
  const submitTransporteur = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transNom || !transPrenom || !transTel || !transImmat) {
      triggerSystemLog("Veuillez remplir tous les champs obligatoires du transporteur !", "danger");
      return;
    }

    const newTrans: UserProfile = {
      id: `user-trans-${Date.now()}`,
      nom: transNom,
      prenom: transPrenom,
      raisonSociale: `Eurl ${transNom} Transports`,
      nrc: `31/00-1038291 B 26`,
      adresse: `Wilaya de ${transWilaya}`,
      email: `${transNom.toLowerCase()}.${transPrenom.toLowerCase()}@bvf-affile.dz`,
      tel: transTel,
      profil: ProfileType.Transporteur,
      status: "valide",
      wilaya: transWilaya,
      nbCamions: "1",
      sourceDecouverte: referralCode,
      dateInscription: new Date().toISOString().split("T")[0]
    };

    // Update global users list
    const updatedUsers = [newTrans, ...users];
    saveState(updatedUsers, undefined, undefined, undefined, undefined);

    triggerSystemLog(`Transporteur ${transPrenom} ${transNom} inscrit avec succès ! Un lien d'invitation complet a été généré.`, "success");
    
    // Reset form
    setTransNom("");
    setTransPrenom("");
    setTransTel("");
    setTransImmat("");
    setShowRecrutTrans(false);
  };

  // Handler for adding a DO (Donneur d'Ordre)
  const submitDO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doRaisonSociale || !doNomContact || !doTel) {
      triggerSystemLog("Veuillez remplir tous les champs obligatoires de l'affréteur !", "danger");
      return;
    }

    const newDO: UserProfile = {
      id: `user-do-${Date.now()}`,
      nom: doNomContact.split(" ")[1] || doNomContact,
      prenom: doNomContact.split(" ")[0] || "Contact",
      raisonSociale: doRaisonSociale,
      nrc: `16/00-2938127 B 26`,
      adresse: `Wilaya de ${doWilaya}`,
      email: `${doRaisonSociale.toLowerCase().replace(/\s+/g, "")}@bvf-affile.dz`,
      tel: doTel,
      profil: ProfileType.DonneurOrdre,
      status: "valide",
      wilaya: doWilaya,
      secteur: doSecteur,
      sourceDecouverte: referralCode,
      dateInscription: new Date().toISOString().split("T")[0]
    };

    // Update global users
    const updatedUsers = [newDO, ...users];
    saveState(updatedUsers, undefined, undefined, undefined, undefined);

    triggerSystemLog(`Affréteur / DO ${doRaisonSociale} enregistré avec succès dans votre portefeuille.`, "success");

    // Reset form
    setDoRaisonSociale("");
    setDoNomContact("");
    setDoTel("");
    setShowRecrutDO(false);
  };

  // Request payout handler
  const handleSendPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!virementRIB) {
      triggerSystemLog("Veuillez saisir votre numéro de compte (RIB ou CCP) !", "danger");
      return;
    }

    const amt = parseFloat(virementAmount) || 0;
    if (amt <= 0 || amt > 14500) {
      triggerSystemLog("Veuillez spécifier un montant valide inférieur ou égal à votre solde net payable.", "danger");
      return;
    }

    const newReq = {
      id: `pay-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      type: virementType,
      amount: amt,
      status: "En attente",
      ref: `${virementType}-PENDING-${Math.floor(Math.random() * 900000 + 100000)}`
    };

    setPayoutRequests([newReq, ...payoutRequests]);
    setShowVirementModal(false);
    triggerSystemLog(`Demande de virement de ${amt.toLocaleString()} DA enregistrée ! Notre service financier NETLOG inspecte votre dossier de commissionnement sous 48h.`, "success");
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION WITH WALLET RESUME */}
      <div className="bg-gradient-to-r from-teal-900 to-[#1D9E75] text-white p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="bg-emerald-850 bg-teal-850/40 text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-wider border border-white/20">
              💼 Espace Commercial BVF — Partenaire Certifié
            </span>
            <h2 className="text-2xl md:text-3xl font-black font-sans leading-tight">
              Bonjour Farid 💼
            </h2>
            <p className="text-xs text-emerald-100 font-medium">
              Code de recommandation commercial : <span className="font-mono font-bold bg-white/10 px-2 py-0.5 rounded tracking-wide text-white">{referralCode}</span> • Votre résumé d'activité du mois courant (Mai 2026)
            </p>
          </div>
          
          {/* Dashboard Indicators Subgrid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-auto">
            <div 
              onClick={() => setActiveSubTab("transporteurs")}
              className="bg-white/10 p-4 rounded-2xl border border-white/15 backdrop-blur-xs cursor-pointer hover:bg-white/20 hover:border-white/35 hover:-translate-y-0.5 transition-all duration-205 group"
              title="Cliquez pour gérer votre réseau de transporteurs"
              id="kpi-comm-network"
            >
              <span className="text-[9px] uppercase font-bold text-teal-200 block tracking-wider group-hover:text-white transition-colors">👥 Réseau total</span>
              <span className="text-lg md:text-xl font-black font-mono underline decoration-dotted">18 membres</span>
            </div>
            
            <div 
              onClick={() => window.scrollTo({ top: 400, behavior: 'smooth' })}
              className="bg-white/10 p-4 rounded-2xl border border-white/15 backdrop-blur-xs cursor-pointer hover:bg-white/20 hover:border-white/35 hover:-translate-y-0.5 transition-all duration-205 group"
              title="Défiler pour afficher le suivi des missions"
              id="kpi-comm-missions"
            >
              <span className="text-[9px] uppercase font-bold text-teal-200 block tracking-wider group-hover:text-white transition-colors">🚛 Missions ce mois</span>
              <span className="text-lg md:text-xl font-black font-mono underline decoration-dotted">23</span>
            </div>

            <div 
              onClick={() => setActiveSubTab("commissions")}
              className="bg-white/10 p-4 rounded-2xl border border-white/15 backdrop-blur-xs cursor-pointer hover:bg-white/20 hover:border-white/35 hover:-translate-y-0.5 transition-all duration-205 group"
              title="Cliquez pour voir vos commissions validées"
              id="kpi-comm-validated"
            >
              <span className="text-[9px] uppercase font-bold text-teal-200 block tracking-wider group-hover:text-white transition-colors">💰 Comm. Validées</span>
              <span className="text-lg md:text-xl font-black font-mono text-amber-300 underline decoration-dotted">{totalCommissionsValidees.toLocaleString()} DA</span>
            </div>

            <div 
              onClick={() => setActiveSubTab("commissions")}
              className="bg-white/10 p-4 rounded-2xl border border-white/15 backdrop-blur-xs cursor-pointer hover:bg-white/20 hover:border-white/35 hover:-translate-y-0.5 transition-all duration-205 group"
              title="Cliquez pour voir vos commissions en attente"
              id="kpi-comm-pending"
            >
              <span className="text-[9px] uppercase font-bold text-teal-200 block tracking-wider group-hover:text-white transition-colors">⏳ En attente</span>
              <span className="text-lg md:text-xl font-black font-mono text-orange-200 underline decoration-dotted">{totalCommissionsEnAttente.toLocaleString()} DA</span>
            </div>
          </div>
        </div>
      </div>

      {/* CORE FOUR TABS */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto max-w-full scrolling-touch">
        <button 
          onClick={() => setActiveSubTab("dashboard")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer tracking-wide flex items-center gap-2 shrink-0 transition-all ${
            activeSubTab === "dashboard" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>📊 Tableau de bord</span>
        </button>
        <button 
          onClick={() => setActiveSubTab("transporteurs")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer tracking-wide flex items-center gap-2 shrink-0 transition-all ${
            activeSubTab === "transporteurs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>🚛 Mes transporteurs</span>
        </button>
        <button 
          onClick={() => setActiveSubTab("affreteurs")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer tracking-wide flex items-center gap-2 shrink-0 transition-all ${
            activeSubTab === "affreteurs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>🏭 Mes affréteurs (DO)</span>
        </button>
        <button 
          onClick={() => setActiveSubTab("commissions")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer tracking-wide flex items-center gap-2 shrink-0 transition-all ${
            activeSubTab === "commissions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>💰 Mes commissions</span>
        </button>
      </div>

      {/* ───────────────── SUBTAB 1 : TABLEAU DE BORD ───────────────── */}
      {activeSubTab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Left Block (8 cols): Performant graphs & progressions */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Progression & Objective Block */}
            {(() => {
              const goalTarget = 20000;
              const goalPercent = Math.min(100, Math.round((totalCommissionsValidees / goalTarget) * 105));
              const goalRemaining = Math.max(0, goalTarget - totalCommissionsValidees);
              return (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-xs uppercase font-black tracking-wider text-slate-400">Suivi d'objectif mensuel</h3>
                      <p className="font-bold text-sm text-[#085041]">Objectif : {goalTarget.toLocaleString()} DA · Réalisé : {totalCommissionsValidees.toLocaleString()} DA ({goalPercent}%)</p>
                    </div>
                    <span className="bg-teal-550 bg-teal-550 bg-teal-50 text-[#1D9E75] text-[11px] font-black px-3 py-1 rounded-full">
                      {goalPercent}% Atteint
                    </span>
                  </div>
                  
                  {/* Progressive slider bar */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-[#1D9E75] rounded-full transition-all duration-1000"
                      style={{ width: `${goalPercent}%` }}
                    ></div>
                  </div>

                  <div className="flex gap-2 items-center text-[10.5px] text-slate-500 font-semibold bg-indigo-50/20 p-3 rounded-2xl border border-dashed border-indigo-100">
                    <span className="text-base">🚀</span>
                    {goalRemaining > 0 ? (
                      <span>Encore <b>{goalRemaining.toLocaleString()} DA</b> pour décrocher votre prime de superformateur réseau BVF ce mois-ci !</span>
                    ) : (
                      <span>Félicitations ! Objectif mensuel pulvérisé, vous êtes éligible à la prime de superformateur réseau ! 🌟</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* BAR CHART CSS - COMMISSIONS LAST 6 MONTHS */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-4 border-slate-50">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#1D9E75]"><TrendingUp className="w-4 h-4" /></span>
                    <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Evolution des commissions (6 derniers mois)</h3>
                  </div>
                  <p className="text-[10px] text-slate-400">Total cumulé et viré : {(27500 - 11100 + totalCommissionsValidees).toLocaleString()} DA • Source: Netlog BVF Ledger</p>
                </div>
                
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">
                  Rang : 🥇 12ème sur 87
                </span>
              </div>

              {/* Graphical representation with bars */}
              <div className="h-44 flex items-end justify-between pt-6 px-4 md:px-8">
                {[
                  { month: "Déc 2025", val: 3200, label: "3,2k DA" },
                  { month: "Jan 2026", val: 5600, label: "5,6k DA" },
                  { month: "Fév 2026", val: 4100, label: "4,1k DA" },
                  { month: "Mar 2026", val: 8200, label: "8,2k DA" },
                  { month: "Avr 2026", val: 15400, label: "15,4k DA" },
                  { month: "Mai 2026", val: totalCommissionsValidees, label: `${(totalCommissionsValidees / 1000).toFixed(1)}k DA` }
                ].map((item, id) => {
                  const maxVal = Math.max(16000, totalCommissionsValidees);
                  const percent = (item.val / maxVal) * 100;
                  return (
                    <div key={id} className="flex flex-col items-center gap-2 group cursor-pointer relative flex-1">
                      {/* Tooltip on hover */}
                      <span className="absolute -top-6 bg-slate-950 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {item.val.toLocaleString()} DA
                      </span>
                      
                      {/* Interactive block representing chart */}
                      <div className="w-8 md:w-11 bg-slate-100 rounded-t-lg h-28 flex items-end overflow-hidden">
                        <div 
                          className="w-full bg-gradient-to-t from-teal-700 to-[#1D9E75] group-hover:from-emerald-600 group-hover:to-teal-500 rounded-t-lg transition-all"
                          style={{ height: `${percent}%` }}
                        ></div>
                      </div>
                      
                      <span className="text-[9.5px] font-black text-slate-800 block">
                        {item.month}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 font-bold block">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LATEST TRANSACTIONS DISPLAY */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-50">
                <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="text-emerald-650 font-bold">●</span> Dernières transactions de mon réseau (Temps réel)
                </h4>
                <span className="text-[10px] text-slate-400 font-semibold">Portefeuille Algérie Co-working</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9.5px] tracking-wider">
                      <th className="py-2.5 font-black">Date</th>
                      <th className="py-2.5 font-black">Transporteur / DO</th>
                      <th className="py-2.5 font-black">Mission engagée</th>
                      <th className="py-2.5 font-black text-right">Ma commission</th>
                      <th className="py-2.5 font-black text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {recentTransactions.map((tx, idx) => {
                      const tagColor = 
                        tx.status === "Payée" ? "bg-cyan-50 text-cyan-800 border-cyan-150" :
                        tx.status === "Validée" ? "bg-emerald-50 text-emerald-800 border-emerald-150" :
                        "bg-amber-50 text-amber-800 border-amber-150";
                      
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 text-slate-500 font-mono text-[10px]">{tx.date}</td>
                          <td className="py-3 font-extrabold text-[#1a1a2e]">{tx.subject}</td>
                          <td className="py-3 text-slate-500 text-[11px] font-sans">{tx.mission}</td>
                          <td className="py-3 text-right font-bold text-slate-900 font-mono text-[11px] shrink-0">
                            +{tx.comm} DA
                          </td>
                          <td className="py-3 text-right">
                            <span className={`inline-block border px-1.5 py-0.5 rounded text-[8.5px] font-extrabold tracking-wider uppercase ${tagColor}`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column (4 cols): Performance achievements & quick links */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Performance card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/10 p-5 rounded-3xl border border-amber-200/50 space-y-4">
              <div className="flex gap-2.5 items-center">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg shadow-xs">
                  🏆
                </div>
                <div>
                  <h4 className="font-extrabold text-[#1a1a2e] text-xs uppercase tracking-wider">Rang de Performance</h4>
                  <p className="text-[10px] text-slate-500">Mise à jour en direct le 25 mai 2026</p>
                </div>
              </div>

              <div className="p-4 bg-white/70 rounded-2xl border border-amber-100/50 text-center space-y-1">
                <span className="text-xs text-slate-500">Votre classement actuel</span>
                <p className="text-base font-black text-[#1D9E75] font-sans">
                  🥇 12ème <span className="text-xs text-slate-400 font-normal">sur 87 agents</span>
                </p>
                <div className="pt-2 border-t border-dashed border-gray-100/80 text-[10px] text-slate-500 leading-normal font-semibold">
                  🏆 Réseau affilié validé actif d'Oran • Commission moyenne par mission validée : 340 DA
                </div>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <h4 className="font-extrabold text-xs text-slate-600 uppercase tracking-widest border-b pb-2">
                Actions Rapides Commerciales
              </h4>

              <div className="space-y-2">
                <button 
                  onClick={() => {
                    setShowRecrutTrans(true);
                    setActiveSubTab("transporteurs");
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 hover:border-[#1D9E75] border border-slate-100 transition-all flex items-center gap-3 cursor-pointer"
                >
                  <span className="text-lg">🚛</span>
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-xs text-slate-800 block">Enregistrer un transporteur</span>
                    <span className="text-[9.5px] text-slate-400 block font-normal">Saisie rapide d'un véhicule affilié</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setShowRecrutDO(true);
                    setActiveSubTab("affreteurs");
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 hover:border-emerald-600 border border-slate-100 transition-all flex items-center gap-3 cursor-pointer"
                >
                  <span className="text-lg">🏭</span>
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-xs text-slate-800 block">Enregistrer un affréteur (DO)</span>
                    <span className="text-[9.5px] text-slate-400 block font-normal">Intégrer de nouvelles entreprises de fret</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setVirementAmount("11100");
                    setShowVirementModal(true);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-amber-50/10 hover:bg-amber-50/20 hover:border-amber-300 border border-dashed border-amber-200/80 transition-all flex items-center gap-3 cursor-pointer"
                >
                  <span className="text-lg text-amber-550 font-black">💳</span>
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-xs text-slate-800 block">Demander un virement</span>
                    <span className="text-[9.5px] text-slate-400 block font-normal">Solde disponible : 11 100 DA</span>
                  </div>
                </button>
              </div>
            </div>

            {/* General commercial reminder */}
            <div style={{ backgroundColor: '#0f172a' }} className="bg-slate-900 text-slate-300 p-5 rounded-3xl space-y-3.5">
              <span className="text-[10px] font-black uppercase text-amber-300 tracking-widest block border-b pb-1.5 border-slate-800">
                💡 Secret de commissionnement
              </span>
              <p className="text-[10px] text-slate-400 leading-normal font-medium">
                Soutenez vos transporteurs affiliés ! Plus un transporteur remplit d'offres de fret disponibles sur Alger, Oran ou Béjaia via notre bourse de fret digitalisée, plus vos commissions de <b>200 DA/cargaison</b> s'accumulent.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* ───────────────── SUBTAB 2 : TRANSPORTEURS AFFILIÉS ───────────────── */}
      {activeSubTab === "transporteurs" && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <div className="space-y-1">
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">
                Portefeuille de Transporteurs Routiers Partenaires ({networkTransporteurs.length} inscrits)
              </h3>
              <p className="text-[10px] text-slate-400">
                Vous percevez <b>200 DA</b> sur chaque chargement complété par vos prestataires référencés.
              </p>
            </div>

            <button 
              onClick={() => setShowRecrutTrans(!showRecrutTrans)}
              className="bg-[#1D9E75] hover:bg-[#085041] hover:scale-101 text-white font-extrabold px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all self-start md:self-center"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{showRecrutTrans ? "Masquer le formulaire" : "+ Inscrire un transporteur"}</span>
            </button>
          </div>

          {/* DYNAMIC FORM: ADD TRANSPORTEUR */}
          {showRecrutTrans && (
            <div className="bg-white p-6 rounded-3xl border-2 border-dashed border-teal-200/60 shadow-xs space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center border-b pb-3 border-gray-100">
                <h4 className="font-extrabold text-xs text-[#085041] uppercase tracking-wider flex items-center gap-2">
                  <span>🚛</span> Formulaire d'affiliation d'un nouveau transporteur routier
                </h4>
                <button onClick={() => setShowRecrutTrans(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={submitTransporteur} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Nom du transporteur *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Benzekri" 
                    value={transNom} 
                    onChange={e => setTransNom(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Prénom *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Ahmed" 
                    value={transPrenom} 
                    onChange={e => setTransPrenom(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Téléphone mobile *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 0555 12 34 56" 
                    value={transTel} 
                    onChange={e => setTransTel(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Wilaya de résidence *</label>
                  <select 
                    value={transWilaya} 
                    onChange={e => setTransWilaya(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-semibold"
                  >
                    <option value="31 - Oran">31 - Oran</option>
                    <option value="16 - Alger">16 - Alger</option>
                    <option value="19 - Sétif">19 - Sétif</option>
                    <option value="25 - Constantine">25 - Constantine</option>
                    <option value="09 - Blida">09 - Blida</option>
                    <option value="35 - Boumerdès">35 - Boumerdès</option>
                    <option value="30 - Ouargla">30 - Ouargla</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Type de camion principal *</label>
                  <select 
                    value={transCamion} 
                    onChange={e => setTransCamion(e.target.value as MoyenType)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-semibold"
                  >
                    <option value={MoyenType.Tautliner}>Tautliner (Bâche classique)</option>
                    <option value={MoyenType.Plateau}>Plateau plat standard</option>
                    <option value={MoyenType.Fourgon}>Fourgon rigide sécurisé</option>
                    <option value={MoyenType.Citerne}>Citerne liquide/alimentaire</option>
                    <option value={MoyenType.CamionFrigorifique}>Camion frigorifique température dirigée</option>
                    <option value={MoyenType.BenneBasculante}>Benne basculante vrac</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Immatriculation du véhicule *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 00293 116 31" 
                    value={transImmat} 
                    onChange={e => setTransImmat(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-mono font-bold"
                  />
                </div>

                <div className="md:col-span-3 pt-2 text-right">
                  <button 
                    type="submit"
                    className="bg-[#1D9E75] hover:bg-[#085041] text-white font-extrabold px-6 py-2.5 rounded-xl text-xs cursor-pointer shadow-sm transition-colors"
                  >
                    Inscrire et lui envoyer le lien d'inscription complet
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LIST OF TRUCKS IN SYSTEM */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-50">
              <span className="text-xs font-black uppercase text-slate-600 block tracking-wider">
                Registre des Transporteurs de mon réseau
              </span>
              
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Rechercher par Wilaya / Nom..." 
                  value={transporteurSearch}
                  onChange={e => setTransporteurSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 focus:border-[#1D9E75] bg-slate-50 border border-slate-150 rounded-lg text-xs font-semibold outline-none w-52"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-slate-400 font-extrabold text-[9.5px] tracking-wide uppercase">
                    <th className="py-2.5 font-black text-slate-500">Nom du Transporteur</th>
                    <th className="py-2.5 font-black text-slate-500">Adresse / Wilaya</th>
                    <th className="py-2.5 font-black text-slate-500 text-center">Camion(s)</th>
                    <th className="py-2.5 font-black text-slate-500 text-center">Missions ce mois</th>
                    <th className="py-2.5 font-black text-slate-500 text-center font-mono">Total Missions</th>
                    <th className="py-2.5 font-black text-slate-500 text-right">Ma commission cumulée</th>
                    <th className="py-2.5 font-black text-slate-500 text-center">État du Compte</th>
                    <th className="py-2.5 font-black text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {networkTransporteurs
                    .filter(u => u.nom.toLowerCase().includes(transporteurSearch.toLowerCase()) || u.wilaya?.toLowerCase().includes(transporteurSearch.toLowerCase()))
                    .map((item, id) => {
                      // Statics or simulated metrics representing top performance Ahmed Benzekri has 8 missions as requested
                      const isBenzekri = item.nom.includes("Benzekri") || (id === 0);
                      const monthMissions = isBenzekri ? 8 : (id % 3) * 2 + 1;
                      const cumulMissions = isBenzekri ? 22 : monthMissions * 3 + 2;
                      
                      // Commercial earns 5 000 DA fixed commission if hasAbonnement is true!
                      const myCommTotal = (item.hasAbonnement ? 5000 : 0) + (cumulMissions * 200);

                      let statusColor = "bg-emerald-50 text-emerald-800 border-emerald-150";
                      let statusText = "Validé";
                      if (item.status === "en_attente") {
                        statusColor = "bg-amber-50 text-amber-800 border-amber-150";
                        statusText = "En Attente";
                      } else if (item.status === "suspendu") {
                        statusColor = "bg-rose-50 text-rose-800 border-rose-150";
                        statusText = "Suspendu";
                      }

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3">
                            <span className="font-extrabold text-[#1a1a2e] text-[12px] block">{item.prenom} {item.nom}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{item.email}</span>
                          </td>
                          <td className="py-3">
                            <span className="font-sans font-bold text-slate-700 block">{item.wilaya || "31 - Oran"}</span>
                            <span className="text-[9.5px] text-slate-450 block font-normal">{item.tel}</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="bg-slate-100 text-slate-800 text-[10.5px] font-extrabold px-2 py-0.5 rounded">
                              {item.nbCamions || "1"} Camion({item.nbCamions || "1"})
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="font-bold text-slate-900 font-mono text-[11px]">{monthMissions}</span>
                          </td>
                          <td className="py-3 text-center font-bold text-slate-900 font-mono text-[11.5px]">
                            {cumulMissions}
                          </td>
                          <td className="py-3 text-right text-slate-900 font-bold font-mono">
                            <div className="text-[11.5px] text-[#1D9E75] font-black">{myCommTotal.toLocaleString()} DA</div>
                            <div className="text-[9px] text-slate-400 font-normal">
                              {item.hasAbonnement ? "5K Fixe inclus" : "Hors Abo (0 DA)"}
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleTransporteurSubscription(item.id)}
                              className={`inline-flex items-center gap-1 border px-2 py-1 rounded text-[9.5px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                item.hasAbonnement 
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100" 
                                  : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                              }`}
                              title="Togglé l'abonnement du transporteur"
                            >
                              <span>{item.hasAbonnement ? "✅ Abonné BVF" : "❌ Sans Abo"}</span>
                            </button>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <button 
                                onClick={() => toggleTransporteurSubscription(item.id)}
                                className="text-[10px] text-teal-700 hover:text-white hover:bg-teal-600 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 font-black cursor-pointer transition-colors"
                              >
                                {item.hasAbonnement ? "Désactiver Abo" : "💳 Conclure Abo"}
                              </button>
                              <button 
                                onClick={() => setSelectedUserDetail(item)}
                                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded-lg font-bold border border-slate-200 cursor-pointer"
                              >
                                Profil
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Ahmed Benzekri highlight statistics card */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50/10 p-4 rounded-2xl border border-emerald-150 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🥇</span>
                <div>
                  <span className="text-[10px] uppercase font-black text-[#085041] block tracking-widest">
                    Record d'activité transporteur
                  </span>
                  <span className="text-xs font-bold text-slate-800 block">
                    Transporteur le plus actif : <b>Ahmed Benzekri (8 missions ce mois)</b>
                  </span>
                </div>
              </div>
              
              <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
                +1 600 DA
              </span>
            </div>
          </div>

        </div>
      )}

      {/* ───────────────── SUBTAB 3 : AFFRÉTEURS (DO) ───────────────── */}
      {activeSubTab === "affreteurs" && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <div className="space-y-1">
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">
                Affréteurs & Donneurs d'Ordres Référencés ({networkDOs.length} entreprises)
              </h3>
              <p className="text-[10px] text-slate-400">
                Vous encaissez <b>500 DA</b> sur chaque offre d'affrètement contractée par vos DO portefeuilles.
              </p>
            </div>

            <button 
              onClick={() => setShowRecrutDO(!showRecrutDO)}
              className="bg-[#1D9E75] hover:bg-[#085041] hover:scale-101 text-white font-extrabold px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all self-start md:self-center"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{showRecrutDO ? "Masquer le formulaire" : "+ Inscrire un donneur d'ordre"}</span>
            </button>
          </div>

          {/* DYNAMIC FORM: ADD DONNEUR D'ORDRE */}
          {showRecrutDO && (
            <div className="bg-white p-6 rounded-3xl border-2 border-dashed border-teal-200/60 shadow-xs space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center border-b pb-3 border-gray-100">
                <h4 className="font-extrabold text-xs text-[#085041] uppercase tracking-wider flex items-center gap-2">
                  <span>🏭</span> Formulaire d' affiliation d'un nouveau donneur d'ordre (DO)
                </h4>
                <button onClick={() => setShowRecrutDO(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={submitDO} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Raison Sociale de l'entreprise *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: SARL BATIMEX" 
                    value={doRaisonSociale} 
                    onChange={e => setDoRaisonSociale(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Nom du contact référent *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Mourad Kaci" 
                    value={doNomContact} 
                    onChange={e => setDoNomContact(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Téléphone direct *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 021 78 45 12" 
                    value={doTel} 
                    onChange={e => setDoTel(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Wilaya du siège social *</label>
                  <select 
                    value={doWilaya} 
                    onChange={e => setDoWilaya(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-semibold"
                  >
                    <option value="16 - Alger">16 - Alger</option>
                    <option value="31 - Oran">31 - Oran</option>
                    <option value="19 - Sétif">19 - Sétif</option>
                    <option value="09 - Blida">09 - Blida</option>
                    <option value="25 - Constantine">25 - Constantine</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10.5px] font-bold text-slate-500 block">Secteur d'activité principal *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Matériaux de Construction / Import-Export" 
                    value={doSecteur} 
                    onChange={e => setDoSecteur(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none font-bold"
                  />
                </div>

                <div className="md:col-span-3 pt-2 text-right">
                  <button 
                    type="submit"
                    className="bg-[#1D9E75] hover:bg-[#085041] text-white font-extrabold px-6 py-2.5 rounded-xl text-xs cursor-pointer shadow-sm transition-colors"
                  >
                    Affilier et Enregistrer l'Affréteur
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LIST OF DO RECORDED */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-50">
              <span className="text-xs font-black uppercase text-slate-600 block tracking-wider">
                Sociétés affrétant du fret sous ma recommandation
              </span>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Rechercher par DO / Société..." 
                  value={doSearch}
                  onChange={e => setDoSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 focus:border-[#1D9E75] bg-slate-50 border border-slate-150 rounded-lg text-xs font-semibold outline-none w-52"
                />
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 text-amber-900 rounded-2xl p-4 text-[11px] font-semibold leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 text-amber-800 font-black text-[11px] uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Réglementation de versement d'apport d'affaires</span>
              </div>
              <p>
                Conformément aux conditions de la convention réseau BVF, votre commission variable de <b>5%</b> est créditée <b>uniquement sur les montants de fret réellement payés et réglés</b> par le donneur d'ordre. Les transactions en cours d'exécution ou en attente de virement de facture n'ouvrent pas de droit de tirage immédiat.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-slate-400 font-extrabold text-[9.5px] tracking-wide uppercase">
                    <th className="py-2.5 font-black text-slate-500">Raison Sociale</th>
                    <th className="py-2.5 font-black text-slate-500">Secteur d'Activité</th>
                    <th className="py-2.5 font-black text-slate-500">Wilaya Siège</th>
                    <th className="py-2.5 font-black text-slate-500 text-center">Offres Publiées</th>
                    <th className="py-2.5 font-black text-slate-500 text-center">Déchargées & Réglées</th>
                    <th className="py-2.5 font-black text-slate-500 text-center">Convention BVF</th>
                    <th className="py-2.5 font-black text-slate-500 text-right">Ma comm. Variable (5%)</th>
                    <th className="py-2.5 font-black text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {networkDOs
                    .filter(u => u.raisonSociale.toLowerCase().includes(doSearch.toLowerCase()))
                    .map((item, id) => {
                      const stats = getDoStatistics(item);
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3">
                            <span className="font-extrabold text-[#1a1a2e] text-[12px] block">{item.raisonSociale}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">Référent: {item.prenom} {item.nom}</span>
                          </td>
                          <td className="py-3">
                            <span className="text-slate-600 font-bold block">{item.secteur || "Agroalimentaire"}</span>
                          </td>
                          <td className="py-3">
                            <span className="font-semibold text-slate-600 font-mono text-[10.5px] uppercase">{item.wilaya || "16 - Alger"}</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="font-extrabold text-[#1a1a2e] font-mono">{stats.realMatchedOffersCount + 3}</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="font-bold text-slate-900 font-mono text-[11px]">{stats.realPrestationsCount + 1}</span>
                          </td>
                          <td className="py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleDOConvention(item.id)}
                              className={`inline-block border px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                item.conventionSignee 
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100" 
                                  : "bg-red-50 text-red-850 border-red-200 hover:bg-red-100"
                              }`}
                            >
                              {item.conventionSignee ? "✅ Convention Signée" : "⚠️ En attente signature"}
                            </button>
                          </td>
                          <td className="py-3 text-right font-mono text-[11px]">
                            {item.conventionSignee ? (
                              <div className="space-y-0.5">
                                <div className="text-emerald-600 font-extrabold" title="Calculée à 5% uniquement sur les montants réellement réglés par le DO">
                                  {stats.variableCommEarned.toLocaleString()} DA <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded">Versée (Payé)</span>
                                </div>
                                <div className="text-[9px] text-slate-500 font-normal">
                                  Sur réglé : {stats.paidTurnover.toLocaleString()} DA
                                </div>
                                {stats.potentialUnpaidComm > 0 && (
                                  <div className="text-amber-600 font-bold text-[10px] mt-0.5 border-t border-slate-50 pt-0.5" title="Bloquée car le donneur d'ordre n'a pas encore payé ces factures">
                                    {stats.potentialUnpaidComm.toLocaleString()} DA <span className="text-[8.5px] font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded">Bloquée (En cours)</span>
                                  </div>
                                )}
                                <div className="text-[9.5px] text-slate-400 font-semibold">
                                  Volume total: {stats.totalTurnover.toLocaleString()} DA
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="text-red-500 font-extrabold block">0 DA</span>
                                <span className="text-[8px] text-red-400 font-bold tracking-tight uppercase leading-none block">(Suspendue)</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <button 
                                onClick={() => toggleDOConvention(item.id)}
                                className="text-[10px] text-teal-700 hover:text-white hover:bg-[#1D9E75] bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 font-black cursor-pointer transition-colors"
                              >
                                {item.conventionSignee ? "Annuler signature" : "📝 Signer Convention"}
                              </button>
                              <button 
                                onClick={() => setSelectedUserDetail(item)}
                                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded-lg font-bold border border-slate-200 cursor-pointer"
                              >
                                Fiche DO
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* BATIMEX HIGHLIGHT SUCCESS STATS CARD */}
            <div className="bg-gradient-to-r from-teal-50 to-indigo-50/10 p-4 rounded-2xl border border-teal-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏭</span>
                <div>
                  <span className="text-[10px] uppercase font-black text-teal-850 block tracking-widest">
                    Record d'activité donneur d'ordre
                  </span>
                  <span className="text-xs font-bold text-slate-800 block">
                    DO le plus actif de votre réseau : <b>SARL BATIMEX (5 missions ce mois)</b>
                  </span>
                </div>
              </div>
              
              <span className="bg-[#1D9E75] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
                +2 500 DA
              </span>
            </div>
          </div>

        </div>
      )}

      {/* ───────────────── SUBTAB 4 : EXPOSITION DES COMMISSIONS ───────────────── */}
      {activeSubTab === "commissions" && (
        <div className="space-y-6 animate-fadeIn font-sans">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Box commissions computation */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-[#085041] block border-b pb-2">
                💰 Calcul d'Affiliation Mai 2026
              </span>

              <div className="space-y-3 pt-2 text-slate-705 text-xs text-slate-705">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Commissions fixes transporteurs <span className="text-[10px] font-mono text-emerald-600 font-bold">(5 000 DA par abonnement conclu)</span></span>
                  <span className="font-mono font-bold">{subscribedTransporteursCount} abonnés = {fixedCommissions.toLocaleString()} DA</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Commissions variables affréteurs <span className="text-[10px] font-mono text-emerald-600 font-bold">(5% du chiffre d'affaires payé)</span></span>
                  <span className="font-mono font-bold">Réseau DO conventionné = {variableCommissions.toLocaleString()} DA</span>
                </div>

                <div className="h-0.5 bg-slate-100 my-2"></div>

                <div className="flex justify-between items-center text-slate-800 font-bold">
                  <span>Total Brut Calculé</span>
                  <span className="font-mono">{totalCommissionsValidees.toLocaleString()} DA</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Retenues administratives NETLOG</span>
                  <span className="font-mono">0 DA</span>
                </div>

                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-150 flex justify-between items-center">
                  <span className="font-bold text-[#085041] text-xs">Total net à percevoir :</span>
                  <span className="text-xl font-black text-[#1D9E75] font-mono">{totalCommissionsValidees.toLocaleString()} DA</span>
                </div>
              </div>

              <div className="pt-2 text-center">
                <button 
                  onClick={() => {
                    setVirementAmount(String(totalCommissionsValidees));
                    setShowVirementModal(true);
                  }}
                  className="bg-[#1D9E75] hover:bg-[#085041] text-white font-extrabold px-6 py-3 rounded-2xl text-xs w-full cursor-pointer flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Demander le virement de mes commissions</span>
                </button>
              </div>
            </div>

            {/* Bank detail layout */}
            <div style={{ backgroundColor: '#0f172a' }} className="bg-slate-900 text-white p-6 rounded-3xl space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-amber-300 block tracking-wider">
                  🏦 Profil Bancaire & Facturation
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                  Toutes les commissions sont reversées directement par virement postaux CCP ou bancaires chaque 05 de chaque mois, sous réserve de validation des justificatifs de transport digitalisés contractés.
                </p>
              </div>

              <div className="p-4 bg-slate-850 bg-white/5 border border-white/10 rounded-2xl text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Titulaire :</span>
                  <span className="font-bold">FARID REG-BVF ALGERIE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mode par défaut :</span>
                  <span className="font-bold">Algérie Poste (CCP)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Numéro de Compte :</span>
                  <span className="font-mono font-bold text-amber-200">0019827361 Clé 89</span>
                </div>
              </div>

              <span className="text-[9px] text-slate-500 font-semibold block text-center italic">
                Sarl NETLOG • Sécurisation logistique des transactions d'affrètement.
              </span>
            </div>

          </div>

          {/* COMMISSION ACCUMULATED TABLE */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-4">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 block pb-2 border-b">
              Grand Livre Fiscal de mes Commissions
            </span>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">
                    <th className="py-2">Date</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Acteur Concerné</th>
                    <th className="py-2">Mission Réf</th>
                    <th className="py-2 text-right">Montant brut</th>
                    <th className="py-2 text-right">Statut pour virement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-mono text-[10px]">2026-05-24</td>
                    <td className="py-2.5 text-[#1D9E75] font-bold">DO affiliate</td>
                    <td className="py-2.5 font-bold">SARL BATIMEX</td>
                    <td className="py-2.5 text-slate-500 text-[10.5px]">Oran ➔ Bechar (18t)</td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">500 DA</td>
                    <td className="py-2.5 text-right">
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded">En Attente</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-mono text-[10px]">2026-05-24</td>
                    <td className="py-2.5 text-blue-500 font-bold">Transporteur</td>
                    <td className="py-2.5 font-bold">Trans-Benzekri Eurl</td>
                    <td className="py-2.5 text-slate-500 text-[10.5px]">Alger ➔ Constantine (24t)</td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">200 DA</td>
                    <td className="py-2.5 text-right">
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded">Validée</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-mono text-[10px]">2026-05-23</td>
                    <td className="py-2.5 text-blue-500 font-bold">Transporteur</td>
                    <td className="py-2.5 font-bold">Eurl Hamidi Logistique</td>
                    <td className="py-2.5 text-slate-500 text-[10.5px]">Sétif ➔ Alger (12t)</td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">200 DA</td>
                    <td className="py-2.5 text-right">
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded">Validée</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-mono text-[10px]">2026-05-18</td>
                    <td className="py-2.5 text-[#1D9E75] font-bold">DO affiliate</td>
                    <td className="py-2.5 font-bold">SPA ALGERIA FOOD</td>
                    <td className="py-2.5 text-slate-500 text-[10.5px]">Alger ➔ Oran (22t)</td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">500 DA</td>
                    <td className="py-2.5 text-right">
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded">Validée</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-mono text-[10px]">2026-05-02</td>
                    <td className="py-2.5 text-blue-500 font-bold">Transporteur</td>
                    <td className="py-2.5 font-bold">Mekid Transport</td>
                    <td className="py-2.5 text-slate-500 text-[10.5px]">Oran ➔ Alger (15t)</td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">200 DA</td>
                    <td className="py-2.5 text-right">
                      <span className="bg-blue-105 bg-blue-50 text-[#378ADD] text-[9px] font-black px-1.5 py-0.5 rounded">Payée</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payout requested history */}
            <div className="pt-4 border-t border-slate-50 space-y-3">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                Suivi des virements émis (Historique)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {payoutRequests.map((req, rid) => (
                  <div key={rid} className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex flex-col justify-between gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-mono text-slate-400 font-bold">{req.date}</span>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-full ${
                        req.status === "Payé" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Versement {req.type}</span>
                      <span className="font-mono font-black text-slate-900 text-[12.5px]">{req.amount.toLocaleString()} DA</span>
                    </div>

                    <span className="text-[8.5px] font-mono text-slate-450 block truncate">Réf: {req.ref}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ───────────────── MODAL : VIREMENT COMMISSIONS ───────────────── */}
      {showVirementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md p-6 relative space-y-4">
            <button 
              onClick={() => setShowVirementModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <span>💳</span> Demander le virement de mes commissions
              </h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                Transférez vos commissions Netlog BVF validées directement sur votre compte bancaire ou postal CCP Algérie.
              </p>
            </div>

            <form onSubmit={handleSendPayout} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold text-slate-500 block">Montant à virer (DA) *</label>
                <div className="relative">
                  <input 
                    type="number" 
                    max="11100"
                    min="1000"
                    value={virementAmount} 
                    onChange={e => setVirementAmount(e.target.value)}
                    className="w-full text-xs font-mono font-extrabold p-3 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none"
                    placeholder="Ex: 11100"
                  />
                  <span className="absolute right-3.5 top-3.5 font-bold text-slate-400 text-[10.5px]">DA</span>
                </div>
                <span className="text-[9px] text-slate-400 font-semibold block">Maximum payable immédiatement : <b>11 100 DA</b></span>
              </div>

              <div className="space-y-2">
                <label className="text-[10.5px] font-extrabold text-slate-500 block">Type de virement *</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["CCP", "AGB", "BNA", "BEA"] as const).map((prov) => (
                    <button
                      type="button"
                      key={prov}
                      onClick={() => setVirementType(prov)}
                      className={`py-2 border text-xs font-black rounded-xl transition-all cursor-pointer ${
                        virementType === prov 
                          ? "bg-[#1D9E75] text-white border-[#1D9E75] shadow-xs" 
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold text-slate-500 block">Coordonnées du compte (CCP ou RIB) *</label>
                <input 
                  type="text" 
                  value={virementRIB}
                  onChange={e => setVirementRIB(e.target.value)}
                  placeholder="Ex: 00192837482937483921 Clé 89"
                  className="w-full text-xs font-mono font-bold p-3 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold text-slate-500 block">Message optionnel pour la comptabilité</label>
                <textarea 
                  rows={2}
                  value={virementMsg}
                  onChange={e => setVirementMsg(e.target.value)}
                  placeholder="Ex: Bonjour, s'il vous plaît valider le versement de mes commissions de ce mois ci. Merci !"
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-150 rounded-xl focus:border-[#1D9E75] outline-none resize-none"
                ></textarea>
              </div>

              <div className="pt-2 text-right">
                <button 
                  type="submit"
                  className="bg-[#1D9E75] hover:bg-[#085041] hover:scale-101 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs cursor-pointer shadow-xs transition-colors"
                >
                  Envoyer la demande de virement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────── MODAL : FICHE COMPLETE PORTRAIT DE L'ACTEUR ───────────────── */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-150 w-full max-w-lg p-6 relative space-y-4">
            <button 
              onClick={() => setSelectedUserDetail(null)}
              className="absolute right-4 top-4 text-slate-450 hover:text-slate-650 cursor-pointer text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b pb-3 border-gray-100 flex items-center gap-3">
              <span className="text-3xl">📇</span>
              <div>
                <span className="text-[9px] font-mono text-[#D85A30] uppercase font-black tracking-widest block">
                  Fiche Acteur Portefeuille Farid
                </span>
                <h3 className="font-extrabold text-[#1a1a2e] text-sm leading-tight pt-0.5">
                  {selectedUserDetail.raisonSociale}
                </h3>
              </div>
            </div>

            <div className="text-xs space-y-2.5">
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-2xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">Identifiant Unique</span>
                  <span className="font-mono font-bold text-slate-800">{selectedUserDetail.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Contact Référent</span>
                  <span className="font-bold text-slate-800">{selectedUserDetail.prenom} {selectedUserDetail.nom}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Téléphone direct</span>
                  <span className="font-mono font-bold text-slate-800">{selectedUserDetail.tel}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">E-mail</span>
                  <span className="font-bold text-slate-800">{selectedUserDetail.email}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 p-1 font-semibold text-slate-600 leading-normal">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wide">Wilaya de Siège</span>
                  <span className="font-extrabold text-slate-800 text-[11.5px]">{selectedUserDetail.wilaya}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wide">Date d'Inscription</span>
                  <span className="font-mono text-slate-800 font-bold text-[11px]">{selectedUserDetail.dateInscription || "2026-05-15"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wide">Numéro Registre Commerce</span>
                  <span className="font-mono text-slate-800 text-[11px]">{selectedUserDetail.nrc}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wide">Type d'Acteur</span>
                  <span className="font-extrabold text-[#1D9E75] uppercase">{selectedUserDetail.profil}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50/10 rounded-xl border border-dashed border-amber-200 text-[10px] leading-relaxed text-amber-900 font-mono">
                ℹ️ Ce profil a été intégré via votre code de recommandation commercial {referralCode}. Les justificatifs de RC et de validité de carte d'immatriculation fiscale sont validés par l'administration NETLOG.
              </div>
            </div>

            <div className="pt-2 text-right">
              <button 
                onClick={() => setSelectedUserDetail(null)}
                className="bg-slate-900 text-white font-extrabold px-5 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Fermer la fiche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
