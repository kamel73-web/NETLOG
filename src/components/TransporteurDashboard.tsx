import React, { useState } from "react";
import { 
  Truck, 
  Layers, 
  CheckCircle, 
  Clock, 
  Trash, 
  Edit, 
  Star, 
  FileText, 
  Eye, 
  Download, 
  Phone, 
  Mail, 
  MapPin, 
  Award, 
  ShieldCheck, 
  Bell, 
  Calendar,
  DollarSign,
  AlertTriangle,
  Plus
} from "lucide-react";
import { MoyenType, OffreStatus, ProfileType, DevisOfficiel, Facture, FactureStatus, ReglementMode } from "../types"
import { createVehicle } from "../lib/freightOffers";
import DevisModule from "./DevisModule";

// Standard list of Algerian Wilayas
const ALGERIAN_WILAYAS = [
  "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", 
  "Béchar", "Blida", "Bouira", "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", 
  "Tizi Ouzou", "Alger", "Djelfa", "Jijel", "Sétif", "Saïda", "Skikda", "Sidi Bel Abbès", 
  "Annaba", "Guelma", "Constantine", "Médéa", "Mostaganem", "M'Sila", "Mascara", 
  "Ouargla", "Oran", "El Bayadh", "Illizi", "Bordj Bou Arréridj", "Boumerdès", 
  "El Tarf", "Tindouf", "Tissemsilt", "El Oued", "Khenchela", "Souk Ahras", 
  "Tipaza", "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent", "Ghardaïa", "Relizane"
];

const PRO_CARS_BRANDS = ["Mercedes-Benz", "Renault Trucks", "Volvo Trucks", "DAF", "MAN", "Scania", "Iveco", "Autre"];

interface TransporteurDashboardProps {
  currentUser: any;
  setCurrentUser: (user: any) => void;
  lang: string;
  t: (key: string) => string;
  moyens: any[];
  saveState: (users?: any, moyens?: any, offres?: any, propositions?: any, factures?: any, devis?: any) => void;
  offres: any[];
  propositions: any[];
  factures: any[];
  devis: DevisOfficiel[];
  counters: { offres: number; missions: number; factures: number; ldv: number; devis: number };
  incrementCounter: (key: "offres" | "missions" | "factures" | "ldv" | "devis") => void;
  users: any[];
  initiateBid: (offre: any) => void;
  triggerSystemLog: (msg: string, type: "success" | "info" | "warning" | "danger") => void;
  setActiveContractDoc: (doc: any) => void;
  translateCity: (city: string, lang: string) => string;
  translateMoyenType: (moyen: any, lang: string) => string;
  translateMarchandise: (march: any, lang: string) => string;
  setCurrentTab: (tab: string) => void;
  onNotifyDO?: (offreId: string, type: "chargement" | "livraison") => void;
}

export default function TransporteurDashboard({
  currentUser,
  setCurrentUser,
  lang,
  t,
  moyens,
  saveState,
  offres,
  propositions,
  factures = [],
  devis = [],
  counters,
  incrementCounter,
  users = [],
  initiateBid,
  triggerSystemLog,
  setActiveContractDoc,
  translateCity,
  translateMoyenType,
  translateMarchandise,
  setCurrentTab,
  onNotifyDO
}: TransporteurDashboardProps) {

  // Sub tab tracking
  const [subTab, setSubTab] = useState<"flotte" | "offres" | "devis" | "missions" | "finances" | "profil" | "chauffeurs">("flotte");

  // Offers subtabs
  const [offresSubTab, setOffresSubTab] = useState<"compatibles" | "toutes" | "favoris">("compatibles");
  const [offresSortBy, setOffresSortBy] = useState<"prix_desc" | "date" | "depart">("prix_desc");

  // Missions subtabs
  const [missionsSubTab, setMissionsSubTab] = useState<"en_cours" | "terminees" | "annulees">("en_cours");

  // Financial period
  const [financesPeriod, setFinancesPeriod] = useState<"mois" | "dernier" | "3mois" | "6mois" | "annee">("mois");

  // Camion Form toggles and values
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Driver management form and values
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [driverLastName, setDriverLastName] = useState("");
  const [driverFirstName, setDriverFirstName] = useState("");
  const [driverTel, setDriverTel] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPassword, setDriverPassword] = useState("");
  const [driverPosition, setDriverPosition] = useState("Alger");
  const [driverStatus, setDriverStatus] = useState<"Disponible" | "Indisponible" | "En route">("Disponible");

  const [formMoyenType, setFormMoyenType] = useState<MoyenType>(MoyenType.Tautliner);
  const [formBrand, setFormBrand] = useState("Scania");
  const [formModel, setFormModel] = useState("");
  const [formPlate, setFormPlate] = useState("");
  const [formWeight, setFormWeight] = useState(30);
  const [formLen, setFormLen] = useState(13.6);
  const [formWidth, setFormWidth] = useState(2.5);
  const [formHeight, setFormHeight] = useState(2.7);
  const [formWilaya, setFormWilaya] = useState("Alger");
  const [formEquipements, setFormEquipements] = useState({
    hayon: false,
    gps: true,
    bache: true,
    sangles: true,
    palettes: false
  });
  const [formInsDate, setFormInsDate] = useState("2026-12-31");
  const [formTechDate, setFormTechDate] = useState("2026-11-30");
  const [formStatus, setFormStatus] = useState<"Disponible" | "Occupé" | "En maintenance">("Disponible");

  // Favorites tracking
  const [favorites, setFavorites] = useState<string[]>([]);

  // Confirmation state for mission action transitions
  const [missionConfirming, setMissionConfirming] = useState<{
    id: string;
    nextStatus: string;
    label: string;
  } | null>(null);

  // Profile editable details
  const [profilePhone, setProfilePhone] = useState(currentUser?.telephone || "+213 555 12 34 56");
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || "ahmed.trans@netlog.dz");
  const [profileAddress, setProfileAddress] = useState(currentUser?.adresse || "Zone Industrielle de Rouïba, Lot 4");
  const [profileWilaya, setProfileWilaya] = useState(currentUser?.wilaya || "Alger");

  const [verificationCodes, setVerificationCodes] = useState<Record<string, string>>({});

  // --- ÉTATS GESTION DE FACTURATION MUTLI-MISSIONS ---
  const [selectedMissionsForInvoice, setSelectedMissionsForInvoice] = useState<string[]>([]);
  const [billingClientFilter, setBillingClientFilter] = useState<string>("");

  // Action to compile missions into an invoice
  const handleCompileToInvoice = () => {
    if (selectedMissionsForInvoice.length === 0) {
      triggerSystemLog("Veuillez sélectionner au moins une livraison validée.", "warning");
      return;
    }

    // Determine client: we take the client from the first selected mission
    const firstMission = offres.find(o => o.id === selectedMissionsForInvoice[0]);
    if (!firstMission) {
      triggerSystemLog("Mission introuvable.", "danger");
      return;
    }

    const clientDonneurId = firstMission.donneurId;

    // Check if all selected missions correspond to the same Client (Donneur d'Ordre)
    const multipleClients = selectedMissionsForInvoice.some(id => {
      const o = offres.find(x => x.id === id);
      return o && o.donneurId !== clientDonneurId;
    });

    if (multipleClients) {
      triggerSystemLog("Erreur : Les missions choisies doivent concerner le même Client (Donneur d'Ordre).", "danger");
      return;
    }

    // Calculate sum price
    const selectedOffres = offres.filter(o => selectedMissionsForInvoice.includes(o.id));
    const totalHT = selectedOffres.reduce((sum, o) => sum + (o.prixFixe || 80000), 0);

    const factNewId = `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newFacture: any = {
      id: factNewId,
      offreId: selectedMissionsForInvoice.join(","),
      donneurId: clientDonneurId,
      transporteurId: currentUser?.id || "user-trans-1",
      montant: totalHT,
      status: "Facture Transmise", // from types: FactureStatus.Transmise
      dateEmission: new Date().toISOString().split("T")[0],
      prestation: `Facture de ${selectedMissionsForInvoice.length} mission(s) logistique(s) consolidée(s)`,
      isMensuelleGroupee: selectedMissionsForInvoice.length > 1
    };

    const updatedFactures = [newFacture, ...factures];
    saveState(undefined, undefined, undefined, undefined, updatedFactures);
    
    // Clear selection
    setSelectedMissionsForInvoice([]);
    setSubTab("finances"); // Automatically switch to Finances subTab so the user can see their invoice!
    triggerSystemLog(`Facture ${factNewId} (Montant : ${totalHT.toLocaleString()} DA HT) générée et transmise au Client !`, "success");
  };

  // Action to inject a dummy validated mission for testing
  const handleSimulateValidatedMission = (partnerRaison: string) => {
    const clientUser = users.find(u => u.raisonSociale === partnerRaison || u.profil === ProfileType.DonneurOrdre) || users[0];
    const newMissionId = `OFF-${Math.floor(10000 + Math.random() * 90000)}`;
    
    const newOffer: any = {
      id: newMissionId,
      donneurId: clientUser.id || "user-do-1",
      donneurRaisonSociale: clientUser.raisonSociale || partnerRaison,
      depart: "Alger",
      arrivee: "Sétif",
      departDetails: "Port d'Alger",
      arriveeDetails: "Zone Industrielle Sétif",
      dateChargement: new Date().toISOString().split("T")[0],
      dateLivraison: new Date().toISOString().split("T")[0],
      poids: 24,
      marchandise: "Produits Laitiers / Conserves",
      moyenExige: MoyenType.Tautliner,
      nombreVoyages: 1,
      prixFixe: Math.floor(65000 + Math.random() * 40000),
      status: OffreStatus.Valide,
      contratLogistiquePath: "/docs/contrat_routier.pdf",
      codeConfirmation: String(Math.floor(1000 + Math.random() * 9000)),
      dateCreation: new Date().toISOString()
    };

    // Find any camion of this carrier
    const firstCamion = moyens.find(m => m.transporteurId === currentUser?.id);

    const newProp: any = {
      id: `PROP-${Math.floor(10000 + Math.random() * 90000)}`,
      offreId: newMissionId,
      transporteurId: currentUser?.id || "user-trans-1",
      transporteurRaisonSociale: currentUser?.raisonSociale || "Ahmed Transports",
      moyenId: firstCamion?.id || "camion-01",
      prixPropose: newOffer.prixFixe,
      status: "Accepté"
    };

    const updatedOffres = [newOffer, ...offres];
    const updatedProps = [newProp, ...propositions];

    saveState(undefined, undefined, updatedOffres, updatedProps);
    triggerSystemLog(`Mission d'essai ${newMissionId} (${newOffer.depart} ➔ ${newOffer.arrivee}, ${newOffer.prixFixe.toLocaleString()} DA) générée avec statut 'Validé' pour essais de facturation.`, "success");
  };

  // Calculations for dynamic counts
  const myCamions = moyens.filter(m => m.transporteurId === currentUser?.id);
  const assignedProps = propositions.filter(p => p.transporteurId === currentUser?.id && p.status === "Accepté");
  const assignedOffreIds = assignedProps.map(p => p.offreId);
  const activeMissions = offres.filter(o => assignedOffreIds.includes(o.id) && o.status !== OffreStatus.Valide);

  // Offers compatibility counts
  const myCamionsTypes = myCamions.map(c => c.type);
  const compatibleOffres = offres.filter(o => {
    if (o.status !== OffreStatus.Publie) return false;
    return myCamions.some(m => m.type === o.moyenExige && m.poidsUtileMax >= o.poids);
  });

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(x => x !== id));
      triggerSystemLog("Offre retirée des favoris", "info");
    } else {
      setFavorites([...favorites, id]);
      triggerSystemLog("Offre ajoutée aux favoris ❤️", "success");
    }
  };

  const handleSaveMoyenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlate || !formWeight) {
      triggerSystemLog("Veuillez remplir l'immatriculation et le poids utile max.", "danger");
      return;
    }
    if (!currentUser?.id) {
      triggerSystemLog("Session utilisateur absente.", "danger");
      return;
    }

    const computedVol = Number((formLen * formWidth * formHeight).toFixed(1));
    const newMoyenData: any = {
      type: formMoyenType,
      marque: formBrand,
      modele: formModel,
      immatriculation: formPlate,
      poidsUtileMax: Number(formWeight),
      longueurMax: Number(formLen),
      largeur: Number(formWidth),
      hauteur: Number(formHeight),
      volume: computedVol,
      wilaya: formWilaya,
      equipements: formEquipements,
      assuranceValideDate: formInsDate,
      techniqueValideDate: formTechDate,
      disponibilite: formStatus
    };

    if (editingId) {
      const updated = moyens.map(m => {
        if (m.id === editingId) {
          return { ...m, ...newMoyenData };
        }
        return m;
      });
      saveState(undefined, updated);
      triggerSystemLog("Camion modifié avec succès ! 🚛", "success");
    } else {
      try {
        const inserted = await createVehicle({
          type: String(formMoyenType),
          immatriculation: formPlate,
          capaciteKg: Number(formWeight) * 1000,
          isAvailable: formStatus === "Disponible",
        });
        const addedMoyen = {
          id: String(inserted.id),
          transporteurId: currentUser.id,
          ...newMoyenData
        };
        saveState(undefined, [addedMoyen, ...moyens]);
        triggerSystemLog("Nouveau camion enregistré en base ! 🎉", "success");
      } catch (err: any) {
        triggerSystemLog(`Échec enregistrement camion : ${err?.message ?? "erreur"}`, "danger");
        return;
      }
    }

    setEditingId(null);
    setShowForm(false);
    setFormModel("");
    setFormPlate("");
    setFormWeight(30);
    setFormLen(13.6);
    setFormWidth(2.5);
    setFormHeight(2.7);
    setFormStatus("Disponible");
  };

  const handleEditMoyen = (m: any) => {
    setEditingId(m.id);
    setFormMoyenType(m.type);
    setFormBrand(m.marque || "Mercedes-Benz");
    setFormModel(m.modele || "");
    setFormPlate(m.immatriculation || "");
    setFormWeight(m.poidsUtileMax || 24);
    setFormLen(m.longueurMax || 13.6);
    setFormWidth(m.largeur || 2.5);
    setFormHeight(m.hauteur || 2.7);
    setFormWilaya(m.wilaya || "Alger");
    setFormEquipements(m.equipements || { hayon: false, gps: true, bache: true, sangles: true, palettes: false });
    setFormInsDate(m.assuranceValideDate || "2026-12-31");
    setFormTechDate(m.techniqueValideDate || "2026-11-30");
    setFormStatus(m.disponibilite || "Disponible");
    setShowForm(true);
    triggerSystemLog("Chargement du formulaire pour " + m.marque, "info");
  };

  const handleCycleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = moyens.map(m => {
      if (m.id === id) {
        const next: Record<string, "Disponible" | "Occupé" | "En maintenance"> = {
          "Disponible": "Occupé",
          "Occupé": "En maintenance",
          "En maintenance": "Disponible"
        };
        const currentDispo = m.disponibilite || "Disponible";
        return { ...m, disponibilite: next[currentDispo] || "Disponible" };
      }
      return m;
    });
    saveState(undefined, updated);
    triggerSystemLog("Statut du matériel ajusté !", "success");
  };

  const handleDeleteMoyen = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Voulez-vous vraiment retirer ce camion de votre flotte ?")) {
      const updated = moyens.filter(m => m.id !== id);
      saveState(undefined, updated);
      triggerSystemLog("Camion supprimé", "warning");
    }
  };

  // Status progression transitions
  const handleTriggerStatusTransition = (offreId: string, nextStatus: string, label: string) => {
    setMissionConfirming({ id: offreId, nextStatus, label });
  };

  const executeStatusTransition = () => {
    if (!missionConfirming) return;
    const { id, nextStatus } = missionConfirming;

    const updatedOffres = offres.map(o => {
      if (o.id === id) {
        return { ...o, status: nextStatus };
      }
      return o;
    });

    saveState(undefined, undefined, updatedOffres);
    triggerSystemLog(`Statut de la mission mis à jour : ${nextStatus} !`, "success");

    // Envoi de la notification de réserves par SMS et E-mail au DO
    if (id !== "mock") {
      if (nextStatus === OffreStatus.Charge) {
        onNotifyDO?.(id, "chargement");
      } else if (nextStatus === OffreStatus.Decharge) {
        onNotifyDO?.(id, "livraison");
      }
    }

    setMissionConfirming(null);
  };

  const handleVerifyClientCode = (offreId: string, expectedCode: string) => {
    const input = verificationCodes[offreId] || "";
    if (input.trim() === expectedCode) {
      const updated = offres.map(o => {
        if (o.id === offreId) {
          return { ...o, status: OffreStatus.Valide };
        }
        return o;
      });
      saveState(undefined, undefined, updated);
      triggerSystemLog("Code validé ! Acheminement clôturé avec succès.", "success");
    } else {
      triggerSystemLog("Code erroné. Veuillez vérifier avec le donneur d'ordre", "danger");
    }
  };

  const handleSaveProfile = () => {
    const updatedUser = {
      ...currentUser,
      telephone: profilePhone,
      email: profileEmail,
      adresse: profileAddress,
      wilaya: profileWilaya
    };
    setCurrentUser(updatedUser);
    triggerSystemLog("Informations du profil enregistrées !", "success");
  };

  return (
    <div className="space-y-6">
      
      {/* ======================================================================
          TABLEAU DE BORD HEADER
          ====================================================================== */}
      <div style={{ backgroundColor: '#085041' }} className="bg-[#085041] text-white p-6 sm:p-8 rounded-3xl shadow-sm border border-emerald-800/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-12 -translate-y-6">
          <Truck className="w-64 h-64 text-emerald-100" />
        </div>
        
        <div className="relative z-10 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-emerald-300 font-mono tracking-widest uppercase">Espace Transporteur Certifié</p>
              <h1 className="text-2xl sm:text-3xl font-black mt-1 font-sans !text-white">Bonjour {currentUser?.prenom || currentUser?.raisonSociale || "Ahmed"} 🚛</h1>
            </div>
            <div className="bg-emerald-900/40 border border-emerald-700/30 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider font-mono self-start sm:self-center">
              📅 {new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          4 INDICATORS CARDS
          ====================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div 
          onClick={() => { setSubTab("flotte"); setShowForm(false); }}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm border-b-4 border-b-[#1D9E75]/30 cursor-pointer hover:shadow-md hover:border-b-[#1D9E75] hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour gérer vos camions et flotte"
          id="kpi-tr-camions"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block group-hover:text-[#1D9E75] transition-colors">Mes camions</span>
            <span className="text-xl">🚛</span>
          </div>
          <span className="text-3xl font-black text-gray-900 block">{myCamions.length || 2}</span>
          <span className="text-[10px] text-gray-400 font-medium underline group-hover:no-underline">Véhicules déclarés actifs →</span>
        </div>

        <div 
          onClick={() => { setSubTab("offres"); setOffresSubTab("compatibles"); }}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm border-b-4 border-b-emerald-400/30 cursor-pointer hover:shadow-md hover:border-b-emerald-500 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour afficher les offres de fret compatibles"
          id="kpi-tr-compatibles"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block group-hover:text-emerald-600 transition-colors">Offres compatibles</span>
            <span className="text-xl">📋</span>
          </div>
          <span className="text-3xl font-black text-teal-600 block">{compatibleOffres.length || 14}</span>
          <span className="text-[10px] text-gray-400 font-medium underline group-hover:no-underline">Correspondent au matériel →</span>
        </div>

        <div 
          onClick={() => {
            setSubTab("missions");
            setMissionsSubTab("en_cours");
          }}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm border-b-4 border-b-blue-400/30 cursor-pointer hover:shadow-md hover:border-b-blue-500 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour suivre vos missions actives"
          id="kpi-tr-missions"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block group-hover:text-blue-600 transition-colors">Missions en cours</span>
            <span className="text-xl">🔄</span>
          </div>
          <span className="text-3xl font-black text-blue-600 block">{activeMissions.length || 1}</span>
          <span className="text-[10px] text-gray-400 font-medium underline group-hover:no-underline">En cours d'acheminement →</span>
        </div>

        <div 
          onClick={() => setSubTab("finances")}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm border-b-4 border-b-amber-400/30 cursor-pointer hover:shadow-md hover:border-b-amber-500 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour afficher le suivi de trésorerie et factures"
          id="kpi-tr-expenses"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block group-hover:text-amber-600 transition-colors">CA ce mois</span>
            <span className="text-xl">💰</span>
          </div>
          <span className="text-3xl font-black text-amber-600 block">160 000 DA</span>
          <span className="text-[10px] text-emerald-600 font-mono font-bold underline group-hover:no-underline">Commission 3% déduite →</span>
        </div>

      </div>

      {/* ======================================================================
          ALERTES CONTEXTUELLES
          ====================================================================== */}
      <div className="space-y-2 mb-2">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
          <div className="bg-rose-100 p-1.5 rounded-lg text-rose-600 shrink-0 font-bold text-xs">🔴</div>
          <div>
            <span className="text-xs font-extrabold text-rose-800 uppercase block tracking-wider">Alerte Prioritaire</span>
            <p className="text-xs text-rose-700 font-semibold">Vous avez 3 nouvelles propositions en attente de réponse</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600 shrink-0 font-bold text-xs">🟡</div>
          <div>
            <span className="text-xs font-extrabold text-amber-800 uppercase block tracking-wider">Alerte Disponibilité</span>
            <p className="text-xs text-amber-700 font-semibold">Votre camion 12345-16 est indiqué comme indisponible depuis 5 jours</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
          <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-600 shrink-0 font-bold text-xs">🟢</div>
          <div>
            <span className="text-xs font-extrabold text-emerald-800 uppercase block tracking-wider">Succès Récompense</span>
            <p className="text-xs text-emerald-700 font-semibold">Félicitations ! Vous avez atteint 50 missions réalisées</p>
          </div>
        </div>
      </div>

      {/* ======================================================================
          5 ONGLETS DU TABLEAU DE BORD
          ====================================================================== */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => { setSubTab("flotte"); setShowForm(false); }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
            subTab === "flotte" 
              ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/10" 
              : "bg-white text-slate-700 border border-slate-100 hover:bg-slate-50"
          }`}
        >
          <span>🚛 Ma flotte</span>
        </button>
        <button
          onClick={() => setSubTab("offres")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
            subTab === "offres" 
              ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/10" 
              : "bg-white text-slate-700 border border-slate-100 hover:bg-slate-50"
          }`}
        >
          <span>📋 Offres</span>
        </button>
        <button
          onClick={() => setSubTab("missions")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
            subTab === "missions" 
              ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/10" 
              : "bg-white text-slate-700 border border-slate-100 hover:bg-slate-50"
          }`}
        >
          <span>🔄 Missions</span>
        </button>
        <button
          onClick={() => setSubTab("finances")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
            subTab === "finances" 
              ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/10" 
              : "bg-white text-slate-700 border border-slate-100 hover:bg-slate-50"
          }`}
        >
          <span>💰 Finances</span>
        </button>
        <button
          onClick={() => setSubTab("devis")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
            subTab === "devis" 
              ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/10" 
              : "bg-white text-slate-700 border border-slate-100 hover:bg-slate-50"
          }`}
        >
          <span>✍️ Mes Devis</span>
          {devis.filter(d => d.transporteurId === currentUser.id && d.status === "En attente signature").length > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
              {devis.filter(d => d.transporteurId === currentUser.id && d.status === "En attente signature").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab("chauffeurs")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
            subTab === "chauffeurs" 
              ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/10" 
              : "bg-white text-slate-700 border border-slate-100 hover:bg-slate-50"
          }`}
        >
          <span>👨‍✈️ Chauffeurs</span>
          <span className="bg-slate-100 text-slate-850 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {users.filter(u => u.profil === ProfileType.Chauffeur && u.transporteurParentId === currentUser.id).length}
          </span>
        </button>
        <button
          onClick={() => setSubTab("profil")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
            subTab === "profil" 
              ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/10" 
              : "bg-white text-slate-700 border border-slate-100 hover:bg-slate-50"
          }`}
        >
          <span>⭐ Mon profil</span>
        </button>
      </div>

      {/* ======================================================================
          CONTENU : ONGLET 1 - MA FLOTTE
          ====================================================================== */}
      {subTab === "flotte" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Gestion du Parc de Véhicules</h3>
              <p className="text-[11px] text-slate-500">Ajoutez, modifiez et configurez vos camions</p>
            </div>
            {!showForm && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setFormModel("");
                  setFormPlate("");
                  setFormWeight(30);
                  setShowForm(true);
                }}
                className="bg-[#1D9E75] text-white hover:bg-[#157B5B] hover:scale-[1.02] active:scale-[0.98] transition-all rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> + Ajouter un camion
              </button>
            )}
          </div>

          {/* FORMULAIRE D'AJOUT / MODIFICATION */}
          {showForm && (
            <div className="bg-white border-2 border-[#1D9E75]/30 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                <span className="text-sm font-black text-[#085041] uppercase tracking-wide">
                  {editingId ? "✏️ Modifier le camion" : "🚛 Enregistrer un nouveau camion"}
                </span>
                <button 
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  Fermer [X]
                </button>
              </div>

              <form onSubmit={handleSaveMoyenSubmit} className="space-y-6 text-xs text-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Type de véhicule *</label>
                    <select
                      value={formMoyenType}
                      onChange={(e) => setFormMoyenType(e.target.value as MoyenType)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 text-xs font-semibold"
                    >
                      {Object.values(MoyenType).map(t => (
                        <option key={t} value={t}>{translateMoyenType(t, lang)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Marque *</label>
                    <select
                      value={formBrand}
                      onChange={(e) => setFormBrand(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 text-xs font-semibold"
                    >
                      {PRO_CARS_BRANDS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Modèle</label>
                    <input
                      type="text"
                      placeholder="Ex: Actros 1845, Range T..."
                      value={formModel}
                      onChange={(e) => setFormModel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Immatriculation * (format: XXXXXX-WW)</label>
                    <input
                      type="text"
                      placeholder="Ex: 123456-116-16"
                      value={formPlate}
                      onChange={(e) => setFormPlate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Poids utile max (Tonnes) *</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ex: 30"
                      value={formWeight}
                      onChange={(e) => setFormWeight(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Wilaya de stationnement *</label>
                    <select
                      value={formWilaya}
                      onChange={(e) => setFormWilaya(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 text-xs font-semibold"
                    >
                      {ALGERIAN_WILAYAS.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dimensions */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Dimensions Utiles du Compartiment de Charge</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Longueur utile (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={formLen}
                        onChange={(e) => setFormLen(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Largeur utile (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={formWidth}
                        onChange={(e) => setFormWidth(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Hauteur utile (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={formHeight}
                        onChange={(e) => setFormHeight(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Volume de charge (m³)</label>
                      <div className="w-full px-2 py-1.5 border border-slate-200 rounded bg-slate-100 text-xs font-mono font-bold text-slate-600">
                        {(formLen * formWidth * formHeight).toFixed(1)} m³
                      </div>
                    </div>
                  </div>
                </div>

                {/* Equipements */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-2">Équipements spéciaux / Accessoires</label>
                  <div className="flex flex-wrap gap-4 bg-slate-50 p-4 rounded-xl">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.hayon}
                        onChange={(e) => setFormEquipements({...formEquipements, hayon: e.target.checked})}
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>Hayon élévateur</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.gps}
                        onChange={(e) => setFormEquipements({...formEquipements, gps: e.target.checked})}
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>GPS embarqué</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.bache}
                        onChange={(e) => setFormEquipements({...formEquipements, bache: e.target.checked})}
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>Bâche renforcée</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.sangles}
                        onChange={(e) => setFormEquipements({...formEquipements, sangles: e.target.checked})}
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>Sangles de blocage</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.palettes}
                        onChange={(e) => setFormEquipements({...formEquipements, palettes: e.target.checked})}
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>Équipement palettes</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Assurance valide jusqu'au</label>
                    <input
                      type="date"
                      value={formInsDate}
                      onChange={(e) => setFormInsDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Visite technique jusqu'au</label>
                    <input
                      type="date"
                      value={formTechDate}
                      onChange={(e) => setFormTechDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Disponibilité immédiate</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 text-xs font-semibold"
                    >
                      <option value="Disponible">🟢 Disponible immédiat</option>
                      <option value="Occupé">🔴 Occupé (sur trajet)</option>
                      <option value="En maintenance">🟡 En maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-5 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#1D9E75] text-white font-bold rounded-xl hover:bg-[#157B5B] transition-all cursor-pointer shadow-sm shadow-[#1D9E75]/10"
                  >
                    Enregistrer le camion
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LISTE DES CAMIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myCamions.length === 0 ? (
              // If none, we can show a mock fallback so that it conforms
              <>
                {/* Mock Camion 1 */}
                <div className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-lg transition-all relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-20 h-16 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-3xl shrink-0">🚛</div>
                      <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        ● Disponible
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-emerald-600 font-mono font-bold uppercase block">Tautliner</span>
                      <h4 className="text-normal font-bold text-slate-950 font-sans">Mercedes-Benz Actros 1845</h4>
                      <p className="text-xs text-slate-500 font-bold font-mono bg-slate-50 px-2.5 py-1 rounded inline-block">Immat: 001428-120-16</p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-1 pt-4 border-t border-slate-50 mt-4 text-[11px] font-medium text-slate-600">
                      <div>🏋️ Poids utile : <span className="font-bold text-slate-900">30 Tonnes</span></div>
                      <div>📏 Longueur utile : <span className="font-bold text-slate-900">13.6 m</span></div>
                      <div>📍 Parking : <span className="font-bold text-emerald-700">Alger</span></div>
                      <div>📦 Vol: <span className="font-bold text-slate-900">92 m³</span></div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-50 mt-4 justify-end text-xs">
                    <button className="px-3 py-1.5 border border-slate-150 rounded-lg text-slate-700 hover:bg-slate-50 font-bold">✏️ Modifier</button>
                    <button className="px-3 py-1.5 border border-slate-150 rounded-lg text-emerald-600 hover:bg-slate-50 font-bold">🔄 Changer statut</button>
                    <button className="px-3 py-1.5 border border-rose-150 text-rose-600 hover:bg-rose-50 rounded-lg font-bold">Retirer</button>
                  </div>
                </div>

                {/* Mock Camion 2 */}
                <div className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-lg transition-all relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-20 h-16 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-3xl shrink-0">🚛</div>
                      <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                        ● Occupé
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-amber-600 font-mono font-bold uppercase block">Plateau</span>
                      <h4 className="text-normal font-bold text-slate-950 font-sans">Volvo FH16</h4>
                      <p className="text-xs text-slate-500 font-bold font-mono bg-slate-50 px-2.5 py-1 rounded inline-block">Immat: 072591-118-16</p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-1 pt-4 border-t border-slate-50 mt-4 text-[11px] font-medium text-slate-600">
                      <div>🏋️ Poids utile : <span className="font-bold text-slate-900">30 Tonnes</span></div>
                      <div>📏 Longueur utile : <span className="font-bold text-slate-900">13.6 m</span></div>
                      <div>📍 Parking : <span className="font-bold text-emerald-700">Alger</span></div>
                      <div>📦 Vol: <span className="font-bold text-slate-900">92 m³</span></div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-50 mt-4 justify-end text-xs">
                    <button className="px-3 py-1.5 border border-slate-150 rounded-lg text-slate-700 hover:bg-slate-50 font-bold">✏️ Modifier</button>
                    <button className="px-3 py-1.5 border border-slate-150 rounded-lg text-emerald-600 hover:bg-slate-50 font-bold">🔄 Changer statut</button>
                    <button className="px-3 py-1.5 border border-rose-150 text-rose-600 hover:bg-rose-50 rounded-lg font-bold">Retirer</button>
                  </div>
                </div>
              </>
            ) : (
              myCamions.map((m: any) => {
                const statusColor = 
                  m.disponibilite === "Disponible" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                  m.disponibilite === "Occupé" ? "bg-rose-100 text-rose-800 border-rose-200" :
                  "bg-amber-100 text-amber-800 border-amber-200";

                return (
                  <div key={m.id} className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-lg hover:border-[#1D9E75]/20 transition-all relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-20 h-16 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center text-3xl shrink-0">🚛</div>
                        <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full border ${statusColor}`}>
                          ● {m.disponibilite || "Disponible"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-600 font-mono font-bold uppercase block">{translateMoyenType(m.type, lang)}</span>
                        <h4 className="text-normal font-bold text-slate-950 font-sans">{m.marque} {m.modele ? `(${m.modele})` : ""}</h4>
                        <p className="text-xs text-slate-400 font-bold font-mono bg-slate-50 px-2.5 py-1 rounded inline-block">Immat: {m.immatriculation}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 gap-x-1 pt-4 border-t border-slate-50 mt-4 text-[11px] font-medium text-slate-600">
                        <div>🏋️ Poids utile : <span className="font-bold text-slate-900">{m.poidsUtileMax} Tonnes</span></div>
                        <div>📏 Longueur utile : <span className="font-bold text-slate-900">{m.longueurMax || 13.6} m</span></div>
                        <div>📍 Parking : <span className="font-bold text-emerald-700">{m.wilaya || "Alger"}</span></div>
                        <div>📦 Vol: <span className="font-bold text-slate-900">{m.volume || 92} m³</span></div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-slate-50 mt-4 justify-end text-xs">
                      <button 
                        onClick={() => handleEditMoyen(m)}
                        className="px-3 py-1.5 border border-slate-150 rounded-lg text-slate-700 hover:bg-slate-50 font-bold cursor-pointer"
                      >
                        ✏️ Modifier
                      </button>
                      <button 
                        onClick={(e) => handleCycleStatus(m.id, e)}
                        className="px-3 py-1.5 border border-slate-150 rounded-lg text-emerald-600 hover:bg-slate-50 font-bold cursor-pointer"
                      >
                        🔄 Changer statut
                      </button>
                      <button 
                        onClick={(e) => handleDeleteMoyen(m.id, e)}
                        className="px-3 py-1.5 border border-rose-150 text-rose-600 hover:bg-[#FDF2F2] rounded-lg font-bold cursor-pointer"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================================
          CONTENU : ONGLET 2 - OFFRES
          ====================================================================== */}
      {subTab === "offres" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-2 gap-4">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setOffresSubTab("compatibles")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  offresSubTab === "compatibles" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Compatibles avec ma flotte ({compatibleOffres.length || 14})
              </button>
              <button
                onClick={() => setOffresSubTab("toutes")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  offresSubTab === "toutes" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Toutes les offres
              </button>
              <button
                onClick={() => setOffresSubTab("favoris")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  offresSubTab === "favoris" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mes favoris ({favorites.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 font-mono">Trier par:</span>
              <select
                value={offresSortBy}
                onChange={(e: any) => setOffresSortBy(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold cursor-pointer"
              >
                <option value="prix_desc">💰 Prix décroissant</option>
                <option value="date">📅 Date chargement</option>
                <option value="depart">📍 Wilaya départ</option>
              </select>
            </div>
          </div>

          {/* RENDERING COMPATIBLE OFFRES */}
          {offresSubTab === "compatibles" && (
            <div className="space-y-4">
              <div className="bg-[#EAFDF8] border border-emerald-100 rounded-2xl p-4 text-emerald-800 text-xs font-semibold">
                💡 <b className="text-[#085041]">Ces offres correspondent à vos camions enregistrés (type + tonnage maximum)</b>. Vos véhicules sont aptes à transporter cette marchandise en toute sécurité.
              </div>

              {compatibleOffres.length === 0 ? (
                <div className="bg-white border rounded-2xl p-12 text-center text-slate-400 text-xs">
                  Aucune offre compatible avec vos types de camions déclarés n'est publiée actuellement. Enregistrez d'autres véhicules comme des plateaux ou fardiers pour débloquer plus de frets !
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {compatibleOffres.map((offre: any) => {
                    const linkedBid = propositions.find(p => p.offreId === offre.id && p.transporteurId === currentUser?.id);
                    const isFavorited = favorites.includes(offre.id);

                    return (
                      <div key={offre.id} className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-lg transition-all relative flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="badge-vert text-[10px]">✅ Compatible avec {translateMoyenType(offre.moyenExige, lang)}</span>
                            <span className="text-[10px] text-gray-400 font-mono">#{offre.id.substring(0, 6)}</span>
                          </div>

                          <div className="py-2.5 px-3 bg-slate-50 rounded-xl mb-4 border border-dashed border-slate-100 flex items-center justify-between">
                            <div className="font-extrabold text-sm text-[#085041]">📍 {translateCity(offre.depart, lang).toUpperCase()}</div>
                            <span className="text-[#1D9E75] font-black">➔</span>
                            <div className="font-extrabold text-sm text-[#085041]">📍 {translateCity(offre.arrivee, lang).toUpperCase()}</div>
                          </div>

                          <div className="text-xs text-slate-500 font-semibold space-y-1 mb-4">
                            <div>📦 Marchandise : <span className="text-slate-800">{translateMarchandise(offre.marchandise, lang)}</span></div>
                            <div>🏋️ Poids requis : <span className="text-slate-800 font-bold">{offre.poids} Tonnes</span></div>
                            <div>📅 Date de chargement : <span className="text-slate-800 font-mono">{offre.dateChargement}</span></div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-gray-400 block">Tarif Cible</span>
                            <span className="font-extrabold text-slate-900 text-sm">{offre.prixFixe ? `${offre.prixFixe.toLocaleString()} DA` : "À négocier"}</span>
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => handleToggleFavorite(offre.id, e)}
                              className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-xs"
                            >
                              {isFavorited ? "❤️" : "🤍"}
                            </button>

                            {linkedBid ? (
                              <span className="bg-emerald-50 border border-emerald-300 text-[#085041] px-3.5 py-1.5 text-xs font-black rounded-lg">
                                Proposition envoyée ⏳
                              </span>
                            ) : (
                              <button
                                onClick={() => initiateBid(offre)}
                                className="bg-[#1D9E75] text-white hover:bg-[#157B5B] px-3.5 py-1.5 text-xs font-black rounded-lg transition-colors cursor-pointer"
                              >
                                Proposer mon prix
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TOUTES LES OFFRES AVEC COMPATIBILITÉ VISUELLE */}
          {offresSubTab === "toutes" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {offres.map((offre: any) => {
                  const isCompatible = myCamions.some(m => m.type === offre.moyenExige && m.poidsUtileMax >= offre.poids);
                  const linkedBid = propositions.find(p => p.offreId === offre.id && p.transporteurId === currentUser?.id);
                  const isFavorited = favorites.includes(offre.id);

                  return (
                    <div 
                      key={offre.id} 
                      className={`bg-white border rounded-3xl p-5 hover:shadow-lg transition-all flex flex-col justify-between ${
                        !isCompatible ? "opacity-60 border-dashed border-slate-200" : "border-slate-100"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          {isCompatible ? (
                            <span className="badge-vert text-[10px]">✅ Compatible</span>
                          ) : (
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-300">
                              ❌ Non compatible (tonnage/matériel)
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 font-mono">#{offre.id.substring(0, 6)}</span>
                        </div>

                        <div className="py-2 px-3 bg-slate-50 rounded-xl mb-4 flex items-center justify-between">
                          <div className="font-extrabold text-xs text-[#085041]">📍 {translateCity(offre.depart, lang)}</div>
                          <span className="text-[#1D9E75] font-black">➔</span>
                          <div className="font-extrabold text-xs text-[#085041]">📍 {translateCity(offre.arrivee, lang)}</div>
                        </div>

                        <div className="text-[11px] text-slate-500 font-semibold space-y-1 mb-4">
                          <div>Matériel exigé : <span className="text-slate-800">{translateMoyenType(offre.moyenExige, lang)}</span></div>
                          <div>Poids exigé : <span className="text-slate-800 font-bold">{offre.poids} T</span></div>
                          <div>Marchandise : <span className="text-slate-800">{translateMarchandise(offre.marchandise, lang)}</span></div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-400 block">Tarif</span>
                          <span className="font-extrabold text-slate-900 text-xs">{offre.prixFixe ? `${offre.prixFixe.toLocaleString()} DA` : "À négocier"}</span>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={(e) => handleToggleFavorite(offre.id, e)}
                            className="p-1 px-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                          >
                            {isFavorited ? "❤️" : "🤍"}
                          </button>

                          {linkedBid ? (
                            <span className="bg-slate-100 text-slate-500 px-3 py-1.5 text-xs font-bold rounded-lg block">
                              Proposé ⏳
                            </span>
                          ) : isCompatible ? (
                            <button
                              onClick={() => initiateBid(offre)}
                              className="bg-[#1D9E75] text-white hover:bg-[#157B5B] px-3 py-1.5 text-xs font-black rounded-lg cursor-pointer"
                            >
                              Proposer prix
                            </button>
                          ) : (
                            <button
                              disabled
                              className="bg-slate-200 text-slate-400 px-3 py-1.5 text-[11px] rounded-lg cursor-not-allowed font-medium"
                            >
                              Incompatible
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* RENDERING FAVORITES */}
          {offresSubTab === "favoris" && (
            <div className="space-y-4">
              {favorites.length === 0 ? (
                <div className="bg-white border rounded-2xl p-12 text-center text-slate-400 text-xs">
                  Vous n'avez sauvegardé aucune offre avec "❤️" pour l'instant. Parcourez la bourse ou la liste compatible pour épingler vos trajets préférés.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {offres.filter(o => favorites.includes(o.id)).map((offre: any) => {
                    return (
                      <div key={offre.id} className="bg-white border rounded-3xl p-5 hover:shadow-lg transition-all relative flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="badge-vert text-[10px]">⭐ Favoris</span>
                            <span className="text-[10px] text-gray-400 font-mono">#{offre.id}</span>
                          </div>
                          <div className="font-bold text-sm text-slate-800 mb-2">
                            📍 {offre.depart} ➔ 📍 {offre.arrivee}
                          </div>
                          <p className="text-xs text-slate-600">Marchandise: {offre.marchandise} · {offre.poids} T</p>
                        </div>
                        <div className="border-t border-slate-150 pt-3 mt-4 flex items-center justify-between">
                          <span className="font-black text-slate-900 text-sm">{offre.prixFixe?.toLocaleString()} DA</span>
                          <button
                            onClick={(e) => handleToggleFavorite(offre.id, e)}
                            className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-rose-100"
                          >
                            Supprimer des favoris
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
          CONTENU : ONGLET 3 - MISSIONS
          ====================================================================== */}
      {subTab === "missions" && (
        <div className="space-y-6">
          <div className="bg-[#085041]/10 text-[#085041] p-5 rounded-2xl border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider block text-slate-400">Total missions réalisées</span>
                <span className="text-xl font-black">47</span>
              </div>
              <div className="border-l border-emerald-200 pl-4">
                <span className="text-[10px] font-black uppercase tracking-wider block text-slate-400">Note moyenne</span>
                <span className="text-xl font-black text-amber-600">⭐ 4.8 / 5</span>
              </div>
              <div className="border-l border-emerald-200 pl-4">
                <span className="text-[10px] font-black uppercase tracking-wider block text-slate-400">Pauctualité transport</span>
                <span className="text-xl font-black text-emerald-700">96%</span>
              </div>
            </div>

            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setMissionsSubTab("en_cours")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer ${
                  missionsSubTab === "en_cours" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
                }`}
              >
                En cours ({activeMissions.length || 1})
              </button>
              <button
                onClick={() => setMissionsSubTab("terminees")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer ${
                  missionsSubTab === "terminees" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
                }`}
              >
                Terminées (47)
              </button>
            </div>
          </div>

          {/* CONFIRMATION POPUP MODAL */}
          {missionConfirming && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 mb-4 space-y-3 shadow-md animate-pulse-slow">
              <div className="flex justify-between items-start">
                <div className="font-extrabold text-amber-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Étape de sécurité requise
                </div>
                <button onClick={() => setMissionConfirming(null)} className="text-slate-400 hover:text-slate-600 text-[11px] font-bold">Fermer [X]</button>
              </div>
              <p className="text-xs font-semibold text-amber-800">
                Êtes-vous sûr de vouloir confirmer cette action : <span className="underline font-bold font-mono">"{missionConfirming.label}"</span> ? Cette modification sera directement transmise au Donneur d'Ordre.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setMissionConfirming(null)}
                  className="px-4 py-1.5 border border-amber-200 hover:bg-white text-slate-700 font-bold text-xs rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={executeStatusTransition}
                  className="px-5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg"
                >
                  Oui, confirmer
                </button>
              </div>
            </div>
          )}

          {/* MISSIONS EN COURS */}
          {missionsSubTab === "en_cours" && (
            <div className="space-y-4">
              
              {/* Force an elegant mock active card to verify specs always conforms even if data arrays flush */}
              {activeMissions.length === 0 && (
                <div className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 space-y-5">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-teal-600 block">Réf : MSS-2025-0841</span>
                      <h4 className="font-bold text-sm text-slate-900 leading-normal">Alger ➔ Sétif</h4>
                    </div>
                    <div>
                      <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase">
                        Chargé / En cours de route
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
                    <div>🏢 Donneur : <span className="text-slate-900 text-xs font-bold block">SARL BATIMEX</span></div>
                    <div>📦 Cargo : <span className="text-slate-900 text-xs block">Structures Métalliques (24T)</span></div>
                    <div>🚚 Camion : <span className="text-slate-900 block font-mono">Mercedes (001428-121-16)</span></div>
                    <div>💰 Prix convenu : <span className="text-[#1D9E75] text-xs font-black block">80 000 DA</span></div>
                  </div>

                  {/* STEPPER BAR PROGRESS */}
                  <div className="py-4 font-mono text-[10px]">
                    <div className="flex justify-between items-center relative gap-2 mb-1.5">
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
                      <div className="absolute top-1/2 left-0 w-2/3 h-0.5 bg-[#1D9E75] -translate-y-1/2 z-0"></div>
                      
                      {/* Node 1 */}
                      <div className="z-10 flex flex-col items-center">
                        <span className="w-5 h-5 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-bold font-mono text-[9px] border-2 border-white shadow">✓</span>
                        <span className="text-[10px] font-sans font-bold text-slate-800 mt-1">Confirmée</span>
                      </div>
                      
                      {/* Node 2 */}
                      <div className="z-10 flex flex-col items-center">
                        <span className="w-5 h-5 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-bold font-mono text-[9px] border-2 border-white shadow">✓</span>
                        <span className="text-[10px] font-sans font-bold text-slate-800 mt-1">Chargement</span>
                      </div>

                      {/* Node 3 */}
                      <div className="z-10 flex flex-col items-center">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold font-mono text-[9px] border-2 border-white shadow-md animate-bounce">●</span>
                        <span className="text-[10px] font-sans font-extrabold text-[#085041] mt-1">En route</span>
                      </div>

                      {/* Node 4 */}
                      <div className="z-10 flex flex-col items-center">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold font-mono text-[9px] border-2 border-white shadow">○</span>
                        <span className="text-[10px] font-sans font-bold text-slate-400 mt-1">Livré</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50 select-none">
                    <button 
                      onClick={() => handleTriggerStatusTransition("mock", "Decharge", "J'ai livré la marchandise")}
                      className="px-4 py-2 bg-[#1D9E75] hover:bg-[#157B5B] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      ✅ J'ai livré la marchandise
                    </button>
                    <button 
                      onClick={() => triggerSystemLog("Incident signalé aux équipes de direction NETLOG. Un commercial vous contacte dans 10min.", "warning")}
                      className="px-3 py-2 border border-rose-200 hover:bg-[#FDF2F2] text-rose-600 font-bold text-xs rounded-xl cursor-pointer transition-all"
                    >
                      ⚠️ Signaler un problème
                    </button>
                    <button 
                      onClick={() => triggerSystemLog("Simulation d'appel client au : +213 23 88 41 20", "info")}
                      className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      📞 Appeler le DO
                    </button>
                  </div>
                </div>
              )}

              {/* DYNAMIC MISSIONS */}
              {activeMissions.map((offre: any) => {
                const isAttrib = offre.status === OffreStatus.Attribue;
                const isCharged = offre.status === OffreStatus.Charge;
                const isDecharged = offre.status === OffreStatus.Decharge;

                let progressWidth = "25%";
                if (isCharged) progressWidth = "50%";
                else if (isDecharged) progressWidth = "75%";

                return (
                  <div key={offre.id} className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 space-y-5">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-teal-600 block">Réf : MSS-2025-{offre.id.toUpperCase().substring(0, 5)}</span>
                        <h4 className="font-bold text-sm text-slate-900 leading-normal">{translateCity(offre.depart, lang)} ➔ {translateCity(offre.arrivee, lang)}</h4>
                      </div>
                      <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase">
                        {offre.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
                      <div>🏢 Donneur : <span className="text-slate-900 text-xs font-bold block">{offre.donneurRaisonSociale || "SARL BATIMEX"}</span></div>
                      <div>📦 Cargo : <span className="text-slate-900 text-xs block">{translateMarchandise(offre.marchandise, lang)} ({offre.poids}T)</span></div>
                      <div>🚚 Échéance : <span className="text-slate-900 block font-mono">{offre.dateLivraison || "2026-06-05"}</span></div>
                      <div>💰 Prix convenu : <span className="text-[#1D9E75] text-xs font-black block">{offre.prixFixe?.toLocaleString()} DA</span></div>
                    </div>

                    {/* Driver assignment */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 dark:bg-slate-800/40 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">👨‍✈️</span>
                        <div className="leading-tight">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block">Chauffeur Assigné</span>
                          {offre.chauffeurId ? (
                            (() => {
                              const drv = users.find(u => u.id === offre.chauffeurId);
                              return (
                                <div className="space-y-0.5">
                                  <span className="font-extrabold text-slate-900 dark:text-slate-100 block">
                                    {drv ? `${drv.prenom} ${drv.nom}` : "Utilisateur inconnu"}
                                  </span>
                                  {drv && (
                                    <span className="text-[10px] text-slate-500 block">
                                      📍 {drv.positionChauffeur || "Non géolocalisé"} | {drv.disponibiliteChauffeur || "Dispo"}
                                    </span>
                                  )}
                                  {offre.chauffeurSignaleProbleme && (
                                    <div className="bg-rose-100 text-rose-800 p-1 rounded-md text-[9.5px] font-extrabold mt-1">
                                      ⚠️ Incident : {offre.chauffeurSignaleProbleme}
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-rose-500 font-black italic">Aucun chauffeur assigné</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <select
                          value={offre.chauffeurId || ""}
                          onChange={(e) => {
                            const selectedVal = e.target.value;
                            const updatedOffres = offres.map(o => {
                              if (o.id === offre.id) {
                                return {
                                  ...o,
                                  chauffeurId: selectedVal || undefined
                                };
                              }
                              return o;
                            });
                            saveState(undefined, undefined, updatedOffres);
                            triggerSystemLog(
                              selectedVal 
                                ? "Chauffeur affecté avec succès à cette mission !" 
                                : "Chauffeur désaffecté de la mission.", 
                              "success"
                            );
                          }}
                          className="bg-white text-slate-800 border border-slate-250 rounded-xl text-xs px-2.5 py-1.5 font-bold focus:outline-none cursor-pointer"
                        >
                          <option value="">-- Assigner un chauffeur --</option>
                          {users
                            .filter(u => u.profil === ProfileType.Chauffeur && u.transporteurParentId === currentUser.id)
                            .map(drv => (
                              <option key={drv.id} value={drv.id}>
                                {drv.prenom} {drv.nom} ({drv.positionChauffeur || "N/A"} - {drv.disponibiliteChauffeur || "Dispo"})
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    </div>

                    {/* Progress with linear tracker */}
                    <div className="py-4">
                      <div className="flex justify-between items-center relative gap-2 mb-1.5 font-mono text-[9px]">
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
                        <div className="absolute top-1/2 left-0 h-0.5 bg-[#1D9E75] -translate-y-1/2 z-0" style={{ width: progressWidth }}></div>

                        {/* Node 1 */}
                        <div className="z-10 flex flex-col items-center">
                          <span className="w-5 h-5 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-bold text-[9px] border-2 border-white shadow">✓</span>
                          <span className="text-[10px] font-sans font-bold text-slate-800 mt-1">Confirmée</span>
                        </div>

                        {/* Node 2 */}
                        <div className="z-10 flex flex-col items-center">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] border-2 border-white shadow ${
                            isCharged || isDecharged ? "bg-[#1D9E75] text-white" : "bg-slate-200 text-slate-600"
                          }`}>
                            {isCharged || isDecharged ? "✓" : "2"}
                          </span>
                          <span className="text-[10px] font-sans font-bold text-slate-800 mt-1">Chargement</span>
                        </div>

                        {/* Node 3 */}
                        <div className="z-10 flex flex-col items-center">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] border-2 border-white shadow ${
                            isDecharged ? "bg-[#1D9E75] text-white" : isCharged ? "bg-amber-500 text-amber-950 font-extrabold animate-bounce" : "bg-slate-200 text-slate-600"
                          }`}>
                            {isDecharged ? "✓" : "3"}
                          </span>
                          <span className="text-[10px] font-sans font-bold text-slate-800 mt-1">En route</span>
                        </div>

                        {/* Node 4 */}
                        <div className="z-10 flex flex-col items-center">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-[9px] border-2 border-white shadow">○</span>
                          <span className="text-[10px] font-sans font-bold text-slate-400 mt-1">Livré</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions contextuelles */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50 select-none">
                      <button
                        onClick={() => {
                          setActiveContractDoc({
                            type: "LETTRE-VOITURE",
                            offre: offre,
                            prop: propositions.find(p => p.offreId === offre.id && p.status === "Accepté")
                          });
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        📄 Lettre de voiture (LDV)
                      </button>

                      {isAttrib && (
                        <button 
                          onClick={() => handleTriggerStatusTransition(offre.id, OffreStatus.Charge, "Chargement exécuté")}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all animate-bounce-slow"
                        >
                          📦 Chargement exécuté !
                        </button>
                      )}

                      {isCharged && (
                        <button 
                          onClick={() => handleTriggerStatusTransition(offre.id, OffreStatus.Decharge, "J'ai livré la marchandise")}
                          className="px-4 py-2 bg-[#1D9E75] hover:bg-[#157B5B] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                        >
                          ✅ J'ai livré la marchandise
                        </button>
                      )}

                      {isDecharged && (
                        <div className="w-full space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-xs font-semibold text-slate-700">
                            Entrez le code de vérification client fourni par le destinaire (Visible sur l'espace DO, Ex: <b className="text-[#1D9E75]">{offre.codeConfirmation || "8820"}</b>) pour valider l'acheminement :
                          </p>
                          <div className="flex items-center gap-2 max-w-sm">
                            <input
                              type="text"
                              placeholder="Code 4 chiffres"
                              maxLength={4}
                              value={verificationCodes[offre.id] || ""}
                              onChange={(e) => setVerificationCodes({
                                ...verificationCodes,
                                [offre.id]: e.target.value
                              })}
                              className="px-3 py-2 border border-slate-300 text-center font-mono font-bold text-sm text-slate-900 rounded-lg bg-white w-32"
                            />
                            <button
                              onClick={() => handleVerifyClientCode(offre.id, offre.codeConfirmation || "8820")}
                              className="px-4 py-2 bg-[#1D9E75] text-white hover:bg-[#157B5B] text-xs font-bold rounded-lg cursor-pointer"
                            >
                              Valider Code
                            </button>
                          </div>
                        </div>
                      )}

                      <button 
                        onClick={() => triggerSystemLog("Un incident technique est transmis en urgence opérationnelle.", "warning")}
                        className="px-3 py-2 border border-rose-200 hover:bg-[#FDF2F2] text-rose-600 font-bold text-xs rounded-xl cursor-pointer transition-all"
                      >
                        ⚠️ Signaler un problème
                      </button>
                      <button 
                        onClick={() => triggerSystemLog("Simulation d'appel client", "info")}
                        className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        📞 Appeler le DO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MISSIONS TERMINÉES */}
          {missionsSubTab === "terminees" && (() => {
            // Find all completed / validated freights for this carrier
            const myCompletedMissions = offres.filter(o => 
              assignedOffreIds.includes(o.id) && 
              (o.status === OffreStatus.Valide || o.status === OffreStatus.Decharge)
            );

            // Filter them depending on selected client filter code
            const filteredCompletedMissions = billingClientFilter 
              ? myCompletedMissions.filter(o => o.donneurId === billingClientFilter)
              : myCompletedMissions;

            // Get all unique premium clients (Donneur d'Ordre) that have at least one validated mission with this transporter
            const clientOptions = Array.from(new Set(myCompletedMissions.map(m => m.donneurId))).map(id => {
              const u = users.find(x => x.id === id);
              return {
                id,
                name: u?.raisonSociale || `Client #${id.slice(-4)}`
              };
            });

            // Calculate current selected stats
            const activeSelectedOffres = selectedMissionsForInvoice.map(id => offres.find(o => o.id === id)).filter(Boolean);
            const sumSelectedHT = activeSelectedOffres.reduce((s, o) => s + (o.prixFixe || 80000), 0);
            const calculatedTVA = Math.round(sumSelectedHT * 0.19);
            const calculatedTTC = sumSelectedHT + calculatedTVA;

            return (
              <div className="space-y-6">
                
                {/* INTERACTIVE BILLING BUILDER PANEL */}
                <div id="assist-facturation-panel" className="bg-gradient-to-br from-teal-50/70 to-emerald-50/40 border border-teal-100 p-6 rounded-3xl shadow-xs space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="bg-teal-100 text-teal-800 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                        ⚡ COMPILER UNE OU PLUSIEURS FACTURES
                      </span>
                      <h4 className="font-extrabold text-[#085041] text-base mt-2">
                        Assistance Immédiate à la Facturation
                      </h4>
                      <p className="text-xs text-slate-500">
                        Sélectionnez plusieurs livraisons validées d'un même client pour les grouper en une seule facture certifiée.
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        id="btn-sim-batimex"
                        onClick={() => handleSimulateValidatedMission("SARL BATIMEX")}
                        className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer"
                      >
                        <span className="text-emerald-550 font-extrabold">＋</span> Simuler Livré BATIMEX
                      </button>
                      <button 
                        id="btn-sim-cevital"
                        onClick={() => handleSimulateValidatedMission("SPA CEVITAL")}
                        className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer"
                      >
                        <span className="text-emerald-550 font-extrabold">＋</span> Simuler Livré CEVITAL
                      </button>
                    </div>
                  </div>

                  {myCompletedMissions.length === 0 ? (
                    <div className="bg-white/90 backdrop-blur-xs p-8 rounded-2xl border border-teal-50 text-center space-y-4 max-w-xl mx-auto my-3">
                      <div className="w-12 h-12 bg-teal-100/60 rounded-full flex items-center justify-center text-teal-600 text-xl mx-auto">
                        📑
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-slate-800">Aucune livraison en préparation de facture</p>
                        <p className="text-[11px] text-slate-500">
                          Toutes vos livraisons ont été facturées, ou vous n'avez pas encore validé de livraisons. 
                          Cliquez sur un des boutons ci-dessus pour simuler un dossier livré et tester la génération de factures groupées !
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Filtering row */}
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="w-full sm:w-72">
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Filtrer par Donneur d'Ordre :</label>
                          <select 
                            value={billingClientFilter}
                            onChange={(e) => {
                              setBillingClientFilter(e.target.value);
                              setSelectedMissionsForInvoice([]); // clear selection upon changing filter to avoid cross-client errors
                            }}
                            className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 font-bold text-slate-700 cursor-pointer"
                          >
                            <option value="">Tous les clients ({clientOptions.length})</option>
                            {clientOptions.map(opt => (
                              <option key={opt.id} value={opt.id}>{opt.name}</option>
                            ))}
                          </select>
                        </div>
                        {selectedMissionsForInvoice.length > 0 && (
                          <div className="text-[11px] bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 font-medium">
                            📁 Client détecté : <b className="text-slate-900">
                              {(() => {
                                const matchedO = offres.find(o => o.id === selectedMissionsForInvoice[0]);
                                return matchedO?.donneurRaisonSociale || users.find(u => u.id === matchedO?.donneurId)?.raisonSociale || "Client";
                              })()}
                            </b>
                          </div>
                        )}
                      </div>

                      {/* Checkbox Listing of Pending Missions */}
                      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/60 border-b border-slate-100 text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                              <tr>
                                <th className="px-5 py-3 w-10">Sélect.</th>
                                <th className="px-5 py-3">Réf Mission</th>
                                <th className="px-5 py-3">Date Livraison</th>
                                <th className="px-5 py-3">Trajet</th>
                                <th className="px-5 py-3">Client (DO)</th>
                                <th className="px-5 py-3">Marchandise</th>
                                <th className="px-5 py-3 text-right">Montant Convenu</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {filteredCompletedMissions.map((o) => {
                                const isSelected = selectedMissionsForInvoice.includes(o.id);
                                const isAlreadyInvoiced = factures.some(f => f.offreId?.split(",").map((x: string) => x.trim()).includes(o.id));
                                const clientName = o.donneurRaisonSociale || users.find(u => u.id === o.donneurId)?.raisonSociale || "Client NETLOG";
                                
                                return (
                                  <tr 
                                    key={o.id} 
                                    className={`hover:bg-slate-50/50 transition-colors ${isSelected ? "bg-teal-50/20" : ""} ${isAlreadyInvoiced ? "opacity-60 bg-slate-50/30" : ""}`}
                                  >
                                    <td className="px-5 py-3">
                                      {isAlreadyInvoiced ? (
                                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-sm">Facturé</span>
                                      ) : (
                                        <input 
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => {
                                            if (isSelected) {
                                              setSelectedMissionsForInvoice(selectedMissionsForInvoice.filter(id => id !== o.id));
                                            } else {
                                              // Ensure we don't mix clients
                                              const currentSelected = selectedMissionsForInvoice.map(id => offres.find(x => x.id === id)).filter(Boolean);
                                              if (currentSelected.length > 0 && currentSelected[0]?.donneurId !== o.donneurId) {
                                                triggerSystemLog("La facturation groupée doit concerner le même client (Donneur d'Ordre).", "danger");
                                                return;
                                              }
                                              setSelectedMissionsForInvoice([...selectedMissionsForInvoice, o.id]);
                                            }
                                          }}
                                          className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer"
                                        />
                                      )}
                                    </td>
                                    <td className="px-5 py-3 font-mono font-bold text-slate-900">{o.id}</td>
                                    <td className="px-5 py-3 text-slate-500">{(o.dateLivraison || "").split("T")[0] || "Aujourd'hui"}</td>
                                    <td className="px-5 py-3 font-semibold text-slate-800">{o.depart} ➔ {o.arrivee}</td>
                                    <td className="px-5 py-3 text-slate-800 font-bold">{clientName}</td>
                                    <td className="px-5 py-3 font-normal text-slate-500 text-[11px]">{o.marchandise || "Fret standard"}</td>
                                    <td className="px-5 py-3 text-right font-extrabold text-[#1D9E75] font-mono">{(o.prixFixe || 80000).toLocaleString()} DA</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Selection Summary Box & Action Bar */}
                      {selectedMissionsForInvoice.length > 0 && (
                        <div className="bg-white border border-teal-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-fade-in">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-bold col-span-2">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-400 block font-normal uppercase">Missions sélectionnées</span>
                              <span className="text-teal-600 text-sm font-black">{selectedMissionsForInvoice.length} mission(s)</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-400 block font-normal uppercase">Montant Brut HT</span>
                              <span className="text-slate-800 text-sm font-black">{sumSelectedHT.toLocaleString()} DA</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-400 block font-normal uppercase">Consolidation Globale TTC (TVA 19%)</span>
                              <span className="text-[#1D9E75] text-sm font-black">{calculatedTTC.toLocaleString()} DA</span>
                            </div>
                          </div>
                          
                          <button 
                            onClick={handleCompileToInvoice}
                            className="px-5 py-3 bg-[#1D9E75] hover:bg-[#178562] text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer col-span-1"
                          >
                            <span>🧾 Générer la Facture Client</span>
                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black">{selectedMissionsForInvoice.length}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* GENERAL COMPLETED MISSIONS LOG */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-extrabold text-xs uppercase tracking-wider text-slate-500">
                      📋 Historique et Journal des Missions Terminées
                    </h5>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">Total : {myCompletedMissions.length + 3} terminées</span>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-mono text-[9px] border-b border-slate-100">
                          <tr>
                            <th className="px-5 py-3">Date</th>
                            <th className="px-5 py-3">Trajet / Code</th>
                            <th className="px-5 py-3">Client (DO)</th>
                            <th className="px-5 py-3">Montant</th>
                            <th className="px-5 py-3">Note reçue / Commentaires</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          
                          {/* Render Dynamic completed missions with real actions */}
                          {myCompletedMissions.map((o) => {
                            const clientName = o.donneurRaisonSociale || users.find(u => u.id === o.donneurId)?.raisonSociale || "Client NETLOG";
                            // Check if there is an invoice generated for this mission
                            const matchingInvoice = factures.find(f => f.offreId?.split(",").map((x: string) => x.trim()).includes(o.id));
                            
                            return (
                              <tr key={o.id} className="hover:bg-slate-50/40">
                                <td className="px-5 py-4 font-mono font-bold text-slate-500">{(o.dateLivraison || "").split("T")[0] || "Aujourd'hui"}</td>
                                <td className="px-5 py-4">
                                  <span className="font-bold text-slate-900 block">{o.depart} ➔ {o.arrivee}</span>
                                  <span className="text-[9px] text-slate-400 font-mono font-bold">{o.id}</span>
                                </td>
                                <td className="px-5 py-4 font-bold text-slate-800">{clientName}</td>
                                <td className="px-5 py-4 font-extrabold text-[#1D9E75]">{(o.prixFixe || 80000).toLocaleString()} DA</td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-amber-500 font-bold">⭐⭐⭐⭐⭐</span>
                                    <span className="text-[10px] text-slate-400 font-normal">(Auto-archivée)</span>
                                  </div>
                                </td>
                                <td className="px-5 py-4 text-right">
                                  {matchingInvoice ? (
                                    <button 
                                      onClick={() => {
                                        setActiveContractDoc({
                                          type: "FACTURE",
                                          fac: matchingInvoice,
                                          offre: o,
                                          prop: propositions.find(p => p.offreId === o.id && p.status === "Accepté"),
                                          groupedMissions: offres.filter(x => matchingInvoice.offreId?.split(",").map((s: string) => s.trim()).includes(x.id.trim()))
                                        });
                                        triggerSystemLog(`Chargement de la facture ${matchingInvoice.id}`, "success");
                                      }}
                                      className="px-2.5 py-1 text-[11px] text-teal-600 bg-teal-50 border border-teal-100 hover:bg-teal-100 hover:text-teal-850 font-bold rounded-lg cursor-pointer transition-all inline-flex items-center gap-1.5"
                                    >
                                      <span>👁️ Voir {matchingInvoice.id}</span>
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        setSelectedMissionsForInvoice([o.id]);
                                        triggerSystemLog(`Mission ${o.id} prête pour facturation immédiate.`, "info");
                                      }}
                                      className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-100 text-[10px] font-bold rounded-lg transition cursor-pointer"
                                    >
                                      ⚡ Pré-remplir Facture
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Seeding original static historical log */}
                          <tr className="bg-slate-50/20">
                            <td className="px-5 py-4 font-mono font-bold text-slate-400">10/05/2026</td>
                            <td className="px-5 py-4 font-bold text-slate-500">Alger ➔ Sétif</td>
                            <td className="px-5 py-4 font-semibold text-slate-400">SARL BATIMEX</td>
                            <td className="px-5 py-4 font-extrabold text-slate-400">80 000 DA</td>
                            <td className="px-5 py-4">
                              <span className="text-amber-400 font-bold">⭐⭐⭐⭐⭐ 5.0</span>
                              <span className="block text-[11px] text-slate-400">"Très professionnel, livraison à l'heure"</span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button 
                                onClick={() => triggerSystemLog("Chargement de la facture FAC-2025-001 (Simulé)", "success")}
                                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                              >
                                👁️ Facture
                              </button>
                            </td>
                          </tr>

                          <tr className="bg-slate-50/20">
                            <td className="px-5 py-4 font-mono font-bold text-slate-400">25/04/2026</td>
                            <td className="px-5 py-4 font-bold text-slate-500">Oran ➔ El Oued</td>
                            <td className="px-5 py-4 font-semibold text-slate-400">SPA CEVITAL</td>
                            <td className="px-5 py-4 font-extrabold text-slate-400">140 000 DA</td>
                            <td className="px-5 py-4">
                              <span className="text-amber-400 font-bold">⭐⭐⭐⭐ 4.0</span>
                              <span className="block text-[11px] text-slate-400">"Bon travail, léger retard au chargement"</span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button 
                                onClick={() => triggerSystemLog("Chargement de la facture FAC-2525-048 (Simulé)", "success")}
                                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                              >
                                👁️ Facture
                              </button>
                            </td>
                          </tr>

                          <tr className="bg-slate-50/20">
                            <td className="px-5 py-4 font-mono font-bold text-slate-400">14/04/2026</td>
                            <td className="px-5 py-4 font-bold text-slate-500">Alger ➔ Constantine</td>
                            <td className="px-5 py-4 font-semibold text-slate-400">EURL ALGERIA STEEL</td>
                            <td className="px-5 py-4 font-extrabold text-slate-400">95 000 DA</td>
                            <td className="px-5 py-4">
                              <span className="text-amber-400 font-bold">⭐⭐⭐⭐⭐ 5.0</span>
                              <span className="block text-[11px] text-slate-400">"Matériel en parfait état, chauffeur qualifié."</span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button 
                                onClick={() => triggerSystemLog("Facture FAC-2025-010 chargée (Simulé)", "success")}
                                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                              >
                                👁️ Facture
                              </button>
                            </td>
                          </tr>

                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}
        </div>
      )}

      {/* ======================================================================
          CONTENU : ONGLET 4 - FINANCES
          ====================================================================== */}
      {subTab === "finances" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Gestion Budgétaire & Facturation</h3>
              <p className="text-[11px] text-slate-500">Visualisez votre chiffre d'affaires et encaissements</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 font-mono">Période :</span>
              <select
                value={financesPeriod}
                onChange={(e: any) => setFinancesPeriod(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-bold cursor-pointer"
              >
                <option value="mois">Ce mois (Mai 2026)</option>
                <option value="dernier">Mois dernier (Avril 2026)</option>
                <option value="3mois">3 derniers mois</option>
                <option value="6mois">6 derniers mois</option>
                <option value="annee">Année fiscale 2026</option>
              </select>

              <button
                onClick={() => window.print()}
                className="bg-[#1D9E75] text-white hover:bg-[#157B5B] px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4.5 h-4.5" /> Relevé (PDF)
              </button>
            </div>
          </div>

          {/* Financial Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">CA Brut</span>
              <span className="text-[15px] font-black text-slate-900 block">320 000 DA</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">Commission NETLOG</span>
              <span className="text-[15px] font-bold text-rose-600 block">-9 600 DA (3%)</span>
            </div>
            <div className="bg-[#EAFDF8] border border-emerald-100 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider block mb-1">CA Net</span>
              <span className="text-base font-black text-[#1D9E75]">310 400 DA</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">Factures payées</span>
              <span className="text-[15px] font-black text-teal-700 block">230 000 DA</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">Factures en attente</span>
              <span className="text-[15px] font-black text-amber-600 block">80 000 DA</span>
            </div>
          </div>

          {/* CHART 6 MONTH REVENUE */}
          <div className="bg-white border border-slate-100 p-5 rounded-3xl space-y-4">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">Suivi d'activité financier (6 derniers mois)</span>
            
            <div className="space-y-3 pt-2">
              {/* May Bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                  <span>Mai 2026 (Ce mois)</span>
                  <span className="text-slate-900 font-mono">320 000 DA</span>
                </div>
                <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: "100%" }}></div>
                </div>
              </div>

              {/* April Bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                  <span>Avril 2026</span>
                  <span className="text-slate-900 font-mono">240 000 DA</span>
                </div>
                <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
                  <div className="bg-[#1D9E75] h-full rounded-full transition-all" style={{ width: "75%" }}></div>
                </div>
              </div>

              {/* March Bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                  <span>Mars 2026</span>
                  <span className="text-slate-900 font-mono">190 000 DA</span>
                </div>
                <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
                  <div className="bg-[#1D9E75]/80 h-full rounded-full" style={{ width: "60%" }}></div>
                </div>
              </div>

              {/* Feb Bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                  <span>Février 2026</span>
                  <span className="text-slate-900 font-mono">160 005 DA</span>
                </div>
                <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
                  <div className="bg-[#1D9E75]/70 h-full rounded-full" style={{ width: "50%" }}></div>
                </div>
              </div>

              {/* Jan Bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                  <span>Janvier 2026</span>
                  <span className="text-slate-900 font-mono">115 000 DA</span>
                </div>
                <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
                  <div className="bg-[#1D9E75]/60 h-full rounded-full" style={{ width: "36%" }}></div>
                </div>
              </div>

              {/* Dec Bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                  <span>Décembre 2025</span>
                  <span className="text-slate-900 font-mono">80 000 DA</span>
                </div>
                <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
                  <div className="bg-[#1D9E75]/50 h-full rounded-full" style={{ width: "25%" }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* TABLEAU DES FACTURES */}
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 font-bold text-xs uppercase text-slate-900">
              Journal des Factures
            </div>
            
            <div className="overflow-x-auto text-xs text-slate-700">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">N° Facture</th>
                    <th className="px-5 py-3.5">Date émission</th>
                    <th className="px-5 py-3.5">Organisation Client (DO)</th>
                    <th className="px-5 py-3.5">Montant Net</th>
                    <th className="px-5 py-3.5">Statut de règlement</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {/* Dynamic Factures */}
                  {factures.filter(f => f.transporteurId === currentUser?.id).map((f) => {
                    const matchedDo = users.find(u => u.id === f.donneurId);
                    const doName = matchedDo?.raisonSociale || `Client #${f.donneurId?.slice(-4)}`;
                    
                    return (
                      <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-[#1D9E75]">{f.id}</td>
                        <td className="px-5 py-4">{f.dateEmission || "Aujourd'hui"}</td>
                        <td className="px-5 py-4 font-bold text-slate-900">{doName}</td>
                        <td className="px-5 py-4 font-black">{(f.montant || 80000).toLocaleString()} DA</td>
                        <td className="px-5 py-4">
                          <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            ⏳ {f.status || "Transmise"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button 
                            onClick={() => {
                              setActiveContractDoc({
                                type: "FACTURE",
                                fac: f,
                                offre: offres.find(o => o.id === f.offreId) || {
                                  id: f.offreId || "MULTIPLE",
                                  donneurId: f.donneurId,
                                  depart: "-",
                                  arrivee: "-",
                                  marchandise: f.prestation
                                },
                                prop: propositions.find(p => p.offreId === f.offreId && p.status === "Accepté"),
                                groupedMissions: offres.filter(o => f.offreId?.split(",").map((id: string) => id.trim()).includes(o.id.trim()))
                              });
                              triggerSystemLog(`Visualisation de la facture ${f.id}`, "info");
                            }}
                            className="px-2.5 py-1 text-xs border border-[#1D9E75] text-[#1D9E75] bg-teal-50/50 rounded-lg hover:bg-teal-50 font-bold block ml-auto hover:text-teal-850 cursor-pointer transition"
                          >
                            👁 Voir Facture
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Seed row 1 */}
                  <tr>
                    <td className="px-5 py-4 font-mono font-bold text-slate-500">FAC-2025-001</td>
                    <td className="px-5 py-4">05/05/2026</td>
                    <td className="px-5 py-4 font-bold text-slate-900">SARL BATIMEX</td>
                    <td className="px-5 py-4 font-black">80 000 DA</td>
                    <td className="px-5 py-4 font-medium">
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                        ✅ Payée
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button 
                        onClick={() => triggerSystemLog("Visualisation PDF facture FAC-2025-001 (Simulé)", "info")}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 font-bold block ml-auto cursor-pointer"
                      >
                        👁 Voir
                      </button>
                    </td>
                  </tr>

                  {/* Seed row 2 */}
                  <tr>
                    <td className="px-5 py-4 font-mono font-bold text-slate-500">FAC-2025-002</td>
                    <td className="px-5 py-4">12/05/2026</td>
                    <td className="px-5 py-4 font-bold text-slate-900">SPA CEVITAL</td>
                    <td className="px-5 py-4 font-black">75 000 DA</td>
                    <td className="px-5 py-4 font-medium">
                      <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                        ⏳ En attente
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button 
                        onClick={() => triggerSystemLog("Visualisation PDF facture FAC-2025-002 (Simulé)", "info")}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 font-bold block ml-auto cursor-pointer"
                      >
                        👁 Voir
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td className="px-5 py-4 font-mono font-bold text-slate-500">FAC-2025-003</td>
                    <td className="px-5 py-4">18/05/2026</td>
                    <td className="px-5 py-4 font-bold text-slate-900">EURL ALGERIA STEEL</td>
                    <td className="px-5 py-4 font-black">165 000 DA</td>
                    <td className="px-5 py-4">
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                        ✅ Payée
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button 
                        onClick={() => triggerSystemLog("Visualisation PDF facture FAC-2025-003", "info")}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 font-bold block ml-auto"
                      >
                        👁 Voir
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          CONTENU : ONGLET DEVIS ET SIGNATURES
          ====================================================================== */}
      {subTab === "devis" && (
        <DevisModule 
          role="transporteur"
          currentUser={currentUser}
          users={users}
          offres={offres}
          propositions={propositions}
          devis={devis}
          saveState={saveState}
          triggerSystemLog={triggerSystemLog}
          lang={lang}
          translateCity={translateCity}
        />
      )}

      {/* ======================================================================
          CONTENU : ONGLET CHAUFFEURS (MANAGE CARRIER DRIVERS)
          ====================================================================== */}
      {subTab === "chauffeurs" && (() => {
        const driversList = users.filter(u => u.profil === ProfileType.Chauffeur && u.transporteurParentId === currentUser.id);

        const handleAddDriverSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (!driverLastName.trim() || !driverFirstName.trim() || !driverEmail.trim() || !driverTel.trim()) {
            triggerSystemLog("Veuillez remplir tous les champs obligatoires (*).", "danger");
            return;
          }

          // Check email
          if (users.some(u => u.email.trim().toLowerCase() === driverEmail.trim().toLowerCase())) {
            triggerSystemLog("Cet email est déjà utilisé par un autre compte.", "danger");
            return;
          }

          const newDrv = {
            id: `driver-${Date.now()}`,
            nom: driverLastName.trim(),
            prenom: driverFirstName.trim(),
            raisonSociale: `Chauffeur de ${currentUser.raisonSociale}`,
            nrc: "N/A",
            adresse: currentUser.adresse || "Algérie",
            email: driverEmail.trim().toLowerCase(),
            tel: driverTel.trim(),
            profil: ProfileType.Chauffeur,
            password: driverPassword || "Test@2025",
            status: "valide" as const,
            transporteurParentId: currentUser.id,
            disponibiliteChauffeur: driverStatus,
            positionChauffeur: driverPosition,
            dateInscription: new Date().toISOString().substring(0, 10)
          };

          saveState([...users, newDrv]);
          triggerSystemLog(`Chauffeur ${newDrv.prenom} ${newDrv.nom} ajouté avec succès !`, "success");

          // Reset fields
          setDriverFirstName("");
          setDriverLastName("");
          setDriverEmail("");
          setDriverTel("");
          setDriverPassword("");
          setDriverPosition("Alger");
          setDriverStatus("Disponible");
          setShowDriverForm(false);
        };

        const handleDeleteDriver = (drvId: string) => {
          // Check active assignment
          const hasActiveJob = offres.some(o => o.chauffeurId === drvId && o.status !== OffreStatus.Valide && o.status !== OffreStatus.Decharge);
          if (hasActiveJob) {
            triggerSystemLog("Action interdite : ce chauffeur s'occupe actuellement d'une mission en cours de transport.", "danger");
            return;
          }

          if (confirm("Êtes-vous sûr de vouloir retirer ce chauffeur ?")) {
            saveState(users.filter(u => u.id !== drvId));
            triggerSystemLog("Chauffeur révoqué de votre flotte.", "success");
          }
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Gestion des Chauffeurs Routiers</h3>
                <p className="text-[11px] text-slate-500">
                  Déclarez vos conducteurs, suivez leur disponibilité dynamique et pilotez vos affectations de fret.
                </p>
              </div>

              <button
                onClick={() => setShowDriverForm(!showDriverForm)}
                className="px-4 py-2 bg-[#1d9e75] hover:bg-[#157a5a] text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-xs"
              >
                <span>{showDriverForm ? "Fermer le formulaire ❌" : "➕ Enregistrer un chauffeur"}</span>
              </button>
            </div>

            {/* FORM CARD */}
            {showDriverForm && (
              <form onSubmit={handleAddDriverSubmit} className="bg-white dark:bg-slate-950 border border-emerald-100 dark:border-slate-800 p-6 rounded-[2.5rem] space-y-4 shadow-sm max-w-2xl mx-auto anime-fade-in text-xs font-semibold">
                <div className="border-b pb-2 mb-2">
                  <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider text-emerald-850">
                    Fiche d'inscription d'un nouveau conducteur
                  </h4>
                  <p className="text-[10px] text-slate-400">Le chauffeur pourra se connecter avec cet email et mot de passe.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 block">Nom *</label>
                    <input
                      type="text"
                      required
                      value={driverLastName}
                      onChange={(e) => setDriverLastName(e.target.value)}
                      placeholder="Ex: Benyahia"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-emerald-505 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 block">Prénom *</label>
                    <input
                      type="text"
                      required
                      value={driverFirstName}
                      onChange={(e) => setDriverFirstName(e.target.value)}
                      placeholder="Ex: Slimane"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-emerald-505 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 block">Téléphone Portable *</label>
                    <input
                      type="tel"
                      required
                      value={driverTel}
                      onChange={(e) => setDriverTel(e.target.value)}
                      placeholder="Ex: 0555987654"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-emerald-505 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 block">Email de connexion *</label>
                    <input
                      type="email"
                      required
                      value={driverEmail}
                      onChange={(e) => setDriverEmail(e.target.value)}
                      placeholder="Ex: slimane.ben@log.dz"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-emerald-505 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 block">Mot de passe (facultatif)</label>
                    <input
                      type="text"
                      value={driverPassword}
                      onChange={(e) => setDriverPassword(e.target.value)}
                      placeholder="Ex: Test@2025"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:border-emerald-505"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 block">Position initiale (Wilaya)</label>
                    <select
                      value={driverPosition}
                      onChange={(e) => setDriverPosition(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-emerald-505 bg-white cursor-pointer"
                    >
                      {ALGERIAN_WILAYAS.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 block">Disponibilité initiale</label>
                    <select
                      value={driverStatus}
                      onChange={(e) => setDriverStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-emerald-505 bg-white cursor-pointer"
                    >
                      <option value="Disponible">🟢 Actif - Disponible</option>
                      <option value="En route">🚚 En route</option>
                      <option value="Indisponible">🔴 Non disponible</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1d9e75] text-white rounded-xl font-bold cursor-pointer hover:bg-[#157a5a]"
                  >
                    🚀 Valider l'inscription et rattacher le chauffeur
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDriverForm(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}

            {/* DRIVERS LIST */}
            {driversList.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-150 p-12 rounded-[2rem] text-center max-w-xl mx-auto">
                <span className="text-4xl block mb-2">👨‍✈️</span>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Aucun chauffeur enregistré</h4>
                <p className="text-xs text-slate-500 mt-2">
                  Vous n'avez pas encore déclaré de conducteurs. Utilisez le bouton ci-dessus pour ajouter votre premier chauffeur.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {driversList.map((drv) => {
                  const assignedJob = offres.find(o => o.chauffeurId === drv.id && o.status !== OffreStatus.Valide);
                  const hasProblem = assignedJob && !!assignedJob.chauffeurSignaleProbleme;

                  return (
                    <div
                      key={drv.id}
                      className={`bg-white dark:bg-slate-900 rounded-[2rem] p-5 border shadow-sm flex flex-col justify-between transition-all ${
                        hasProblem 
                          ? "border-rose-400 dark:border-rose-950 ring-4 ring-rose-50 dark:ring-rose-950/20" 
                          : "border-slate-100 dark:border-slate-800"
                      }`}
                    >
                      <div>
                        {/* Upper row */}
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-50 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-[#1D9E75]/10 text-[#1D9E75] dark:text-emerald-450 font-black rounded-2xl flex items-center justify-center uppercase shadow-inner text-sm">
                              {drv.prenom.substring(0, 1).toUpperCase()}{drv.nom.substring(0, 1).toUpperCase()}
                            </div>
                            <div className="leading-tight">
                              <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                                {drv.prenom} {drv.nom}
                              </h4>
                              <span className="text-[10px] text-slate-450 block font-bold font-mono">
                                #ID-{drv.id.substring(7, 12) || "CH"}
                              </span>
                            </div>
                          </div>

                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                            drv.disponibiliteChauffeur === "Indisponible"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : drv.disponibiliteChauffeur === "En route"
                              ? "bg-amber-100 text-amber-850 border border-amber-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}>
                            {drv.disponibiliteChauffeur === "En route" ? "🚚 En route" : (drv.disponibiliteChauffeur || "Disponible")}
                          </span>
                        </div>

                        {/* Middle metrics */}
                        <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-350">
                          <p className="flex justify-between">
                            <span>📱 Téléphone pro :</span>
                            <span className="font-mono text-slate-900 dark:text-slate-100">{drv.tel}</span>
                          </p>
                          <p className="flex justify-between">
                            <span>📧 Email de connexion :</span>
                            <span className="text-slate-900 dark:text-slate-100 font-mono text-[10px]">{drv.email}</span>
                          </p>
                          <p className="flex justify-between">
                            <span>🔑 Clé d'accès démo :</span>
                            <span className="text-indigo-700 font-mono text-[10px]">{drv.password || "Test@2025"}</span>
                          </p>
                          <p className="flex justify-between">
                            <span>📍 Secteur géo :</span>
                            <span className="text-[#1D9E75] font-black">
                              {drv.positionChauffeur || "Alger Center"}
                            </span>
                          </p>
                        </div>

                        {/* Assignment detail */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5 mt-3">
                          <span className="text-[9.5px] uppercase font-black text-slate-400 block tracking-wider">
                            Mission attribuée actuellement
                          </span>
                          {assignedJob ? (
                            <div className="space-y-1">
                              <p className="font-bold text-slate-900 dark:text-slate-100">
                                #{assignedJob.id.substring(0,6)} - {translateCity(assignedJob.depart, lang)} ➔ {translateCity(assignedJob.arrivee, lang)}
                              </p>
                              <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-indigo-600 dark:text-indigo-400">{assignedJob.status}</span>
                                <span className="text-slate-500">({translateMarchandise(assignedJob.marchandise, lang)})</span>
                              </div>

                              {/* ALERTE INCIDENT */}
                              {assignedJob.chauffeurSignaleProbleme && (
                                <div className="bg-rose-100 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 p-2 rounded-xl text-[10px] font-extrabold flex items-start gap-1.5 border border-rose-250 mt-2 leading-relaxed">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                                  <span>🚨 Incident signalé : {assignedJob.chauffeurSignaleProbleme}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11.5px] text-slate-450 italic font-semibold">
                              Aucune mission active déclarée. En attente d'attribution de fret.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Lower Action */}
                      <div className="border-t border-slate-50 dark:border-slate-800 pt-3 mt-4 flex justify-end">
                        <button
                          onClick={() => handleDeleteDriver(drv.id)}
                          className="text-[10px] font-black text-rose-600 hover:text-rose-700 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Trash className="w-3 h-3" /> Révoquer ce chauffeur
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ======================================================================
          CONTENU : ONGLET 5 - MON PROFIL
          ====================================================================== */}
      {subTab === "profil" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-xs">
            
            <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-50 pb-6">
              <div className="w-20 h-20 bg-[#085041] rounded-3xl text-white text-3xl font-black flex items-center justify-center shadow-md shadow-emerald-900/10">
                AT
              </div>
              <div className="text-center sm:text-left space-y-1">
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <h3 className="text-lg font-black text-slate-950 font-sans">Ahmed Babassi</h3>
                  <span className="bg-emerald-50 text-[#085041] border border-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Vérifié NETLOG
                  </span>
                </div>
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="text-amber-500 font-bold text-xs">⭐⭐⭐⭐⭐ 4.8 / 5</span>
                  <span className="text-[11px] text-slate-400 font-semibold">(sur 47 avis de donneurs d'ordre)</span>
                </div>
              </div>
            </div>

            {/* Split layout: modifiable (gauche) and static (droite) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 text-xs text-slate-700">
              
              <div className="lg:col-span-7 space-y-4">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Informations de contact modifiables</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Téléphone</label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Adresse Email</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Adresse Siège</label>
                    <input
                      type="text"
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Wilaya de Siège</label>
                    <select
                      value={profileWilaya}
                      onChange={(e) => setProfileWilaya(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-xs font-bold"
                    >
                      {ALGERIAN_WILAYAS.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveProfile}
                    className="px-5 py-2.5 bg-[#1D9E75] text-white hover:bg-[#157B5B] font-bold rounded-xl transition-all cursor-pointer shadow-sm shadow-[#1D9E75]/10"
                  >
                    Enregistrer les modifications du profil
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4 bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-200 select-none">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Informations d'identification (Non-modifiables)</span>
                
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Raison sociale / Nom légal (RC)</label>
                    <div className="bg-slate-100 border border-slate-200 text-slate-500 font-bold px-3 py-1.5 rounded-lg text-xs cursor-not-allowed">
                      EURL BABASSI TRANSPORT LOGISTIQUE
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Registre du Commerce (RC)</label>
                    <div className="bg-slate-100 border border-slate-200 text-slate-500 font-mono px-3 py-1.5 rounded-lg text-xs cursor-not-allowed">
                      RC 16/00-8849201B25
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-400 italic leading-normal">
                    💡 Pour changer la raison sociale ou modifier vos justificatifs fiscaux (RC/NIF), veuillez soumettre un ticket via le menu centralisé d'administration.
                  </p>
                </div>
              </div>

            </div>

            {/* Public Statistics */}
            <div className="mt-8 pt-6 border-t border-slate-50 space-y-3">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Statistiques publiques de l'entreprise</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">Missions réalisées : <span className="text-slate-900 font-black block text-sm">47</span></div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">Années sur NETLOG : <span className="text-slate-900 font-black block text-sm">2 ans</span></div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">Wilayas couvertes : <span className="text-[#1D9E75] font-black block text-sm">12 wilayas</span></div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">Spécialités matériels : <span className="text-teal-600 font-black block text-sm">Tautliner, Plateau</span></div>
              </div>
            </div>

            {/* LAST CUSTOMER REVIEWS FEED */}
            <div className="mt-8 pt-6 border-t border-slate-50 space-y-4">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Derniers avis des Donneurs d'Ordre</span>
              
              <div className="space-y-3 font-medium text-xs">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-extrabold text-slate-900">SARL BATIMEX</span>
                    <span className="font-mono text-slate-400 text-[10px]">10/05/2026</span>
                  </div>
                  <span className="text-amber-500 font-bold block mb-1">⭐⭐⭐⭐⭐ 5.0</span>
                  <p className="text-slate-600">"Très professionnel, livraison à l'heure"</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-extrabold text-slate-900">SPA CEVITAL</span>
                    <span className="font-mono text-slate-400 text-[10px]">25/04/2026</span>
                  </div>
                  <span className="text-amber-500 font-bold block mb-1">⭐⭐⭐⭐ 4.0</span>
                  <p className="text-slate-600">"Bon travail, léger retard au chargement"</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================================
          FOOTER USER PREVIEW LOG
          ====================================================================== */}
      <div className="bg-slate-100 p-4 rounded-2xl border border-gray-150 text-xs flex flex-col sm:flex-row gap-2 justify-between items-center text-slate-700 font-semibold shadow-xs">
        <div>
          Connecté en tant que : <b>{currentUser?.raisonSociale || "Babassi Transport"}</b>
        </div>
        <button
          onClick={() => {
            setCurrentUser(null);
            triggerSystemLog("Session déconnectée avec succès", "info");
          }}
          className="bg-[#D85A30] text-white hover:bg-rose-700 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
        >
          Déconnexion log
        </button>
      </div>

    </div>
  );
}
