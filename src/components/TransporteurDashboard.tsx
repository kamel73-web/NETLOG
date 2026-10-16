import React, { useState, useEffect } from "react";
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
  Plus,
} from "lucide-react";
import {
  MoyenType,
  OffreStatus,
  ProfileType,
  DevisOfficiel,
  Facture,
  FactureStatus,
  ReglementMode,
} from "../types";
import { createVehicle } from "../lib/freightOffers";
import { loadFreightOffers, loadProfiles } from "../lib/dataLoader";
import { createDriver } from "../lib/drivers";
import { loadMyInvoices, loadBillableMissions, invoiceDisplayStatus, type Invoice } from "../lib/billing";
import TransporteurFactures from "./TransporteurFactures";
import TransporteurMissionsTerminees from "./TransporteurMissionsTerminees";
import LdvButton from "./LdvButton";

// Prix convenu = prix de la proposition acceptée (le tarif de l'offre peut être libre, donc à 0)
const agreedPrice = (props: any[], o: any): number =>
  props.find((p) => p.offreId === o.id && p.status === "Accepté")?.prixPropose ?? o.prixFixe ?? 0;
import {
  getMissionIdByOfferId,
  confirmDelivery,
  validateLoading,
  validateUnload,
  assignDriver,
} from "../lib/missions";
import DevisModule from "./DevisModule";

// Standard list of Algerian Wilayas
const ALGERIAN_WILAYAS = [
  "Adrar",
  "Chlef",
  "Laghouat",
  "Oum El Bouaghi",
  "Batna",
  "Béjaïa",
  "Biskra",
  "Béchar",
  "Blida",
  "Bouira",
  "Tamanrasset",
  "Tébessa",
  "Tlemcen",
  "Tiaret",
  "Tizi Ouzou",
  "Alger",
  "Djelfa",
  "Jijel",
  "Sétif",
  "Saïda",
  "Skikda",
  "Sidi Bel Abbès",
  "Annaba",
  "Guelma",
  "Constantine",
  "Médéa",
  "Mostaganem",
  "M'Sila",
  "Mascara",
  "Ouargla",
  "Oran",
  "El Bayadh",
  "Illizi",
  "Bordj Bou Arréridj",
  "Boumerdès",
  "El Tarf",
  "Tindouf",
  "Tissemsilt",
  "El Oued",
  "Khenchela",
  "Souk Ahras",
  "Tipaza",
  "Mila",
  "Aïn Defla",
  "Naâma",
  "Aïn Témouchent",
  "Ghardaïa",
  "Relizane",
];

const PRO_CARS_BRANDS = [
  "Mercedes-Benz",
  "Renault Trucks",
  "Volvo Trucks",
  "DAF",
  "MAN",
  "Scania",
  "Iveco",
  "Autre",
];

interface TransporteurDashboardProps {
  currentUser: any;
  setCurrentUser: (user: any) => void;
  lang: string;
  t: (key: string) => string;
  moyens: any[];
  saveState: (
    users?: any,
    moyens?: any,
    offres?: any,
    propositions?: any,
    factures?: any,
    devis?: any,
  ) => void;
  offres: any[];
  propositions: any[];
  factures: any[];
  devis: DevisOfficiel[];
  counters: {
    offres: number;
    missions: number;
    factures: number;
    ldv: number;
    devis: number;
  };
  incrementCounter: (
    key: "offres" | "missions" | "factures" | "ldv" | "devis",
  ) => void;
  users: any[];
  initiateBid: (offre: any) => void;
  triggerSystemLog: (
    msg: string,
    type: "success" | "info" | "warning" | "danger",
  ) => void;
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
  onNotifyDO,
}: TransporteurDashboardProps) {
  // Sub tab tracking
  const [subTab, setSubTab] = useState<
    | "flotte"
    | "offres"
    | "devis"
    | "missions"
    | "finances"
    | "profil"
    | "chauffeurs"
  >("flotte");

  // Offers subtabs
  const [offresSubTab, setOffresSubTab] = useState<
    "compatibles" | "toutes" | "favoris"
  >("compatibles");
  const [offresSortBy, setOffresSortBy] = useState<
    "prix_desc" | "date" | "depart"
  >("prix_desc");

  // Missions subtabs
  const [missionsSubTab, setMissionsSubTab] = useState<
    "en_cours" | "terminees" | "annulees"
  >("en_cours");

  // Financial period
  const [financesPeriod, setFinancesPeriod] = useState<
    "mois" | "dernier" | "3mois" | "6mois" | "annee"
  >("mois");

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
  const [driverStatus, setDriverStatus] = useState<
    "Disponible" | "Indisponible" | "En route"
  >("Disponible");

  const [formMoyenType, setFormMoyenType] = useState<MoyenType>(
    MoyenType.Tautliner,
  );
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
    palettes: false,
  });
  const [formInsDate, setFormInsDate] = useState("2026-12-31");
  const [formTechDate, setFormTechDate] = useState("2026-11-30");
  const [formStatus, setFormStatus] = useState<
    "Disponible" | "Occupé" | "En maintenance"
  >("Disponible");

  // Favorites tracking
  const [favorites, setFavorites] = useState<string[]>([]);

  // Confirmation state for mission action transitions
  const [missionConfirming, setMissionConfirming] = useState<{
    id: string;
    nextStatus: string;
    label: string;
  } | null>(null);

  // Profile editable details
  const [profilePhone, setProfilePhone] = useState(
    currentUser?.telephone || "+213 555 12 34 56",
  );
  const [profileEmail, setProfileEmail] = useState(
    currentUser?.email || "ahmed.trans@netlog.dz",
  );
  const [profileAddress, setProfileAddress] = useState(
    currentUser?.adresse || "Zone Industrielle de Rouïba, Lot 4",
  );
  const [profileWilaya, setProfileWilaya] = useState(
    currentUser?.wilaya || "Alger",
  );

  // --- ÉTATS GESTION DE FACTURATION MUTLI-MISSIONS ---
  const [selectedMissionsForInvoice, setSelectedMissionsForInvoice] = useState<
    string[]
  >([]);
  const [billingClientFilter, setBillingClientFilter] = useState<string>("");

  // Chiffres du tableau de bord lus en base (factures et missions à facturer)
  const [dashInvoices, setDashInvoices] = useState<Invoice[]>([]);
  const [toBillCount, setToBillCount] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([loadMyInvoices(), loadBillableMissions()])
      .then(([inv, bill]) => {
        if (!alive) return;
        setDashInvoices(inv);
        setToBillCount(bill.filter((m) => m.prixHT != null).length);
      })
      .catch((err) => console.error("Chiffres du tableau de bord:", err));
    return () => {
      alive = false;
    };
  }, [subTab]);

  // La facturation se fait dans l'onglet Finances (factures enregistrées en base, au nom du transporteur)
  const handleCompileToInvoice = () => {
    setSubTab("finances");
  };

  // Calculations for dynamic counts
  const myCamions = moyens.filter((m) => m.transporteurId === currentUser?.id);
  const assignedProps = propositions.filter(
    (p) => p.transporteurId === currentUser?.id && p.status === "Accepté",
  );
  const assignedOffreIds = assignedProps.map((p) => p.offreId);
  const activeMissions = offres.filter(
    (o) => assignedOffreIds.includes(o.id) &&
      o.status !== OffreStatus.Valide &&
      o.status !== OffreStatus.Annule,
  );

  // Offers compatibility counts
  const myCamionsTypes = myCamions.map((c) => c.type);
  const compatibleOffres = offres.filter((o) => {
    if (o.status !== OffreStatus.Publie) return false;
    return myCamions.some(
      (m) => m.type === o.moyenExige && m.poidsUtileMax >= o.poids,
    );
  });

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter((x) => x !== id));
      triggerSystemLog("Offre retirée des favoris", "info");
    } else {
      setFavorites([...favorites, id]);
      triggerSystemLog("Offre ajoutée aux favoris ❤️", "success");
    }
  };

  const handleSaveMoyenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlate || !formWeight) {
      triggerSystemLog(
        "Veuillez remplir l'immatriculation et le poids utile max.",
        "danger",
      );
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
      disponibilite: formStatus,
    };

    if (editingId) {
      const updated = moyens.map((m) => {
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
          ...newMoyenData,
        };
        saveState(undefined, [addedMoyen, ...moyens]);
        triggerSystemLog("Nouveau camion enregistré en base ! 🎉", "success");
      } catch (err: any) {
        triggerSystemLog(
          `Échec enregistrement camion : ${err?.message ?? "erreur"}`,
          "danger",
        );
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
    setFormEquipements(
      m.equipements || {
        hayon: false,
        gps: true,
        bache: true,
        sangles: true,
        palettes: false,
      },
    );
    setFormInsDate(m.assuranceValideDate || "2026-12-31");
    setFormTechDate(m.techniqueValideDate || "2026-11-30");
    setFormStatus(m.disponibilite || "Disponible");
    setShowForm(true);
    triggerSystemLog("Chargement du formulaire pour " + m.marque, "info");
  };

  const handleCycleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = moyens.map((m) => {
      if (m.id === id) {
        const next: Record<string, "Disponible" | "Occupé" | "En maintenance"> =
          {
            Disponible: "Occupé",
            Occupé: "En maintenance",
            "En maintenance": "Disponible",
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
      const updated = moyens.filter((m) => m.id !== id);
      saveState(undefined, updated);
      triggerSystemLog("Camion supprimé", "warning");
    }
  };

  // Status progression transitions
  const handleTriggerStatusTransition = (
    offreId: string,
    nextStatus: string,
    label: string,
  ) => {
    setMissionConfirming({ id: offreId, nextStatus, label });
  };

  const executeStatusTransition = async () => {
    if (!missionConfirming) return;
    const { id, nextStatus } = missionConfirming;

    const offerIdNum = Number(id);
    if (Number.isFinite(offerIdNum)) {
      try {
        const missionId = await getMissionIdByOfferId(offerIdNum);
        if (nextStatus === OffreStatus.Charge) {
          await validateLoading(missionId);
        } else if (nextStatus === OffreStatus.Decharge) {
          await validateUnload(missionId);
        }
      } catch (err: any) {
        triggerSystemLog(
          `Échec validation mission : ${err?.message ?? "erreur"}`,
          "danger",
        );
        return;
      }
    }

    // La base (trigger) fait foi : on relit les offres au lieu de deviner le statut
    try {
      const freshOffres = await loadFreightOffers();
      saveState(undefined, undefined, freshOffres);
    } catch (err) {
      console.error("Erreur rechargement après transition:", err);
    }
    triggerSystemLog(
      `Statut de la mission mis à jour : ${nextStatus} !`,
      "success",
    );

    if (Number.isFinite(offerIdNum)) {
      if (nextStatus === OffreStatus.Charge) {
        onNotifyDO?.(id, "chargement");
      } else if (nextStatus === OffreStatus.Decharge) {
        onNotifyDO?.(id, "livraison");
      }
    }

    setMissionConfirming(null);
  };

  const handleSaveProfile = () => {
    const updatedUser = {
      ...currentUser,
      telephone: profilePhone,
      email: profileEmail,
      adresse: profileAddress,
      wilaya: profileWilaya,
    };
    setCurrentUser(updatedUser);
    triggerSystemLog("Informations du profil enregistrées !", "success");
  };

  return (
    <div className="space-y-6">
      {/* ======================================================================
          TABLEAU DE BORD HEADER
          ====================================================================== */}
      <div
        style={{ backgroundColor: "#085041" }}
        className="bg-[#085041] text-white p-6 sm:p-8 rounded-3xl shadow-sm border border-emerald-800/20 relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 opacity-10 translate-x-12 -translate-y-6">
          <Truck className="w-64 h-64 text-emerald-100" />
        </div>

        <div className="relative z-10 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-emerald-300 font-mono tracking-widest uppercase">
                Espace Transporteur Certifié
              </p>
              <h1 className="text-2xl sm:text-3xl font-black mt-1 font-sans !text-white">
                Bonjour{" "}
                {currentUser?.prenom || currentUser?.raisonSociale || "Ahmed"}{" "}
                🚛
              </h1>
            </div>
            <div className="bg-emerald-900/40 border border-emerald-700/30 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider font-mono self-start sm:self-center">
              📅{" "}
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          4 INDICATORS CARDS
          ====================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => {
            setSubTab("flotte");
            setShowForm(false);
          }}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm border-b-4 border-b-[#1D9E75]/30 cursor-pointer hover:shadow-md hover:border-b-[#1D9E75] hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour gérer vos camions et flotte"
          id="kpi-tr-camions"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block group-hover:text-[#1D9E75] transition-colors">
              Mes camions
            </span>
            <span className="text-xl">🚛</span>
          </div>
          <span className="text-3xl font-black text-gray-900 block">
            {myCamions.length}
          </span>
          <span className="text-[10px] text-gray-400 font-medium underline group-hover:no-underline">
            Véhicules déclarés actifs →
          </span>
        </div>

        <div
          onClick={() => {
            setSubTab("offres");
            setOffresSubTab("compatibles");
          }}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm border-b-4 border-b-emerald-400/30 cursor-pointer hover:shadow-md hover:border-b-emerald-500 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour afficher les offres de fret compatibles"
          id="kpi-tr-compatibles"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block group-hover:text-emerald-600 transition-colors">
              Offres compatibles
            </span>
            <span className="text-xl">📋</span>
          </div>
          <span className="text-3xl font-black text-teal-600 block">
            {compatibleOffres.length}
          </span>
          <span className="text-[10px] text-gray-400 font-medium underline group-hover:no-underline">
            Correspondent au matériel →
          </span>
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
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block group-hover:text-blue-600 transition-colors">
              Missions en cours
            </span>
            <span className="text-xl">🔄</span>
          </div>
          <span className="text-3xl font-black text-blue-600 block">
            {activeMissions.length}
          </span>
          <span className="text-[10px] text-gray-400 font-medium underline group-hover:no-underline">
            En cours d'acheminement →
          </span>
        </div>

        <div
          onClick={() => setSubTab("finances")}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm border-b-4 border-b-amber-400/30 cursor-pointer hover:shadow-md hover:border-b-amber-500 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour afficher le suivi de trésorerie et factures"
          id="kpi-tr-expenses"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block group-hover:text-amber-600 transition-colors">
              Facturé ce mois
            </span>
            <span className="text-xl">💰</span>
          </div>
          <span className="text-3xl font-black text-amber-600 block">
            {dashInvoices.filter((i) => i.status !== "annulee" && i.date_emission.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s, i) => s + i.montant_ttc, 0).toLocaleString("fr-FR")} DA
          </span>
          <span className="text-[10px] text-emerald-600 font-mono font-bold underline group-hover:no-underline">
            À encaisser : {dashInvoices.filter((i) => i.status === "emise").reduce((s, i) => s + i.montant_ttc, 0).toLocaleString("fr-FR")} DA →
          </span>
        </div>
      </div>

      {/* ======================================================================
          ALERTES CONTEXTUELLES
          ====================================================================== */}
      <div className="space-y-2 mb-2">
        {toBillCount > 0 && (
          <div
            onClick={() => setSubTab("finances")}
            className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3 cursor-pointer"
          >
            <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600 shrink-0 font-bold text-xs">🧾</div>
            <div>
              <span className="text-xs font-extrabold text-amber-800 uppercase block tracking-wider">À facturer</span>
              <p className="text-xs text-amber-700 font-semibold">
                {toBillCount} mission(s) confirmée(s) par le donneur d'ordre en attente de facturation
              </p>
            </div>
          </div>
        )}
        {(() => {
          const late = dashInvoices.filter((i) => invoiceDisplayStatus(i).tone === "late");
          if (late.length === 0) return null;
          const total = late.reduce((s, i) => s + i.montant_ttc, 0);
          return (
            <div
              onClick={() => setSubTab("finances")}
              className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 cursor-pointer"
            >
              <div className="bg-rose-100 p-1.5 rounded-lg text-rose-600 shrink-0 font-bold text-xs">🔴</div>
              <div>
                <span className="text-xs font-extrabold text-rose-800 uppercase block tracking-wider">Paiement en retard</span>
                <p className="text-xs text-rose-700 font-semibold">
                  {late.length} facture(s) en retard de paiement ({total.toLocaleString("fr-FR")} DA TTC)
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ======================================================================
          5 ONGLETS DU TABLEAU DE BORD
          ====================================================================== */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => {
            setSubTab("flotte");
            setShowForm(false);
          }}
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
          {devis.filter(
            (d) =>
              d.transporteurId === currentUser.id &&
              d.status === "En attente signature",
          ).length > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
              {
                devis.filter(
                  (d) =>
                    d.transporteurId === currentUser.id &&
                    d.status === "En attente signature",
                ).length
              }
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
            {
              users.filter(
                (u) =>
                  u.profil === ProfileType.Chauffeur &&
                  u.transporteurParentId === currentUser.id,
              ).length
            }
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
              <h3 className="font-extrabold text-slate-900 text-sm">
                Gestion du Parc de Véhicules
              </h3>
              <p className="text-[11px] text-slate-500">
                Ajoutez, modifiez et configurez vos camions
              </p>
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
                  {editingId
                    ? "✏️ Modifier le camion"
                    : "🚛 Enregistrer un nouveau camion"}
                </span>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  Fermer [X]
                </button>
              </div>

              <form
                onSubmit={handleSaveMoyenSubmit}
                className="space-y-6 text-xs text-slate-700"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Type de véhicule *
                    </label>
                    <select
                      value={formMoyenType}
                      onChange={(e) =>
                        setFormMoyenType(e.target.value as MoyenType)
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 text-xs font-semibold"
                    >
                      {Object.values(MoyenType).map((t) => (
                        <option key={t} value={t}>
                          {translateMoyenType(t, lang)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Marque *
                    </label>
                    <select
                      value={formBrand}
                      onChange={(e) => setFormBrand(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 text-xs font-semibold"
                    >
                      {PRO_CARS_BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Modèle
                    </label>
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
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Immatriculation * (format: XXXXXX-WW)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 123456-116-16"
                      value={formPlate}
                      onChange={(e) => setFormPlate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Poids utile max (Tonnes) *
                    </label>
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
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Wilaya de stationnement *
                    </label>
                    <select
                      value={formWilaya}
                      onChange={(e) => setFormWilaya(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 text-xs font-semibold"
                    >
                      {ALGERIAN_WILAYAS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dimensions */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">
                    Dimensions Utiles du Compartiment de Charge
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        Longueur utile (m)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={formLen}
                        onChange={(e) => setFormLen(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        Largeur utile (m)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={formWidth}
                        onChange={(e) => setFormWidth(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        Hauteur utile (m)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={formHeight}
                        onChange={(e) => setFormHeight(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        Volume de charge (m³)
                      </label>
                      <div className="w-full px-2 py-1.5 border border-slate-200 rounded bg-slate-100 text-xs font-mono font-bold text-slate-600">
                        {(formLen * formWidth * formHeight).toFixed(1)} m³
                      </div>
                    </div>
                  </div>
                </div>

                {/* Equipements */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-2">
                    Équipements spéciaux / Accessoires
                  </label>
                  <div className="flex flex-wrap gap-4 bg-slate-50 p-4 rounded-xl">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.hayon}
                        onChange={(e) =>
                          setFormEquipements({
                            ...formEquipements,
                            hayon: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>Hayon élévateur</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.gps}
                        onChange={(e) =>
                          setFormEquipements({
                            ...formEquipements,
                            gps: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>GPS embarqué</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.bache}
                        onChange={(e) =>
                          setFormEquipements({
                            ...formEquipements,
                            bache: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>Bâche renforcée</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.sangles}
                        onChange={(e) =>
                          setFormEquipements({
                            ...formEquipements,
                            sangles: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>Sangles de blocage</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEquipements.palettes}
                        onChange={(e) =>
                          setFormEquipements({
                            ...formEquipements,
                            palettes: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-[#1D9E75] focus:ring-[#1D9E75]"
                      />
                      <span>Équipement palettes</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Assurance valide jusqu'au
                    </label>
                    <input
                      type="date"
                      value={formInsDate}
                      onChange={(e) => setFormInsDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Visite technique jusqu'au
                    </label>
                    <input
                      type="date"
                      value={formTechDate}
                      onChange={(e) => setFormTechDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Disponibilité immédiate
                    </label>
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
                      <div className="w-20 h-16 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-3xl shrink-0">
                        🚛
                      </div>
                      <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        ● Disponible
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-emerald-600 font-mono font-bold uppercase block">
                        Tautliner
                      </span>
                      <h4 className="text-normal font-bold text-slate-950 font-sans">
                        Mercedes-Benz Actros 1845
                      </h4>
                      <p className="text-xs text-slate-500 font-bold font-mono bg-slate-50 px-2.5 py-1 rounded inline-block">
                        Immat: 001428-120-16
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-1 pt-4 border-t border-slate-50 mt-4 text-[11px] font-medium text-slate-600">
                      <div>
                        🏋️ Poids utile :{" "}
                        <span className="font-bold text-slate-900">
                          30 Tonnes
                        </span>
                      </div>
                      <div>
                        📏 Longueur utile :{" "}
                        <span className="font-bold text-slate-900">13.6 m</span>
                      </div>
                      <div>
                        📍 Parking :{" "}
                        <span className="font-bold text-emerald-700">
                          Alger
                        </span>
                      </div>
                      <div>
                        📦 Vol:{" "}
                        <span className="font-bold text-slate-900">92 m³</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-50 mt-4 justify-end text-xs">
                    <button className="px-3 py-1.5 border border-slate-150 rounded-lg text-slate-700 hover:bg-slate-50 font-bold">
                      ✏️ Modifier
                    </button>
                    <button className="px-3 py-1.5 border border-slate-150 rounded-lg text-emerald-600 hover:bg-slate-50 font-bold">
                      🔄 Changer statut
                    </button>
                    <button className="px-3 py-1.5 border border-rose-150 text-rose-600 hover:bg-rose-50 rounded-lg font-bold">
                      Retirer
                    </button>
                  </div>
                </div>

                {/* Mock Camion 2 */}
                <div className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-lg transition-all relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-20 h-16 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-3xl shrink-0">
                        🚛
                      </div>
                      <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                        ● Occupé
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-amber-600 font-mono font-bold uppercase block">
                        Plateau
                      </span>
                      <h4 className="text-normal font-bold text-slate-950 font-sans">
                        Volvo FH16
                      </h4>
                      <p className="text-xs text-slate-500 font-bold font-mono bg-slate-50 px-2.5 py-1 rounded inline-block">
                        Immat: 072591-118-16
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-1 pt-4 border-t border-slate-50 mt-4 text-[11px] font-medium text-slate-600">
                      <div>
                        🏋️ Poids utile :{" "}
                        <span className="font-bold text-slate-900">
                          30 Tonnes
                        </span>
                      </div>
                      <div>
                        📏 Longueur utile :{" "}
                        <span className="font-bold text-slate-900">13.6 m</span>
                      </div>
                      <div>
                        📍 Parking :{" "}
                        <span className="font-bold text-emerald-700">
                          Alger
                        </span>
                      </div>
                      <div>
                        📦 Vol:{" "}
                        <span className="font-bold text-slate-900">92 m³</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-50 mt-4 justify-end text-xs">
                    <button className="px-3 py-1.5 border border-slate-150 rounded-lg text-slate-700 hover:bg-slate-50 font-bold">
                      ✏️ Modifier
                    </button>
                    <button className="px-3 py-1.5 border border-slate-150 rounded-lg text-emerald-600 hover:bg-slate-50 font-bold">
                      🔄 Changer statut
                    </button>
                    <button className="px-3 py-1.5 border border-rose-150 text-rose-600 hover:bg-rose-50 rounded-lg font-bold">
                      Retirer
                    </button>
                  </div>
                </div>
              </>
            ) : (
              myCamions.map((m: any) => {
                const statusColor =
                  m.disponibilite === "Disponible"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : m.disponibilite === "Occupé"
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : "bg-amber-100 text-amber-800 border-amber-200";

                return (
                  <div
                    key={m.id}
                    className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-lg hover:border-[#1D9E75]/20 transition-all relative overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-20 h-16 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center text-3xl shrink-0">
                          🚛
                        </div>
                        <span
                          className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full border ${statusColor}`}
                        >
                          ● {m.disponibilite || "Disponible"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-600 font-mono font-bold uppercase block">
                          {translateMoyenType(m.type, lang)}
                        </span>
                        <h4 className="text-normal font-bold text-slate-950 font-sans">
                          {m.marque} {m.modele ? `(${m.modele})` : ""}
                        </h4>
                        <p className="text-xs text-slate-400 font-bold font-mono bg-slate-50 px-2.5 py-1 rounded inline-block">
                          Immat: {m.immatriculation}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 gap-x-1 pt-4 border-t border-slate-50 mt-4 text-[11px] font-medium text-slate-600">
                        <div>
                          🏋️ Poids utile :{" "}
                          <span className="font-bold text-slate-900">
                            {m.poidsUtileMax} Tonnes
                          </span>
                        </div>
                        <div>
                          📏 Longueur utile :{" "}
                          <span className="font-bold text-slate-900">
                            {m.longueurMax || 13.6} m
                          </span>
                        </div>
                        <div>
                          📍 Parking :{" "}
                          <span className="font-bold text-emerald-700">
                            {m.wilaya || "Alger"}
                          </span>
                        </div>
                        <div>
                          📦 Vol:{" "}
                          <span className="font-bold text-slate-900">
                            {m.volume || 92} m³
                          </span>
                        </div>
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
                  offresSubTab === "compatibles"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Compatibles avec ma flotte ({compatibleOffres.length})
              </button>
              <button
                onClick={() => setOffresSubTab("toutes")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  offresSubTab === "toutes"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Toutes les offres
              </button>
              <button
                onClick={() => setOffresSubTab("favoris")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  offresSubTab === "favoris"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mes favoris ({favorites.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                Trier par:
              </span>
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
                💡{" "}
                <b className="text-[#085041]">
                  Ces offres correspondent à vos camions enregistrés (type +
                  tonnage maximum)
                </b>
                . Vos véhicules sont aptes à transporter cette marchandise en
                toute sécurité.
              </div>

              {compatibleOffres.length === 0 ? (
                <div className="bg-white border rounded-2xl p-12 text-center text-slate-400 text-xs">
                  Aucune offre compatible avec vos types de camions déclarés
                  n'est publiée actuellement. Enregistrez d'autres véhicules
                  comme des plateaux ou fardiers pour débloquer plus de frets !
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {compatibleOffres.map((offre: any) => {
                    const linkedBid = propositions.find(
                      (p) =>
                        p.offreId === offre.id &&
                        p.transporteurId === currentUser?.id,
                    );
                    const isFavorited = favorites.includes(offre.id);

                    return (
                      <div
                        key={offre.id}
                        className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-lg transition-all relative flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="badge-vert text-[10px]">
                              ✅ Compatible avec{" "}
                              {translateMoyenType(offre.moyenExige, lang)}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              #{offre.id.substring(0, 6)}
                            </span>
                          </div>

                          <div className="py-2.5 px-3 bg-slate-50 rounded-xl mb-4 border border-dashed border-slate-100 flex items-center justify-between">
                            <div className="font-extrabold text-sm text-[#085041]">
                              📍{" "}
                              {translateCity(offre.depart, lang).toUpperCase()}
                            </div>
                            <span className="text-[#1D9E75] font-black">➔</span>
                            <div className="font-extrabold text-sm text-[#085041]">
                              📍{" "}
                              {translateCity(offre.arrivee, lang).toUpperCase()}
                            </div>
                          </div>

                          <div className="text-xs text-slate-500 font-semibold space-y-1 mb-4">
                            <div>
                              📦 Marchandise :{" "}
                              <span className="text-slate-800">
                                {translateMarchandise(offre.marchandise, lang)}
                              </span>
                            </div>
                            <div>
                              🏋️ Poids requis :{" "}
                              <span className="text-slate-800 font-bold">
                                {offre.poids} Tonnes
                              </span>
                            </div>
                            <div>
                              📅 Date de chargement :{" "}
                              <span className="text-slate-800 font-mono">
                                {offre.dateChargement}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-gray-400 block">
                              Tarif Cible
                            </span>
                            <span className="font-extrabold text-slate-900 text-sm">
                              {offre.prixFixe
                                ? `${offre.prixFixe.toLocaleString()} DA`
                                : "À négocier"}
                            </span>
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => handleToggleFavorite(offre.id, e)}
                              className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-xs"
                            >
                              {isFavorited ? "❤️" : "🤍"}
                            </button>

                            {linkedBid ? (
                              <span
                                className={
                                  linkedBid.status === "Accepté"
                                    ? "bg-emerald-50 border border-emerald-300 text-[#085041] px-3.5 py-1.5 text-xs font-black rounded-lg"
                                    : linkedBid.status === "Rejeté"
                                      ? "bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-1.5 text-xs font-black rounded-lg"
                                      : "bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-1.5 text-xs font-black rounded-lg"
                                }
                              >
                                {linkedBid.status === "Accepté"
                                  ? "Acceptée ✅"
                                  : linkedBid.status === "Rejeté"
                                    ? "Refusée"
                                    : "Proposition envoyée ⏳"}
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
                  const isCompatible = myCamions.some(
                    (m) =>
                      m.type === offre.moyenExige &&
                      m.poidsUtileMax >= offre.poids,
                  );
                  const linkedBid = propositions.find(
                    (p) =>
                      p.offreId === offre.id &&
                      p.transporteurId === currentUser?.id,
                  );
                  const isFavorited = favorites.includes(offre.id);

                  return (
                    <div
                      key={offre.id}
                      className={`bg-white border rounded-3xl p-5 hover:shadow-lg transition-all flex flex-col justify-between ${
                        !isCompatible
                          ? "opacity-60 border-dashed border-slate-200"
                          : "border-slate-100"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          {isCompatible ? (
                            <span className="badge-vert text-[10px]">
                              ✅ Compatible
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-300">
                              ❌ Non compatible (tonnage/matériel)
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 font-mono">
                            #{offre.id.substring(0, 6)}
                          </span>
                        </div>

                        <div className="py-2 px-3 bg-slate-50 rounded-xl mb-4 flex items-center justify-between">
                          <div className="font-extrabold text-xs text-[#085041]">
                            📍 {translateCity(offre.depart, lang)}
                          </div>
                          <span className="text-[#1D9E75] font-black">➔</span>
                          <div className="font-extrabold text-xs text-[#085041]">
                            📍 {translateCity(offre.arrivee, lang)}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 font-semibold space-y-1 mb-4">
                          <div>
                            Matériel exigé :{" "}
                            <span className="text-slate-800">
                              {translateMoyenType(offre.moyenExige, lang)}
                            </span>
                          </div>
                          <div>
                            Poids exigé :{" "}
                            <span className="text-slate-800 font-bold">
                              {offre.poids} T
                            </span>
                          </div>
                          <div>
                            Marchandise :{" "}
                            <span className="text-slate-800">
                              {translateMarchandise(offre.marchandise, lang)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-400 block">
                            Tarif
                          </span>
                          <span className="font-extrabold text-slate-900 text-xs">
                            {offre.prixFixe
                              ? `${offre.prixFixe.toLocaleString()} DA`
                              : "À négocier"}
                          </span>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={(e) => handleToggleFavorite(offre.id, e)}
                            className="p-1 px-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                          >
                            {isFavorited ? "❤️" : "🤍"}
                          </button>

                          {linkedBid ? (
                            <span
                              className={
                                linkedBid.status === "Accepté"
                                  ? "bg-emerald-50 text-[#085041] px-3 py-1.5 text-xs font-bold rounded-lg block"
                                  : linkedBid.status === "Rejeté"
                                    ? "bg-rose-50 text-rose-700 px-3 py-1.5 text-xs font-bold rounded-lg block"
                                    : "bg-slate-100 text-slate-500 px-3 py-1.5 text-xs font-bold rounded-lg block"
                              }
                            >
                              {linkedBid.status === "Accepté"
                                ? "Acceptée ✅"
                                : linkedBid.status === "Rejeté"
                                  ? "Refusée"
                                  : "Proposé ⏳"}
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
                  Vous n'avez sauvegardé aucune offre avec "❤️" pour l'instant.
                  Parcourez la bourse ou la liste compatible pour épingler vos
                  trajets préférés.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {offres
                    .filter((o) => favorites.includes(o.id))
                    .map((offre: any) => {
                      return (
                        <div
                          key={offre.id}
                          className="bg-white border rounded-3xl p-5 hover:shadow-lg transition-all relative flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <span className="badge-vert text-[10px]">
                                ⭐ Favoris
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                #{offre.id}
                              </span>
                            </div>
                            <div className="font-bold text-sm text-slate-800 mb-2">
                              📍 {offre.depart} ➔ 📍 {offre.arrivee}
                            </div>
                            <p className="text-xs text-slate-600">
                              Marchandise: {offre.marchandise} · {offre.poids} T
                            </p>
                          </div>
                          <div className="border-t border-slate-150 pt-3 mt-4 flex items-center justify-between">
                            <span className="font-black text-slate-900 text-sm">
                              {offre.prixFixe?.toLocaleString()} DA
                            </span>
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
                <span className="text-[10px] font-black uppercase tracking-wider block text-slate-400">
                  Total missions réalisées
                </span>
                <span className="text-xl font-black">47</span>
              </div>
              <div className="border-l border-emerald-200 pl-4">
                <span className="text-[10px] font-black uppercase tracking-wider block text-slate-400">
                  Note moyenne
                </span>
                <span className="text-xl font-black text-amber-600">
                  ⭐ 4.8 / 5
                </span>
              </div>
              <div className="border-l border-emerald-200 pl-4">
                <span className="text-[10px] font-black uppercase tracking-wider block text-slate-400">
                  Pauctualité transport
                </span>
                <span className="text-xl font-black text-emerald-700">96%</span>
              </div>
            </div>

            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setMissionsSubTab("en_cours")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer ${
                  missionsSubTab === "en_cours"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                En cours ({activeMissions.length})
              </button>
              <button
                onClick={() => setMissionsSubTab("terminees")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer ${
                  missionsSubTab === "terminees"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600"
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
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Étape de
                  sécurité requise
                </div>
                <button
                  onClick={() => setMissionConfirming(null)}
                  className="text-slate-400 hover:text-slate-600 text-[11px] font-bold"
                >
                  Fermer [X]
                </button>
              </div>
              <p className="text-xs font-semibold text-amber-800">
                Êtes-vous sûr de vouloir confirmer cette action :{" "}
                <span className="underline font-bold font-mono">
                  "{missionConfirming.label}"
                </span>{" "}
                ? Cette modification sera directement transmise au Donneur
                d'Ordre.
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
              {activeMissions.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8">
                  Aucune mission en cours.
                </p>
              )}

              {/* DYNAMIC MISSIONS */}
              {activeMissions.map((offre: any) => {
                const isAttrib = offre.status === OffreStatus.Attribue;
                const isCharged = offre.status === OffreStatus.Charge;
                const isDecharged = offre.status === OffreStatus.Decharge;

                let progressWidth = "25%";
                if (isCharged) progressWidth = "50%";
                else if (isDecharged) progressWidth = "100%";

                return (
                  <div
                    key={offre.id}
                    className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 space-y-5"
                  >
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-teal-600 block">
                          Offre n° {offre.id}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 leading-normal">
                          {translateCity(offre.depart, lang)} ➔{" "}
                          {translateCity(offre.arrivee, lang)}
                        </h4>
                      </div>
                      <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase">
                        {offre.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
                      <div>
                        🏢 Donneur :{" "}
                        <span className="text-slate-900 text-xs font-bold block">
                          {offre.donneurRaisonSociale || "—"}
                        </span>
                      </div>
                      <div>
                        📦 Cargo :{" "}
                        <span className="text-slate-900 text-xs block">
                          {translateMarchandise(offre.marchandise, lang)} (
                          {offre.poids}T)
                        </span>
                      </div>
                      <div>
                        🚚 Échéance :{" "}
                        <span className="text-slate-900 block font-mono">
                          {offre.dateLivraison || "2026-06-05"}
                        </span>
                      </div>
                      <div>
                        💰 Prix convenu :{" "}
                        <span className="text-[#1D9E75] text-xs font-black block">
                          {agreedPrice(propositions, offre).toLocaleString()} DA
                        </span>
                      </div>
                    </div>

                    {/* Driver assignment */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 dark:bg-slate-800/40 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">👨‍✈️</span>
                        <div className="leading-tight">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block">
                            Chauffeur Assigné
                          </span>
                          {offre.chauffeurId ? (
                            (() => {
                              const drv = users.find(
                                (u) => u.id === offre.chauffeurId,
                              );
                              return (
                                <div className="space-y-0.5">
                                  <span className="font-extrabold text-slate-900 dark:text-slate-100 block">
                                    {drv
                                      ? `${drv.prenom} ${drv.nom}`
                                      : "Utilisateur inconnu"}
                                  </span>
                                  {drv && (
                                    <span className="text-[10px] text-slate-500 block">
                                      📍{" "}
                                      {drv.positionChauffeur ||
                                        "Non géolocalisé"}{" "}
                                      | {drv.disponibiliteChauffeur || "Dispo"}
                                    </span>
                                  )}
                                  {offre.chauffeurSignaleProbleme && (
                                    <div className="bg-rose-100 text-rose-800 p-1 rounded-md text-[9.5px] font-extrabold mt-1">
                                      ⚠️ Incident :{" "}
                                      {offre.chauffeurSignaleProbleme}
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-rose-500 font-black italic">
                              Aucun chauffeur assigné
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <select
                          value={offre.chauffeurId || ""}
                          onChange={async (e) => {
                            const selectedVal = e.target.value;
                            const offerIdNum = Number(offre.id);
                            if (!Number.isFinite(offerIdNum)) {
                              triggerSystemLog("ID offre invalide.", "danger");
                              return;
                            }
                            try {
                              const missionId = await getMissionIdByOfferId(offerIdNum);
                              await assignDriver(missionId, selectedVal || null);
                              saveState(undefined, undefined, await loadFreightOffers());
                              triggerSystemLog(
                                selectedVal
                                  ? "Chauffeur affecté avec succès à cette mission !"
                                  : "Chauffeur désaffecté de la mission.",
                                "success",
                              );
                            } catch (err: any) {
                              triggerSystemLog(err?.message ?? "Affectation impossible.", "danger");
                            }
                          }}
                          className="bg-white text-slate-800 border border-slate-250 rounded-xl text-xs px-2.5 py-1.5 font-bold focus:outline-none cursor-pointer"
                        >
                          <option value="">-- Assigner un chauffeur --</option>
                          {users
                            .filter(
                              (u) =>
                                u.profil === ProfileType.Chauffeur &&
                                u.transporteurParentId === currentUser.id,
                            )
                            .map((drv) => (
                              <option key={drv.id} value={drv.id}>
                                {drv.prenom} {drv.nom} (
                                {drv.positionChauffeur || "N/A"} -{" "}
                                {drv.disponibiliteChauffeur || "Dispo"})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Progress with linear tracker */}
                    <div className="py-4">
                      <div className="flex justify-between items-center relative gap-2 mb-1.5 font-mono text-[9px]">
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
                        <div
                          className="absolute top-1/2 left-0 h-0.5 bg-[#1D9E75] -translate-y-1/2 z-0"
                          style={{ width: progressWidth }}
                        ></div>

                        {/* Node 1 */}
                        <div className="z-10 flex flex-col items-center">
                          <span className="w-5 h-5 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-bold text-[9px] border-2 border-white shadow">
                            ✓
                          </span>
                          <span className="text-[10px] font-sans font-bold text-slate-800 mt-1">
                            Confirmée
                          </span>
                        </div>

                        {/* Node 2 */}
                        <div className="z-10 flex flex-col items-center">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] border-2 border-white shadow ${
                              isCharged || isDecharged
                                ? "bg-[#1D9E75] text-white"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {isCharged || isDecharged ? "✓" : "2"}
                          </span>
                          <span className="text-[10px] font-sans font-bold text-slate-800 mt-1">
                            Chargement
                          </span>
                        </div>

                        {/* Node 3 */}
                        <div className="z-10 flex flex-col items-center">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] border-2 border-white shadow ${
                              isDecharged
                                ? "bg-[#1D9E75] text-white"
                                : isCharged
                                  ? "bg-amber-500 text-amber-950 font-extrabold animate-bounce"
                                  : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {isDecharged ? "✓" : "3"}
                          </span>
                          <span className="text-[10px] font-sans font-bold text-slate-800 mt-1">
                            En route
                          </span>
                        </div>

                        {/* Node 4 */}
                        <div className="z-10 flex flex-col items-center">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] border-2 border-white shadow ${
                              isDecharged
                                ? "bg-[#1D9E75] text-white"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {isDecharged ? "✓" : "○"}
                          </span>
                          <span
                            className={`text-[10px] font-sans font-bold mt-1 ${
                              isDecharged ? "text-slate-800" : "text-slate-400"
                            }`}
                          >
                            Déchargé
                          </span>
                        </div>
                      </div>
                    </div>

                    {isDecharged && (
                      <p className="text-center text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl py-2">
                        ⏳ Livraison en attente de validation
                      </p>
                    )}

                    {/* Actions contextuelles */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50 select-none">
                      <LdvButton offerId={offre.id} label="📄 Lettre de voiture (LDV)" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer" />

                      {isAttrib && (
                        <button
                          onClick={() =>
                            handleTriggerStatusTransition(
                              offre.id,
                              OffreStatus.Charge,
                              "Chargement exécuté",
                            )
                          }
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all animate-bounce-slow"
                        >
                          📦 Chargement exécuté !
                        </button>
                      )}

                      {isCharged && (
                        <button
                          onClick={() =>
                            handleTriggerStatusTransition(
                              offre.id,
                              OffreStatus.Decharge,
                              "J'ai livré la marchandise",
                            )
                          }
                          className="px-4 py-2 bg-[#1D9E75] hover:bg-[#157B5B] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                        >
                          ✅ J'ai livré la marchandise
                        </button>
                      )}

                      <button
                        onClick={() =>
                          triggerSystemLog(
                            "Un incident technique est transmis en urgence opérationnelle.",
                            "warning",
                          )
                        }
                        className="px-3 py-2 border border-rose-200 hover:bg-[#FDF2F2] text-rose-600 font-bold text-xs rounded-xl cursor-pointer transition-all"
                      >
                        ⚠️ Signaler un problème
                      </button>
                      <button
                        onClick={() =>
                          triggerSystemLog("Simulation d'appel client", "info")
                        }
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
          {missionsSubTab === "terminees" && (
            <TransporteurMissionsTerminees
              triggerSystemLog={triggerSystemLog}
              onGoToBilling={() => setSubTab("finances")}
            />
          )}

                  </div>
      )}

      {/* ======================================================================
          CONTENU : ONGLET 4 - FINANCES
          ====================================================================== */}
      {subTab === "finances" && (
        <TransporteurFactures
          currentUser={currentUser}
          triggerSystemLog={triggerSystemLog}
        />
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
      {subTab === "chauffeurs" &&
        (() => {
          const driversList = users.filter(
            (u) =>
              u.profil === ProfileType.Chauffeur &&
              u.transporteurParentId === currentUser.id,
          );

          const handleAddDriverSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!driverLastName.trim() || !driverFirstName.trim() || !driverTel.trim()) {
              triggerSystemLog("Veuillez remplir tous les champs obligatoires (*).", "danger");
              return;
            }
            if (!/^\d{6}$/.test(driverPassword.trim())) {
              triggerSystemLog("Le code d'accès doit comporter exactement 6 chiffres.", "danger");
              return;
            }
            try {
              await createDriver({
                nom: driverLastName.trim(),
                prenom: driverFirstName.trim(),
                phone: driverTel.trim(),
                password: driverPassword.trim(),
                position: driverPosition.trim(),
                availability: String(driverStatus),
              });
              saveState(await loadProfiles());
              triggerSystemLog(
                `Chauffeur ${driverFirstName.trim()} ${driverLastName.trim()} créé. Il se connecte avec son numéro de téléphone et son code d'accès.`,
                "success",
              );
              setDriverFirstName("");
              setDriverLastName("");
              setDriverEmail("");
              setDriverTel("");
              setDriverPassword("");
              setDriverPosition("Alger");
              setDriverStatus("Disponible");
              setShowDriverForm(false);
            } catch (err: any) {
              triggerSystemLog(err?.message ?? "Création du chauffeur impossible.", "danger");
            }
          };

          const handleDeleteDriver = (drvId: string) => {
            // Check active assignment
            const hasActiveJob = offres.some(
              (o) =>
                o.chauffeurId === drvId &&
                o.status !== OffreStatus.Valide &&
                o.status !== OffreStatus.Decharge,
            );
            if (hasActiveJob) {
              triggerSystemLog(
                "Action interdite : ce chauffeur s'occupe actuellement d'une mission en cours de transport.",
                "danger",
              );
              return;
            }

            if (confirm("Êtes-vous sûr de vouloir retirer ce chauffeur ?")) {
              saveState(users.filter((u) => u.id !== drvId));
              triggerSystemLog("Chauffeur révoqué de votre flotte.", "success");
            }
          };

          return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                    Gestion des Chauffeurs Routiers
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Déclarez vos conducteurs, suivez leur disponibilité
                    dynamique et pilotez vos affectations de fret.
                  </p>
                </div>

                <button
                  onClick={() => setShowDriverForm(!showDriverForm)}
                  className="px-4 py-2 bg-[#1d9e75] hover:bg-[#157a5a] text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                >
                  <span>
                    {showDriverForm
                      ? "Fermer le formulaire ❌"
                      : "➕ Enregistrer un chauffeur"}
                  </span>
                </button>
              </div>

              {/* FORM CARD */}
              {showDriverForm && (
                <form
                  onSubmit={handleAddDriverSubmit}
                  className="bg-white dark:bg-slate-950 border border-emerald-100 dark:border-slate-800 p-6 rounded-[2.5rem] space-y-4 shadow-sm max-w-2xl mx-auto anime-fade-in text-xs font-semibold"
                >
                  <div className="border-b pb-2 mb-2">
                    <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider text-emerald-850">
                      Fiche d'inscription d'un nouveau conducteur
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Le chauffeur se connecte avec son numéro de téléphone et un code d'accès à 6 chiffres.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 block">
                        Nom *
                      </label>
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
                      <label className="text-[10px] uppercase text-slate-500 block">
                        Prénom *
                      </label>
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
                      <label className="text-[10px] uppercase text-slate-500 block">
                        Téléphone Portable *
                      </label>
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
                      <label className="text-[10px] uppercase text-slate-500 block">Identifiant de connexion</label>
                      <p className="px-3 py-2 text-xs text-slate-500">Le numéro de téléphone du chauffeur</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 block">
                        Code d'accès (6 chiffres) *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        required
                        value={driverPassword}
                        onChange={(e) => setDriverPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Ex: 482915"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 block">
                        Position initiale (Wilaya)
                      </label>
                      <select
                        value={driverPosition}
                        onChange={(e) => setDriverPosition(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-emerald-505 bg-white cursor-pointer"
                      >
                        {ALGERIAN_WILAYAS.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 block">
                        Disponibilité initiale
                      </label>
                      <select
                        value={driverStatus}
                        onChange={(e) => setDriverStatus(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-emerald-505 bg-white cursor-pointer"
                      >
                        <option value="Disponible">
                          🟢 Actif - Disponible
                        </option>
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
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    Aucun chauffeur enregistré
                  </h4>
                  <p className="text-xs text-slate-500 mt-2">
                    Vous n'avez pas encore déclaré de conducteurs. Utilisez le
                    bouton ci-dessus pour ajouter votre premier chauffeur.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {driversList.map((drv) => {
                    const assignedJob = offres.find(
                      (o) =>
                        o.chauffeurId === drv.id &&
                        o.status !== OffreStatus.Valide,
                    );
                    const hasProblem =
                      assignedJob && !!assignedJob.chauffeurSignaleProbleme;

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
                                {drv.prenom.substring(0, 1).toUpperCase()}
                                {drv.nom.substring(0, 1).toUpperCase()}
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

                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                                drv.disponibiliteChauffeur === "Indisponible"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : drv.disponibiliteChauffeur === "En route"
                                    ? "bg-amber-100 text-amber-850 border border-amber-200"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {drv.disponibiliteChauffeur === "En route"
                                ? "🚚 En route"
                                : drv.disponibiliteChauffeur || "Disponible"}
                            </span>
                          </div>

                          {/* Middle metrics */}
                          <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-350">
                            <p className="flex justify-between">
                              <span>📱 Téléphone pro :</span>
                              <span className="font-mono text-slate-900 dark:text-slate-100">
                                {drv.tel}
                              </span>
                            </p>
                            <p className="flex justify-between">
                              <span>📧 Email de connexion :</span>
                              <span className="text-slate-900 dark:text-slate-100 font-mono text-[10px]">
                                {drv.email}
                              </span>
                            </p>
                            <p className="flex justify-between">
                              <span>🔑 Clé d'accès démo :</span>
                              <span className="text-indigo-700 font-mono text-[10px]">
                                ••••••
                              </span>
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
                                  #{assignedJob.id.substring(0, 6)} -{" "}
                                  {translateCity(assignedJob.depart, lang)} ➔{" "}
                                  {translateCity(assignedJob.arrivee, lang)}
                                </p>
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-indigo-600 dark:text-indigo-400">
                                    {assignedJob.status}
                                  </span>
                                  <span className="text-slate-500">
                                    (
                                    {translateMarchandise(
                                      assignedJob.marchandise,
                                      lang,
                                    )}
                                    )
                                  </span>
                                </div>

                                {/* ALERTE INCIDENT */}
                                {assignedJob.chauffeurSignaleProbleme && (
                                  <div className="bg-rose-100 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 p-2 rounded-xl text-[10px] font-extrabold flex items-start gap-1.5 border border-rose-250 mt-2 leading-relaxed">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                                    <span>
                                      🚨 Incident signalé :{" "}
                                      {assignedJob.chauffeurSignaleProbleme}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11.5px] text-slate-450 italic font-semibold">
                                Aucune mission active déclarée. En attente
                                d'attribution de fret.
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
                  <h3 className="text-lg font-black text-slate-950 font-sans">
                    Ahmed Babassi
                  </h3>
                  <span className="bg-emerald-50 text-[#085041] border border-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Vérifié NETLOG
                  </span>
                </div>
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="text-amber-500 font-bold text-xs">
                    ⭐⭐⭐⭐⭐ 4.8 / 5
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    (sur 47 avis de donneurs d'ordre)
                  </span>
                </div>
              </div>
            </div>

            {/* Split layout: modifiable (gauche) and static (droite) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 text-xs text-slate-700">
              <div className="lg:col-span-7 space-y-4">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">
                  Informations de contact modifiables
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Adresse Email
                    </label>
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
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Adresse Siège
                    </label>
                    <input
                      type="text"
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Wilaya de Siège
                    </label>
                    <select
                      value={profileWilaya}
                      onChange={(e) => setProfileWilaya(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-xs font-bold"
                    >
                      {ALGERIAN_WILAYAS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
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
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">
                  Informations d'identification (Non-modifiables)
                </span>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-0.5">
                      Raison sociale / Nom légal (RC)
                    </label>
                    <div className="bg-slate-100 border border-slate-200 text-slate-500 font-bold px-3 py-1.5 rounded-lg text-xs cursor-not-allowed">
                      EURL BABASSI TRANSPORT LOGISTIQUE
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-0.5">
                      Registre du Commerce (RC)
                    </label>
                    <div className="bg-slate-100 border border-slate-200 text-slate-500 font-mono px-3 py-1.5 rounded-lg text-xs cursor-not-allowed">
                      RC 16/00-8849201B25
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-400 italic leading-normal">
                    💡 Pour changer la raison sociale ou modifier vos
                    justificatifs fiscaux (RC/NIF), veuillez soumettre un ticket
                    via le menu centralisé d'administration.
                  </p>
                </div>
              </div>
            </div>

            {/* Public Statistics */}
            <div className="mt-8 pt-6 border-t border-slate-50 space-y-3">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">
                Statistiques publiques de l'entreprise
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  Missions réalisées :{" "}
                  <span className="text-slate-900 font-black block text-sm">
                    47
                  </span>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  Années sur NETLOG :{" "}
                  <span className="text-slate-900 font-black block text-sm">
                    2 ans
                  </span>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  Wilayas couvertes :{" "}
                  <span className="text-[#1D9E75] font-black block text-sm">
                    12 wilayas
                  </span>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  Spécialités matériels :{" "}
                  <span className="text-teal-600 font-black block text-sm">
                    Tautliner, Plateau
                  </span>
                </div>
              </div>
            </div>

            {/* LAST CUSTOMER REVIEWS FEED */}
            <div className="mt-8 pt-6 border-t border-slate-50 space-y-4">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">
                Derniers avis des Donneurs d'Ordre
              </span>

              <p className="text-xs text-slate-500">Aucun avis pour le moment.</p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          FOOTER USER PREVIEW LOG
          ====================================================================== */}
      <div className="bg-slate-100 p-4 rounded-2xl border border-gray-150 text-xs flex flex-col sm:flex-row gap-2 justify-between items-center text-slate-700 font-semibold shadow-xs">
        <div>
          Connecté en tant que :{" "}
          <b>{currentUser?.raisonSociale || "Babassi Transport"}</b>
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
