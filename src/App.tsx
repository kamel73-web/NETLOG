/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { submitRegistration, type RegistrationInput } from "./lib/registration";
import { signInWithPassword, signOut, getCurrentProfile, updateProfileStatus } from "./lib/supabase";
import { loadAppData, loadProfiles, type WilayaRow } from "./lib/dataLoader";
import { createFreightOffer } from "./lib/freightOffers";
import { adaptSupabaseProfile, type SupabaseProfileRow } from "./lib/profileAdapter";
import { 
  MOCK_OFFRES, 
  MOCK_USERS, 
  MOCK_MOYENS, 
  MOCK_PROPOSITIONS, 
  MOCK_FACTURES 
} from "./mockData";
import { 
  OffreFret, 
  OffreStatus, 
  MoyenType, 
  MoyenTransport, 
  UserProfile, 
  ProfileType, 
  PropositionPrix, 
  Facture, 
  FactureStatus,
  ReglementMode,
  DevisOfficiel
} from "./types";
import TransporteurDashboard from "./components/TransporteurDashboard";
import ChauffeurDashboard from "./components/ChauffeurDashboard";
import DonneurDashboard from "./components/DonneurDashboard";
import CommercialDashboard from "./components/CommercialDashboard";
import AdminDashboard from "./components/AdminDashboard";
import LeafletMap from "./components/LeafletMap";
import { 
  Truck, 
  Search, 
  Calendar, 
  Scale, 
  FileText, 
  ChevronRight, 
  Filter, 
  Plus, 
  Trash, 
  Eye, 
  DollarSign, 
  RefreshCw, 
  Layers, 
  ShieldAlert, 
  UserCheck, 
  Clock, 
  User, 
  LogIn, 
  UserPlus,
  BookOpen,
  Warehouse,
  Users,
  CheckCircle,
  FileCheck,
  MapPin,
  X,
  SlidersHorizontal,
  Info,
  Home,
  Map,
  PlusCircle,
  FolderOpen,
  Menu,
  LogOut
} from "lucide-react";
import ContractDocument from "./components/ContractDocument";
import { translations, LangType, translateMoyenType, translateCity, translateMarchandise, translateCommentaire } from "./translations";

// wilayas était auparavant un tableau de 58 entrées codées en dur ici.
// Retiré : les wilayas sont désormais chargées depuis la table Supabase
// `wilayas` (voir lib/dataLoader.ts → loadWilayas), pour n'avoir qu'une
// seule source de vérité. Le mode hors-ligne ne concerne que l'interface
// chauffeur (volontairement minimale), donc garder cette liste dupliquée
// côté client pour tout le reste de l'app n'était pas justifié.

// filterCitySuggestions() et l'import COMMUNES (2238 lignes dans
// communesData.ts) ont été retirés : cette fonction n'était appelée
// nulle part dans toute l'application (vérifié sur l'ensemble de src/).
// C'était du poids mort pur dans le bundle JS. Si une autocomplétion de
// commune est nécessaire un jour, elle doit interroger la table
// `communes` de Supabase à la demande (filtrée par wilaya_code), pas
// recharger une copie statique de 1500+ lignes dans le bundle.
// → Fichier src/communesData.ts à supprimer du dépôt.

// Helper for dynamic password strength indicator
const getPasswordStrength = (pwd: string) => {
  if (!pwd) return { label: "", color: "bg-slate-200", text: "text-slate-400" };
  if (pwd.length < 8) return { label: "Trop court (min 8)", color: "bg-rose-500", text: "text-rose-500" };
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  if (hasLetter && hasDigit && hasSpecial && pwd.length >= 10) {
    return { label: "Fort 🔥", color: "bg-emerald-500", text: "text-emerald-500" };
  } else if (hasLetter && hasDigit) {
    return { label: "Moyen 👍", color: "bg-amber-500", text: "text-amber-500" };
  }
  return { label: "Faible ⚠️", color: "bg-rose-500", text: "text-rose-500" };
};

export default function App() {
  // --- LANG STATE ---
  const [lang, setLang] = useState<LangType>(() => {
    const stored = localStorage.getItem("netlog_lang");
    return (stored === "fr" || stored === "ar" ? stored : "fr") as LangType;
  });

  useEffect(() => {
    localStorage.setItem("netlog_lang", lang);
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  // --- SPLASH LOADING SCREEN STATE ---
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // --- TOAST NOTIFICATIONS STATE ---
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "warning" | "error" | "info" }[]>([]);
  const showToast = (message: string, type: "success" | "warning" | "error" | "info") => {
    const id = "toast-" + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };
  useEffect(() => {
    (window as any).showToast = showToast;
    return () => {
      delete (window as any).showToast;
    };
  }, []);

  // --- AUTOMATIC NUMBERING PERSISTENT COUNTERS ---
  const [counters, setCounters] = useState<{ offres: number; missions: number; factures: number; ldv: number; devis: number }>(() => {
    try {
      const saved = localStorage.getItem("netlog_counters");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.devis === undefined) parsed.devis = 12;
        return parsed;
      }
    } catch (e) {}
    const defaultCounters = { offres: 42, missions: 38, factures: 31, ldv: 31, devis: 12 };
    localStorage.setItem("netlog_counters", JSON.stringify(defaultCounters));
    return defaultCounters;
  });
  const incrementCounter = (key: "offres" | "missions" | "factures" | "ldv" | "devis") => {
    setCounters((prev) => {
      const next = { ...prev, [key]: (prev[key] || 12) + 1 };
      localStorage.setItem("netlog_counters", JSON.stringify(next));
      return next;
    });
  };

  // --- DARK MODE THEME STATE ---
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("netlog_theme") === "dark");
  useEffect(() => {
    localStorage.setItem("netlog_theme", darkMode ? "dark" : "light");
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // --- ONLINE / OFFLINE CONNECTION INDICATOR ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast(lang === "ar" ? "✅ تم استعادة الاتصال" : "✅ Connexion rétablie", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [lang]);

  // --- RECHERCHE GLOBALE STATE ---
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  // --- PROGRESSIVE WEB APP (PWA) INSTALL STATE ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pwaBannerVisible, setPwaBannerVisible] = useState(() => {
    return localStorage.getItem("netlog_pwa_banner_closed") !== "true";
  });
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  // --- LEGAL PAGES & MODALS STATE ---
  const [activeLegalModal, setActiveLegalModal] = useState<"about" | "cgu" | "privacy" | "contact" | null>(null);

  const t = (key: keyof typeof translations.fr): string => {
    return translations[lang]?.[key] || translations["fr"][key] || String(key);
  };

  const translateProfile = (p: ProfileType | string) => {
    if (p === ProfileType.DonneurOrdre || p === "Donneur d'ordre") return t("profilDonneur");
    if (p === ProfileType.Transporteur || p === "Transporteur") return t("profilTransporteur");
    if (p === ProfileType.Commissionnaire || p === "Commissionnaire") return t("profilCommissionnaire");
    if (p === ProfileType.Manutentionnaire || p === "Manutentionnaire") return t("profilManutentionnaire");
    if (p === ProfileType.Stockage || p === "Espace de stockage") return t("profilStockage");
    return String(p);
  };

  const translateStatus = (s: OffreStatus | string) => {
    if (s === OffreStatus.Publie || s === "Publié") return t("statutPublie");
    if (s === OffreStatus.Attribue || s === "Attribué") return t("statutAttribue");
    if (s === OffreStatus.Charge || s === "Chargé / En cours") return t("statutCharge");
    if (s === OffreStatus.Decharge || s === "Déchargé") return t("statutDecharge");
    if (s === OffreStatus.Valide || s === "Validé / Clôturé") return t("statutValide");
    return String(s);
  };

  // --- ÉTATS ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [moyens, setMoyens] = useState<MoyenTransport[]>([]);
  const [offres, setOffres] = useState<OffreFret[]>([]);
  const [propositions, setPropositions] = useState<PropositionPrix[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [devis, setDevis] = useState<DevisOfficiel[]>([]);

  // Synchronisation asyncharone bidirectionnelle instantanée pour le QR Code et les terminaux mobiles
  const stateRef = useRef({ users, moyens, offres, propositions, factures, devis });
  useEffect(() => {
    stateRef.current = { users, moyens, offres, propositions, factures, devis };
  }, [users, moyens, offres, propositions, factures, devis]);


  // Missions & Favorites & Notifications support
  const [missions, setMissions] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("netlog_missions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [favoritedOffres, setFavoritedOffres] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("netlog_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [notifications, setNotifications] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("netlog_notifications");
      return saved ? JSON.parse(saved) : [
        "Bienvenue sur la bourse de fret NETLOG !",
        "Veuillez finaliser la vérification de vos documents KYC."
      ];
    } catch {
      return ["Bienvenue sur la bourse de fret NETLOG !"];
    }
  });

  const [selectedDetailOffre, setSelectedDetailOffre] = useState<OffreFret | null>(null);

  // Utilisateur connecté simulé
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  // Wilayas chargées depuis Supabase (table `wilayas`) — plus de copie
  // codée en dur. Vide au tout premier rendu, peuplée par loadAppData().
  const [wilayas, setWilayas] = useState<WilayaRow[]>([]);

  // Vue courante : "accueil" | "donneur" | "transporteur" | "simulation" | "facture"
  const [currentTab, setCurrentTab] = useState<string>("accueil");

  // Subscription plans & pricing state
  const [subSelectedPlan, setSubSelectedPlan] = useState<"free" | "premium" | "gold">("premium");
  const [subSelectedDuration, setSubSelectedDuration] = useState<1 | 3 | 6 | 12>(12);
  const [activeSubTabMenu, setActiveSubTabMenu] = useState<"profiles" | "subscription" | "legals">("profiles");

  // Custom Quick Offer Publish form state
  const [pubDepart, setPubDepart] = useState("Alger");
  const [pubArrivee, setPubArrivee] = useState("Sétif");
  const [pubMoyen, setPubMoyen] = useState<MoyenType>(MoyenType.Tautliner);
  const [pubPoids, setPubPoids] = useState<number>(24);
  const [pubMarchandise, setPubMarchandise] = useState("Matériaux de Construction");
  const [pubPrix, setPubPrix] = useState<number>(85000);
  const [pubCommentaire, setPubCommentaire] = useState("");

  // Filtres Bourse accueil
  const [filterDepart, setFilterDepart] = useState("Tous");
  const [filterArrivee, setFilterArrivee] = useState("Tous");
  const [filterMoyen, setFilterMoyen] = useState("Tous");
  const [filterMarchandise, setFilterMarchandise] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "price" | "proximity">("recent");

  // Inscription & Connexion formulaires
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCGUModal, setShowCGUModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [regNom, setRegNom] = useState("");
  const [regPrenom, setRegPrenom] = useState("");
  const [regTel, setRegTel] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [regWilaya, setRegWilaya] = useState("Alger");
  const [regAdresse, setRegAdresse] = useState("");
  const [regProfil, setRegProfil] = useState<ProfileType>(ProfileType.DonneurOrdre);

  // Le flux "Connexion Google" mock a été retiré : il créait un compte
  // local (localStorage) sans passer par Supabase Auth, contournant
  // entièrement l'authentification réelle. Une vraie connexion Google
  // OAuth passera par supabase.auth.signInWithOAuth({ provider: 'google' })
  // le jour où ce sera nécessaire — pas par ce mécanisme.

  // Specific DO fields
  const [regDoTypeEntite, setRegDoTypeEntite] = useState("Entreprise");
  const [regDoRaisonSociale, setRegDoRaisonSociale] = useState("");
  const [regDoRC, setRegDoRC] = useState("");
  const [regDoNIF, setRegDoNIF] = useState("");
  const [regDoSecteur, setRegDoSecteur] = useState("BTP");
  const [regDoVolume, setRegDoVolume] = useState("5-20 camions");

  // Specific Transp fields
  const [regTransTypeEntite, setRegTransTypeEntite] = useState("Artisan transporteur");
  const [regTransRaisonSociale, setRegTransRaisonSociale] = useState("");
  const [regTransRC, setRegTransRC] = useState("");
  const [regTransAutorisation, setRegTransAutorisation] = useState("");
  const [regTransNbCamions, setRegTransNbCamions] = useState("2-5");
  const [regTransWilayaActivite, setRegTransWilayaActivite] = useState("Alger");

  // Specific Commercial fields
  const [regCommDiplome, setRegCommDiplome] = useState("Licence");
  const [regCommExperience, setRegCommExperience] = useState("Oui");
  const [regCommWilayaInterv, setRegCommWilayaInterv] = useState("Alger");

  // Commercial-specific Recruitment States
  const [recrutNom, setRecrutNom] = useState("");
  const [recrutPrenom, setRecrutPrenom] = useState("");
  const [recrutEmail, setRecrutEmail] = useState("");
  const [recrutTel, setRecrutTel] = useState("");
  const [recrutRaison, setRecrutRaison] = useState("");
  const [recrutNrc, setRecrutNrc] = useState("");
  const [recrutProfilType, setRecrutProfilType] = useState<ProfileType>(ProfileType.Transporteur);
  const [recrutWilaya, setRecrutWilaya] = useState("Oran");
  const [regCommSource, setRegCommSource] = useState("");

  // Champs spécifiques Manutentionnaire (section 30 du CDC)
  const [regManRaisonSociale, setRegManRaisonSociale] = useState("");
  const [regManRC, setRegManRC] = useState("");
  const [regManTypesEngins, setRegManTypesEngins] = useState<string[]>(["Chariot élévateur"]);
  const [regManWilayaActivite, setRegManWilayaActivite] = useState("Alger");

  // Champs spécifiques Transitaire/Commissionnaire (section 8-9 du CDC)
  const [regTCRaisonSociale, setRegTCRaisonSociale] = useState("");
  const [regTCRC, setRegTCRC] = useState("");
  const [regTCWilayaActivite, setRegTCWilayaActivite] = useState("Alger");

  // États pour gérer l'affichage de notre magnifique écran de connexion / inscription
  const [guestMode, setGuestMode] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register">("login");

  // L'accès admin secret par code a été retiré (voir plus haut).

  // CGU acknowledgment
  const [regAcceptCGU, setRegAcceptCGU] = useState(false);

  // Formulaire Demande d'offre (Donneur)
  const [formDepart, setFormDepart] = useState("Alger");
  const [formArrivee, setFormArrivee] = useState("Adrar");
  const [departSearch, setDepartSearch] = useState("");
  const [arriveeSearch, setArriveeSearch] = useState("");
  const [showDepartSuggs, setShowDepartSuggs] = useState(false);
  const [showArriveeSuggs, setShowArriveeSuggs] = useState(false);

  useEffect(() => {
    setDepartSearch(translateCity(formDepart, lang));
  }, [formDepart, lang]);

  useEffect(() => {
    setArriveeSearch(translateCity(formArrivee, lang));
  }, [formArrivee, lang]);

  const [formDepartDetails, setFormDepartDetails] = useState("");
  const [formArriveeDetails, setFormArriveeDetails] = useState("");
  const [formDateChargement, setFormDateChargement] = useState("2026-06-01");
  const [formDateLivraison, setFormDateLivraison] = useState("2026-06-04");
  const [formPoids, setFormPoids] = useState(20);
  const [formLongueur, setFormLongueur] = useState(13.6);
  const [formMarchandise, setFormMarchandise] = useState("Générale");
  const [formMoyen, setFormMoyen] = useState<MoyenType>(MoyenType.Tautliner);
  const [formVoyages, setFormVoyages] = useState(1);
  const [formPrixFixe, setFormPrixFixe] = useState<string>("");
  const [formCommentaire, setFormCommentaire] = useState("");

  // Formulaire Moyen (Transporteur)
  const [moyenType, setMoyenType] = useState<MoyenType>(MoyenType.Tautliner);
  const [moyenMarque, setMoyenMarque] = useState("");
  const [moyenImmatriculation, setMoyenImmatriculation] = useState("");
  const [moyenPoids, setMoyenPoids] = useState(24);
  const [moyenLongueur, setMoyenLongueur] = useState(13.6);

  // New states for complete Transporteur workspace
  const [transporteurSubTab, setTransporteurSubTab] = useState<"flotte" | "offres" | "missions" | "finances" | "profil">("flotte");
  const [transOffresSubTab, setTransOffresSubTab] = useState<"compatibles" | "toutes" | "favoris">("compatibles");
  const [transMissionsSubTab, setTransMissionsSubTab] = useState<"en_cours" | "terminees" | "annulees">("en_cours");
  const [transFinancesPeriod, setTransFinancesPeriod] = useState<"mois" | "dernier" | "3mois" | "6mois" | "annee">("mois");
  const [showMoyenForm, setShowMoyenForm] = useState(false);
  const [editingMoyenId, setEditingMoyenId] = useState<string | null>(null);

  const [moyenModele, setMoyenModele] = useState("");
  const [moyenLargeur, setMoyenLargeur] = useState(2.5);
  const [moyenHauteur, setMoyenHauteur] = useState(2.7);
  const [moyenWilaya, setMoyenWilaya] = useState("Alger");
  const [moyenEquipements, setMoyenEquipements] = useState({
    hayon: false,
    gps: false,
    bache: false,
    sangles: false,
    palettes: false
  });
  const [moyenAssuranceDate, setMoyenAssuranceDate] = useState("2026-12-31");
  const [moyenTechniqueDate, setMoyenTechniqueDate] = useState("2026-12-31");
  const [moyenDispo, setMoyenDispo] = useState<"Disponible" | "Occupé" | "En maintenance">("Disponible");

  // Formulaire Soumission offre (Transporteur)
  const [selectedOffreForBid, setSelectedOffreForBid] = useState<OffreFret | null>(null);
  const [bidPrice, setBidPrice] = useState<number>(120000);
  const [bidMoyenId, setBidMoyenId] = useState("");
  const [bidCommentaire, setBidCommentaire] = useState("");
  const [bidAvailabilityDate, setBidAvailabilityDate] = useState("");
  const [certifyDocuments, setCertifyDocuments] = useState(false);
  const [compatibilityError, setCompatibilityError] = useState<string | null>(null);

  // Visualisateur de contrats
  const [activeContractDoc, setActiveContractDoc] = useState<{
    type: "DO-BDF" | "BDF-TRANS" | "LOGISTIQUE" | "LETTRE-VOITURE" | "FACTURE";
    offre: OffreFret;
    prop?: PropositionPrix;
    fac?: Facture;
  } | null>(null);

  // État de suivi d'expédition (QR Code Scan/Simulation)
  const [trackedOffreId, setTrackedOffreId] = useState<string | null>(null);
  const [trackerReserves, setTrackerReserves] = useState<string>("");
  const [trackerNoReserves, setTrackerNoReserves] = useState<boolean>(true);

  // Code de confirmation déchargement saisi
  const [verificationCodes, setVerificationCodes] = useState<{ [key: string]: string }>({});
  const [reservesInputs, setReservesInputs] = useState<{ [key: string]: string }>({});

  // Code d'erreur ou d'alerte général
  const [systemLog, setSystemLog] = useState<{ text: string; type: "success" | "danger" | "info" } | null>(null);

  // Simulated SMS/Email notification logs state
  const [simulatedNotifs, setSimulatedNotifs] = useState<any[]>(() => {
    const saved = localStorage.getItem("netlog_simulated_notifs");
    return saved ? JSON.parse(saved) : [];
  });

  // State to save simulated notifications
  const saveSimulatedNotifs = (newNotifs: any[]) => {
    setSimulatedNotifs(newNotifs);
    localStorage.setItem("netlog_simulated_notifs", JSON.stringify(newNotifs));
  };

  // State to track if the Simulated Notification phone portal modal is active
  const [notifPortalActive, setNotifPortalActive] = useState<{
    offreId: string;
    type: "chargement" | "livraison";
    notifId?: string;
  } | null>(null);

  // Buffer state for typing reserves in the portal
  const [typedReserveText, setTypedReserveText] = useState("");
  const [isNotifPanelExpanded, setIsNotifPanelExpanded] = useState(false);
  const [hasNewNotifsAlert, setHasNewNotifsAlert] = useState(false);

  // Function to trigger specialized link sms / email notification to DO
  const triggerSimulatedNotification = (offreId: string, type: "chargement" | "livraison") => {
    const offer = offres.find(o => o.id === offreId);
    if (!offer) return;

    // Retrieve the active DO
    const doUser = users.find(u => u.id === offer.donneurId) || 
                   users.find(u => u.profil === "Donneur d'ordre") || {
                     nom: "Benzekri",
                     prenom: "Sofiane",
                     raisonSociale: offer.donneurRaisonSociale || "SARL Ciment d'Algérie",
                     email: "s.benzekri@ciment-dz.com",
                     tel: "+213 550 44 88 12"
                   };

    const notifId = `NTF-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const sms = type === "chargement"
      ? `NETLOG SMS: Chargement effectué pour transport #${offer.id} (${offer.marchandise}). Déclarez vos réserves de chargement sur: https://netlog.dz/r/${offer.id}/reserve-chargement`
      : `NETLOG SMS: Livraison effectuée pour expédition #${offer.id} (${offer.marchandise}). Notez vos anomalies de déchargement sur: https://netlog.dz/r/${offer.id}/reserve-livraison`;

    const email = type === "chargement"
      ? `NETLOG LOGISTIQUE: Le transporteur de votre expédition #${offer.id} (${offer.marchandise}) a marqué le chargement comme exécuté. Vous disposez d'un accès de consignation immédiat pour mentionner vos réserves de départ afin qu'elles figurent sur la Lettre de Voiture officielle: https://netlog.dz/r/${offer.id}/reserve-chargement`
      : `NETLOG LOGISTIQUE: Livraison déclarée pour l'expédition #${offer.id} (${offer.marchandise}). Pour enregistrer des réserves contradictoires de réception ou signaler des anomalies de déchargement sur la Lettre de Voiture nationale: https://netlog.dz/r/${offer.id}/reserve-livraison`;

    const newNotif = {
      id: notifId,
      offreId: offer.id,
      type,
      destEmail: doUser.email,
      destPhone: doUser.tel || "+213 550 44 88 12",
      destName: doUser.raisonSociale || `${doUser.prenom} ${doUser.nom}`,
      smsText: sms,
      emailText: email,
      sentAt: new Date().toLocaleTimeString(),
      link: `https://netlog.dz/r/${offer.id}/${type === "chargement" ? "reserve-chargement" : "reserve-livraison"}`,
      status: "unread",
      marchandise: offer.marchandise,
      trajet: `${offer.depart} → ${offer.arrivee}`
    };

    setSimulatedNotifs(prev => {
      const updated = [newNotif, ...prev];
      localStorage.setItem("netlog_simulated_notifs", JSON.stringify(updated));
      return updated;
    });

    setHasNewNotifsAlert(true);
    triggerSystemLog(
      `Lien de réserves généré & envoyé par SMS et E-mail au Donneur d'Ordre (${doUser.raisonSociale || doUser.nom}) !`,
      "success"
    );
  };

  // --- INITIALISATION DEPUIS SUPABASE ---
  useEffect(() => {
    loadAppData().then(({ profiles, vehicles, offers, proposals, invoices, currentUser: supabaseUser, wilayas: wilayasData }) => {
      setUsers(profiles);
      setMoyens(vehicles);
      setOffres(offers);
      setPropositions(proposals);
      setFactures(invoices);
      setWilayas(wilayasData);

      // Session active : priorité à Supabase, sinon localStorage legacy
      if (supabaseUser) {
        setCurrentUser(supabaseUser);
      } else {
        const storedSession = localStorage.getItem("netlog_session");
        if (storedSession) {
          try {
            const parsed = JSON.parse(storedSession);
            const matched = profiles.find(u => u.id === parsed.id || u.email === parsed.email);
            setCurrentUser(matched ?? null);
          } catch (e) {
            console.error(e);
          }
        }
      }
    }).catch(err => {
      console.error("Erreur chargement données:", err);
    });

    // Load tab preference if any
    const storedTab = localStorage.getItem("netlog_tab");
    if (storedTab) {
      setCurrentTab(storedTab);
    }

    // Check for real QR code scan tracking parameter
    const params = new URLSearchParams(window.location.search);
    const trackParam = params.get("track");
    if (trackParam) {
      setTrackedOffreId(trackParam);
    }
  }, []);

  // Sync tab updates
  useEffect(() => {
    localStorage.setItem("netlog_tab", currentTab);
  }, [currentTab]);

  // Le listener postMessage "Google sign-in" a été retiré : il connectait
  // directement un utilisateur (localStorage) sur simple réception d'un
  // message window.postMessage, sans aucune vérification serveur — un
  // vecteur d'usurpation trivial. Une vraie connexion Google OAuth
  // passera par supabase.auth.signInWithOAuth({ provider: 'google' }),
  // dont la session est validée côté Supabase, pas par un postMessage
  // que n'importe quel script de la page (ou une extension malveillante)
  // pourrait émettre.

  // Synchronisation automatique vers localStorage et le serveur backend de partage en temps réel
  const saveState = (
    updatedUsers?: UserProfile[],
    updatedMoyens?: MoyenTransport[],
    updatedOffres?: OffreFret[],
    updatedProps?: PropositionPrix[],
    updatedFactures?: Facture[],
    updatedDevis?: DevisOfficiel[]
  ) => {
    let newUsers = users;
    let newMoyens = moyens;
    let newOffres = offres;
    let newProps = propositions;
    let newFactures = factures;
    let newDevis = devis;

    if (updatedUsers) {
      setUsers(updatedUsers);
      localStorage.setItem("netlog_users", JSON.stringify(updatedUsers));
      newUsers = updatedUsers;
    }
    if (updatedMoyens) {
      setMoyens(updatedMoyens);
      localStorage.setItem("netlog_moyens", JSON.stringify(updatedMoyens));
      newMoyens = updatedMoyens;
    }
    if (updatedOffres) {
      setOffres(updatedOffres);
      localStorage.setItem("netlog_offres", JSON.stringify(updatedOffres));
      newOffres = updatedOffres;
    }
    if (updatedProps) {
      setPropositions(updatedProps);
      localStorage.setItem("netlog_props", JSON.stringify(updatedProps));
      newProps = updatedProps;
    }
    if (updatedFactures) {
      setFactures(updatedFactures);
      localStorage.setItem("netlog_factures", JSON.stringify(updatedFactures));
      newFactures = updatedFactures;
    }
    if (updatedDevis) {
      setDevis(updatedDevis);
      localStorage.setItem("netlog_devis", JSON.stringify(updatedDevis));
      newDevis = updatedDevis;
    }


  };

  const saveMissionsState = (newMissions: any[]) => {
    setMissions(newMissions);
    localStorage.setItem("netlog_missions", JSON.stringify(newMissions));
  };

  const saveNotificationsState = (newNotifs: string[]) => {
    setNotifications(newNotifs);
    localStorage.setItem("netlog_notifications", JSON.stringify(newNotifs));
  };

  // switchUser() a été supprimée : elle permettait de se connecter à
  // N'IMPORTE QUEL compte de la plateforme (y compris Admin) sans mot
  // de passe, juste en le choisissant dans une liste. Faille critique.

  const handleLogout = async () => {
    await signOut(); // supabase.auth.signOut() — coupe la vraie session
    setCurrentUser(null);
    localStorage.removeItem("netlog_session"); // nettoyage de l'ancien mécanisme, au cas où
    setCurrentTab("accueil");
    setGuestMode(false);
    setAuthView("login");
    triggerSystemLog("Vous avez été déconnecté avec succès.", "info");
  };

  // Administrateur - Validation KYC et Actions de Suspension (Profil 4)
  const handleApproveUser = async (userId: string) => {
    if (currentUser?.profil !== ProfileType.Admin) {
      triggerSystemLog("Action réservée à l'Administrateur.", "danger");
      return;
    }

    // Écriture optimiste côté UI, mais confirmée par Supabase : si la
    // policy RLS refuse (ex. session pas vraiment admin côté serveur),
    // on annule le changement local plutôt que de laisser croire que
    // le compte a été validé alors qu'il ne l'est pas en base.
    const previous = users;
    const updated = users.map(u => (u.id === userId ? { ...u, status: "valide" as const } : u));
    setUsers(updated);

    const { error } = await updateProfileStatus(userId, "valide");
    if (error) {
      setUsers(previous); // rollback
      triggerSystemLog(`Échec de la validation : ${error}`, "danger");
      return;
    }

    localStorage.setItem("netlog_users", JSON.stringify(updated));

    // Mettre à jour l'utilisateur en cours si c'est lui-même
    if (currentUser?.id === userId) {
      setCurrentUser({ ...currentUser, status: "valide" });
    }

    triggerSystemLog("Compte d'acteur validé KYC administrativement avec succès. Email de notification transmis.", "success");
  };

  const handleSuspendUser = async (userId: string) => {
    if (currentUser?.profil !== ProfileType.Admin) {
      triggerSystemLog("Action réservée à l'Administrateur.", "danger");
      return;
    }

    const previous = users;
    const updated = users.map(u => (u.id === userId ? { ...u, status: "suspendu" as const } : u));
    setUsers(updated);

    const { error } = await updateProfileStatus(userId, "suspendu");
    if (error) {
      setUsers(previous); // rollback
      triggerSystemLog(`Échec de la suspension : ${error}`, "danger");
      return;
    }

    localStorage.setItem("netlog_users", JSON.stringify(updated));

    if (currentUser?.id === userId) {
      setCurrentUser({ ...currentUser, status: "suspendu" });
    }

    triggerSystemLog("Compte d'acteur suspendu immédiatement pour motif administratif.", "info");
  };

  // Commercial - Création de demande de retrait de commission (Profil 3)
  const [withdrawals, setWithdrawals] = useState(() => {
    const saved = localStorage.getItem("netlog_withdrawals");
    return saved ? JSON.parse(saved) : [
      { id: "wd-1", date: "2026-04-10", mont: 12000, method: "CCP (Algérie Poste)", status: "Traité" },
      { id: "wd-2", date: "2026-05-05", mont: 10800, method: "Virement BEA", status: "Traité" },
    ];
  });

  const handleAddWithdrawal = (mont: number, method: string) => {
    const newWd = {
      id: "wd-" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      mont,
      method,
      status: "En cours"
    };
    const updated = [newWd, ...withdrawals];
    setWithdrawals(updated);
    localStorage.setItem("netlog_withdrawals", JSON.stringify(updated));
    triggerSystemLog(`Virement de commission de ${mont.toLocaleString()} DA demandé avec succès. En cours de traitement par NETLOG.`, "success");
  };

  const triggerSystemLog = (text: string, type: "success" | "danger" | "info") => {
    setSystemLog({ text, type });
    const toastType = type === "danger" ? "error" : type;
    showToast(text, toastType);
    setTimeout(() => {
      setSystemLog(null);
    }, 5000);
  };

  // Enregistrer ou se connecter
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      triggerSystemLog("Veuillez remplir tous les champs obligatoires (*)", "danger");
      return;
    }

    // Authentification réelle : Supabase vérifie le mot de passe côté
    // serveur (hash bcrypt), plus aucune comparaison en clair côté client.
    // ⚠️ Remplace l'ancienne logique qui retombait sur un mot de passe par
    // défaut "Test@2025" pour tout profil chargé depuis Supabase (faille
    // permettant de se connecter à n'importe quel compte réel).
    const { error: signInError } = await signInWithPassword(loginEmail.trim(), loginPassword);

    if (signInError) {
      triggerSystemLog(
        signInError.includes("Invalid login credentials")
          ? "Email ou mot de passe incorrect."
          : signInError,
        "danger"
      );
      return;
    }

    const profileRow = await getCurrentProfile();
    if (!profileRow) {
      triggerSystemLog("Connecté, mais impossible de charger votre profil. Réessayez.", "danger");
      return;
    }
    const user = adaptSupabaseProfile(profileRow as SupabaseProfileRow);

    // Check account status
    const uStatus = user.status || "valide";
    if (uStatus === "en_attente") {
      triggerSystemLog("Votre compte est en cours de validation. Merci de patienter.", "danger");
      await signOut();
      return;
    }
    if (uStatus === "suspendu") {
      triggerSystemLog("Votre compte a été suspendu. Contactez NETLOG.", "danger");
      await signOut();
      return;
    }

    // Login successful
    setCurrentUser(user);
    setShowLoginModal(false);
    setLoginEmail("");
    setLoginPassword("");

    // ⚠️ loadAppData() (donc `users`) a été chargé au montage de la page,
    // AVANT toute authentification — à ce moment-là, RLS ne renvoyait
    // rien (session anonyme). Sans ce rafraîchissement, un Admin qui se
    // connecte en session fraîche (ex. navigation privée) voit une liste
    // de comptes vide malgré une connexion réussie.
    loadProfiles().then(setUsers).catch((err) => {
      console.error("Erreur rafraîchissement profils après connexion:", err);
    });

    // Route to dashboard
    if (user.profil === ProfileType.DonneurOrdre) {
      setCurrentTab("donneur");
    } else if (user.profil === ProfileType.Transporteur) {
      setCurrentTab("transporteur");
    } else if (user.profil === ProfileType.Chauffeur) {
      setCurrentTab("chauffeur");
    } else if (user.profil === ProfileType.Commercial) {
      setCurrentTab("commercial");
    } else if (user.profil === ProfileType.Admin) {
      setCurrentTab("admin");
    } else {
      setCurrentTab("accueil");
    }

    triggerSystemLog(`Bienvenue de retour, ${user.prenom} !`, "success");
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regNom.trim() || !regPrenom.trim() || !regEmail.trim() || !regTel.trim() || !regAdresse.trim()) {
      triggerSystemLog("Veuillez renseigner tous les champs obligatoires (*)", "danger");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(regEmail.trim())) {
      triggerSystemLog("Adresse email invalide", "danger");
      return;
    }

    if (regPassword.length < 8) {
      triggerSystemLog("Le mot de passe doit contenir au moins 8 caractères", "danger");
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      triggerSystemLog("Les mots de passe ne correspondent pas", "danger");
      return;
    }

    const cleanedTel = regTel.replace(/\s+/g, "");
    const telRegex = /^(05|06|07|02|03|04)[0-9]{8}$/;
    if (!telRegex.test(cleanedTel)) {
      triggerSystemLog("Format de téléphone incorrect (ex: 0555123456 pour 10 chiffres)", "danger");
      return;
    }

    if (!regAcceptCGU) {
      triggerSystemLog("Vous devez accepter les conditions générales d'utilisation pour vous inscrire.", "danger");
      return;
    }

    if (regProfil === ProfileType.Admin) {
      triggerSystemLog("La création de compte administrateur n'est pas disponible par inscription publique.", "danger");
      return;
    }

    let raisonSociale = `${regNom} ${regPrenom}`;
    let nrc = "Non assujetti";
    let nif = "";

    const input: RegistrationInput = {
      nom: regNom.trim(),
      prenom: regPrenom.trim(),
      email: regEmail.trim().toLowerCase(),
      password: regPassword,
      tel: cleanedTel,
      adresse: regAdresse.trim(),
      profil: regProfil,
      wilaya: regWilaya,
    };

    if (regProfil === ProfileType.DonneurOrdre) {
      input.typeEntite = regDoTypeEntite;
      if (regDoTypeEntite !== "Particulier") {
        if (!regDoRaisonSociale.trim()) {
          triggerSystemLog("Raison sociale obligatoire pour les professionnels", "danger");
          return;
        }
        raisonSociale = regDoRaisonSociale.trim();
        nrc = regDoRC.trim() || "N/A";
        nif = regDoNIF.trim();
      }
      input.secteur = regDoSecteur;
      input.volumeFret = regDoVolume;
      input.nif = nif;
    } else if (regProfil === ProfileType.Transporteur) {
      input.typeEntite = regTransTypeEntite;
      if (regTransTypeEntite === "Entreprise de transport") {
        if (!regTransRaisonSociale.trim()) {
          triggerSystemLog("Raison sociale de l'entreprise requise", "danger");
          return;
        }
        raisonSociale = regTransRaisonSociale.trim();
      } else {
        raisonSociale = `Artisan ${regNom} ${regPrenom}`;
      }
      if (!regTransRC.trim()) {
        triggerSystemLog("Numéro d'inscription RC obligatoire pour les transporteurs", "danger");
        return;
      }
      nrc = regTransRC.trim();
      input.autorisationTransport = regTransAutorisation.trim();
      input.nbCamions = regTransNbCamions;
      input.wilayaActivite = regTransWilayaActivite;
    } else if (regProfil === ProfileType.Commercial) {
      raisonSociale = `Commercial ${regNom} ${regPrenom}`;
      input.diplome = regCommDiplome;
      input.experienceTransport = regCommExperience;
      input.wilayaIntervention = regCommWilayaInterv;
      input.sourceDecouverte = regCommSource.trim();
    } else if (regProfil === ProfileType.Manutentionnaire) {
      if (!regManRaisonSociale.trim()) {
        triggerSystemLog("Raison sociale obligatoire pour les manutentionnaires", "danger");
        return;
      }
      if (!regManRC.trim()) {
        triggerSystemLog("Numéro d'inscription RC obligatoire pour les manutentionnaires", "danger");
        return;
      }
      raisonSociale = regManRaisonSociale.trim();
      nrc = regManRC.trim();
      input.typesEngins = regManTypesEngins.join(", ");
      input.wilayaActivite = regManWilayaActivite;
    }

    input.raisonSociale = raisonSociale;
    input.nrc = nrc;

    const { profile, error } = await submitRegistration(input);

    if (error || !profile) {
      triggerSystemLog(error ?? "Erreur lors de l'inscription", "danger");
      return;
    }

    setCurrentUser(profile);
    setShowRegisterModal(false);
    setRegNom(""); setRegPrenom(""); setRegEmail(""); setRegTel("");
    setRegPassword(""); setRegPasswordConfirm(""); setRegAdresse("");
    setRegAcceptCGU(false); setRegStep(1);

    loadProfiles().then(setUsers).catch((err) => {
      console.error("Erreur rafraîchissement profils après inscription:", err);
    });

    triggerSystemLog("✅ Compte créé ! Votre inscription est en cours de validation par l'équipe NETLOG.", "success");
  };

  // --- ACTIONS DONNEUR D'ORDRE ---
  const handleCreateOffre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Code de confirmation aléatoire pour le déchargement
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();

    // freight_offers.wilaya_depart / wilaya_arrivee attendent un code
    // numérique (référence à wilayas.code) ; le formulaire local manipule
    // des noms de wilaya (ex: "Alger") — on retrouve l'entrée correspondante.
    const wilayaDepartObj = wilayas.find(w => w.fr === formDepart);
    const wilayaArriveeObj = wilayas.find(w => w.fr === formArrivee);
    if (!wilayaDepartObj || !wilayaArriveeObj) {
      triggerSystemLog("Wilaya de départ ou d'arrivée invalide.", "danger");
      return;
    }

    let insertedId: string | number = "offre-" + Date.now();
    try {
      const inserted = await createFreightOffer({
        wilayaDepart: wilayaDepartObj.code,
        wilayaArrivee: wilayaArriveeObj.code,
        pointRepereDepart: formDepartDetails || undefined,
        pointRepereArrivee: formArriveeDetails || undefined,
        description: formCommentaire || undefined,
        poidsKg: formPoids ? Number(formPoids) : undefined,
        typeMarchandise: formMarchandise || undefined,
        // prix_propose est NOT NULL côté base : 0 signifie "prix à négocier"
        // quand le donneur d'ordre n'a pas fixé de prix.
        prixPropose: formPrixFixe ? Number(formPrixFixe) : 0,
        paymentMethod: "cash",
        dateEnlevementSouhaitee: formDateChargement || undefined,
      });
      insertedId = inserted.id;
    } catch (err: any) {
      triggerSystemLog(`Échec de la publication de l'offre : ${err.message}`, "danger");
      return;
    }

    const newOffre: OffreFret = {
      id: String(insertedId),
      donneurId: currentUser.id,
      donneurRaisonSociale: currentUser.raisonSociale,
      depart: formDepart,
      arrivee: formArrivee,
      departDetails: formDepartDetails || `Wilaya de ${formDepart}`,
      arriveeDetails: formArriveeDetails || `Wilaya de ${formArrivee}`,
      dateChargement: formDateChargement,
      dateLivraison: formDateLivraison,
      poids: Number(formPoids),
      longueurExigee: Number(formLongueur),
      marchandise: formMarchandise,
      moyenExige: formMoyen,
      nombreVoyages: Number(formVoyages),
      prixFixe: formPrixFixe ? Number(formPrixFixe) : undefined,
      commentaire: formCommentaire,
      status: OffreStatus.Publie,
      codeConfirmation: randomCode,
      dateCreation: new Date().toISOString(),
    };

    const updatedOptions = [...offres, newOffre];
    saveState(undefined, undefined, updatedOptions);
    triggerSystemLog("Demande d'offre de fret publiée instantanément sur la bourse !", "success");
    
    // Reset form
    setFormDepartDetails("");
    setFormArriveeDetails("");
    setFormCommentaire("");
    setFormPrixFixe("");
  };

  // Accepter une proposition
  const handleAcceptBid = (bidId: string) => {
    const bid = propositions.find(p => p.id === bidId);
    if (!bid) return;

    const targetOffre = offres.find(o => o.id === bid.offreId);
    if (!targetOffre) return;

    // 1. Marquer l'offre comme "Attribué"
    const updatedOffres = offres.map(o => {
      if (o.id === targetOffre.id) {
        return { ...o, status: OffreStatus.Attribue };
      }
      return o;
    });

    // 2. Marquer cette proposition comme "Accepté", les autres comme "Rejeté"
    const updatedProps = propositions.map(p => {
      if (p.offreId === targetOffre.id) {
        return { ...p, status: p.id === bidId ? "Accepté" as const : "Rejeté" as const };
      }
      return p;
    });

    // 3. Générer la Facture à régler (Simulation)
    const newFacture: Facture = {
      id: "fact-" + Date.now(),
      offreId: targetOffre.id,
      donneurId: targetOffre.donneurId,
      transporteurId: bid.transporteurId,
      montant: bid.prixPropose,
      status: FactureStatus.NonFacture,
      dateEmission: new Date().toISOString().split("T")[0],
    };

    const updatedFactures = [...factures, newFacture];

    saveState(undefined, undefined, updatedOffres, updatedProps, updatedFactures);
    triggerSystemLog(`Offre attribuée à ${bid.transporteurRaisonSociale}. Contrat DO-BDF validé d'office !`, "success");
  };

  // --- ACTIONS TRANSPORTEUR / PRESTATAIRE ---
  // Ajouter un moyen de transport à son parc
  const handleAddMoyen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!moyenMarque || !moyenImmatriculation) {
      triggerSystemLog("Veuillez renseigner la marque et l'immatriculation.", "danger");
      return;
    }

    const newMoyen: MoyenTransport = {
      id: "moyen-" + Date.now(),
      transporteurId: currentUser.id,
      type: moyenType,
      marque: moyenMarque,
      immatriculation: moyenImmatriculation,
      poidsUtileMax: Number(moyenPoids),
      longueurMax: Number(moyenLongueur),
    };

    const updated = [...moyens, newMoyen];
    saveState(undefined, updated);
    triggerSystemLog(`Véhicule ${moyenMarque} ajouté avec succès à votre parc !`, "success");
    setMoyenMarque("");
    setMoyenImmatriculation("");
  };

  // Supprimer un moyen
  const handleDeleteMoyen = (id: string) => {
    const updated = moyens.filter(m => m.id !== id);
    saveState(undefined, updated);
    triggerSystemLog("Véhicule supprimé de votre flotte.", "info");
  };

  // Ouvrir formulaire de proposition pour une offre de fret
  const initiateBid = (offre: OffreFret) => {
    setSelectedOffreForBid(offre);
    // Assigner prix par défaut égal au prix fixe si existant, ou un standard
    setBidPrice(offre.prixFixe || 110000);
    setBidCommentaire("");
    setBidAvailabilityDate(offre.dateChargement || "");
    setCertifyDocuments(false);
    setCompatibilityError(null);

    // Pré-sélectionner un moyen compatible si disponible
    const compatibleMoyens = moyens.filter(m => m.transporteurId === currentUser?.id);
    if (compatibleMoyens.length > 0) {
      setBidMoyenId(compatibleMoyens[0].id);
    } else {
      setBidMoyenId("");
    }
  };

  // Soumettre proposition et faire le MULTICRITÈRE AUTOMATIQUE de compatibilité (PDF Section 3.4)
  const handlePublishBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedOffreForBid) return;

    // FLOTTE ET ASSURANCE CHECKING (REQUIRED SPECS)
    const myFlotte = moyens.filter(m => m.transporteurId === currentUser?.id);
    if (myFlotte.length === 0) {
      setCompatibilityError(
        lang === "ar"
          ? "يجب عليك أولاً تسجيل شاحنة واحدة على الأقل في مساحة الناقل الخاصة بك."
          : "Vous devez d'abord déclarer au moins un camion dans votre Espace Transporteur pour proposer un tarif."
      );
      return;
    }

    if (!bidMoyenId) {
      triggerSystemLog("Veuillez d'abord déclarer et sélectionner un moyen de transport.", "danger");
      return;
    }

    if (!certifyDocuments) {
      setCompatibilityError(
        lang === "ar"
          ? "يجب عليك تأكيد أن وثائق التأمين والنقل الخاصة بك محدثة."
          : "Veuillez certifier obligatoirement que vos documents d'assurance et de transport sont à jour."
      );
      return;
    }

    const linkedMoyen = moyens.find(m => m.id === bidMoyenId);
    if (!linkedMoyen) return;

    // --- CONTRÔLES DE COMPATIBILITÉ (SECTION 3.4 DU PDF) ---
    // Rule 1: Type de matériel doit correspondre
    if (linkedMoyen.type !== selectedOffreForBid.moyenExige) {
      setCompatibilityError(
        lang === "ar"
          ? `نوع المركبة غير متوافق: العرض يتطلب شاحنة من نوع "${translateMoyenType(selectedOffreForBid.moyenExige, lang)}"، لكنك تستخدم "${translateMoyenType(linkedMoyen.type, lang)}".`
          : `Type de véhicule incompatible: l'offre exige un "${selectedOffreForBid.moyenExige}", mais vous utilisez un "${linkedMoyen.type}".`
      );
      return;
    }

    // Rule 2: Poids utile max >= poids exigé
    if (linkedMoyen.poidsUtileMax < selectedOffreForBid.poids) {
      setCompatibilityError(
        lang === "ar"
          ? `حمولة غير كافية: الحمولة المفيدة لمركبتك (${linkedMoyen.poidsUtileMax} طن) أقل من الحمولة المطلوبة (${selectedOffreForBid.poids} طن).`
          : `Capacité de charge insuffisante: Poids utile de votre matériel (${linkedMoyen.poidsUtileMax} t) < Poids demandé (${selectedOffreForBid.poids} t).`
      );
      return;
    }

    // Rule 3: Longueur max >= Longueur exigée (si renseigné)
    if (selectedOffreForBid.longueurExigee && linkedMoyen.longueurMax < selectedOffreForBid.longueurExigee) {
      setCompatibilityError(
        lang === "ar"
          ? `الطول غير كافٍ: طول مقطورة شاحنتك (${linkedMoyen.longueurMax} متر) أقل من الطول المطلوب بـ (${selectedOffreForBid.longueurExigee} متر).`
          : `Longueur insuffisante: Longueur de votre véhicule (${linkedMoyen.longueurMax} m) < Longueur exigée (${selectedOffreForBid.longueurExigee} m).`
      );
      return;
    }

    // Rule 4: Prix ne peut pas dépasser le prix fixe s'il est imposé par le DO
    if (selectedOffreForBid.prixFixe && bidPrice > selectedOffreForBid.prixFixe) {
      setCompatibilityError(
        lang === "ar"
          ? `تجاوز السعر الأقصى: حدد صاحب الشحن سعرًا أقصى قدره ${selectedOffreForBid.prixFixe.toLocaleString()} دج. لا يمكنك تقديم سعر أعلى.`
          : `Le donneur d'ordre a fixé un prix plafond de ${selectedOffreForBid.prixFixe.toLocaleString()} DZD. Votre offre ne peut pas être supérieure.`
      );
      return;
    }

    // Si tout est ok : on crée la proposition
    const newProp: PropositionPrix = {
      id: "prop-" + Date.now(),
      offreId: selectedOffreForBid.id,
      transporteurId: currentUser.id,
      transporteurRaisonSociale: currentUser.raisonSociale,
      moyenId: linkedMoyen.id,
      prixPropose: Number(bidPrice),
      commentaire: bidCommentaire,
      status: "En attente",
    };

    const updated = [...propositions, newProp];
    saveState(undefined, undefined, undefined, updated);
    setSelectedOffreForBid(null);
    triggerSystemLog(`Votre soumission de tarif (${bidPrice.toLocaleString()} DZD) est acceptée par l'algorithme NETLOG !`, "success");
  };

  // Changer l'état de cargaison (Chargé → Déchargé)
  const handleUpdateStatus = (offreId: string, nextStatus: OffreStatus) => {
    const updated = offres.map(o => {
      if (o.id === offreId) {
        return { ...o, status: nextStatus };
      }
      return o;
    });
    saveState(undefined, undefined, updated);

    // Si l'offre passe à "Chargé", on peut simuler une alerte d'édition de lettre de voiture
    if (nextStatus === OffreStatus.Charge) {
      triggerSystemLog("La cargaison est officiellement à bord. Lettre de voiture visée !", "success");
    } else if (nextStatus === OffreStatus.Decharge) {
      triggerSystemLog("Déchargement validé au quai d'arrivée ! En attente du code de livraison.", "info");
    }
  };

  // Clôturer la livraison via le Code Unique de Confirmation (+ gestion des réserves)
  const handleConfirmDelivery = (offreId: string) => {
    const target = offres.find(o => o.id === offreId);
    if (!target) return;

    const enteredCode = verificationCodes[offreId] || "";
    if (enteredCode !== target.codeConfirmation) {
      triggerSystemLog("Code de validation erroné. Veuillez saisir les 4 chiffres corrects.", "danger");
      return;
    }

    const insertedReserves = reservesInputs[offreId] || "";

    const updated = offres.map(o => {
      if (o.id === offreId) {
        return { 
          ...o, 
          status: OffreStatus.Valide,
          reserves: insertedReserves ? insertedReserves : undefined
        };
      }
      return o;
    });

    // On passe aussi la facture liée comme "Facture transmise" automatiquement
    const updatedFactures = factures.map(f => {
      if (f.offreId === offreId) {
        return { ...f, status: FactureStatus.Transmise };
      }
      return f;
    });

    saveState(undefined, undefined, updated, undefined, updatedFactures);
    triggerSystemLog(
      insertedReserves 
        ? "Prestation clôturée avec réserves écrites enregistrées. Facture émise !" 
        : "Prestation clôturée avec succès en parfait état ! Facturation générée.", 
      "success"
    );
  };

  // Payer une facture
  const handlePayInvoice = (factureId: string, mode: ReglementMode) => {
    const updatedFactures = factures.map(f => {
      if (f.id === factureId) {
        return { 
          ...f, 
          status: FactureStatus.Reglee,
          modeReglement: mode,
          dateReglement: new Date().toISOString().split("T")[0]
        };
      }
      return f;
    });
    saveState(undefined, undefined, undefined, undefined, updatedFactures);
    triggerSystemLog(`Facture acquittée avec succès via ${mode} !`, "success");
  };

  // --- RECHERCHE ET FILTRES MULTICRITÈRES DE LA BOURSE ---
  const filteredBourseOffres = offres.filter(offre => {
    if (offre.status !== OffreStatus.Publie) return false;
    
    if (filterDepart && filterDepart !== "Tous" && !offre.depart.toLowerCase().includes(filterDepart.toLowerCase())) return false;
    if (filterArrivee && filterArrivee !== "Tous" && !offre.arrivee.toLowerCase().includes(filterArrivee.toLowerCase())) return false;
    if (filterMarchandise && !offre.marchandise.toLowerCase().includes(filterMarchandise.toLowerCase())) return false;
    if (filterMoyen !== "Tous" && offre.moyenExige !== filterMoyen) return false;
    if (filterDate && !offre.dateChargement.includes(filterDate)) return false;

    return true;
  });

  // --- REPORTING FINANCIERS ET KPI ---
  // Calculs financiers pour le donneur d'ordre
  const getDoMetrics = () => {
    const doOffres = offres.filter(o => o.donneurId === currentUser?.id);
    const linkedFactures = factures.filter(f => f.donneurId === currentUser?.id);

    const facturesRecues = linkedFactures.reduce((acc, f) => acc + f.montant, 0);
    const montantsRegles = linkedFactures.filter(f => f.status === FactureStatus.Reglee).reduce((acc, f) => acc + f.montant, 0);
    const montantsNonRegles = linkedFactures.filter(f => f.status !== FactureStatus.Reglee).reduce((acc, f) => acc + f.montant, 0);

    return {
      totalDemandes: doOffres.length,
      enCours: doOffres.filter(o => o.status !== OffreStatus.Valide).length,
      realisees: doOffres.filter(o => o.status === OffreStatus.Valide).length,
      facturesRecues,
      montantsRegles,
      montantsNonRegles
    };
  };

  // Calculs prestataires / transporteurs
  const getTransMetrics = () => {
    const transFactures = factures.filter(f => f.transporteurId === currentUser?.id);
    const transPropositions = propositions.filter(p => p.transporteurId === currentUser?.id);
    const transMoyensCount = moyens.filter(m => m.transporteurId === currentUser?.id).length;

    const caRealise = transFactures.filter(f => f.status === FactureStatus.Reglee).reduce((acc, f) => acc + f.montant, 0);
    const facturesTransmises = transFactures.filter(f => f.status === FactureStatus.Transmise).reduce((acc, f) => acc + f.montant, 0);
    const creances = transFactures.filter(f => f.status !== FactureStatus.Reglee).reduce((acc, f) => acc + f.montant, 0);

    return {
      moyensParc: transMoyensCount,
      offresTransmises: transPropositions.length,
      servicesConfirmes: offres.filter(o => o.status === OffreStatus.Attribue).length,
      caRealise,
      facturesTransmises,
      creances
    };
  };

  const getEstimatedDistance = (from: string, to: string) => {
    if (from === to) return "~50 km";
    const fLower = from.toLowerCase();
    const tLower = to.toLowerCase();
    if ((fLower === "alger" && tLower === "sétif") || (fLower === "sétif" && tLower === "alger")) return "300 km";
    if ((fLower === "oran" && tLower === "adrar") || (fLower === "adrar" && tLower === "oran")) return "1200 km";
    if ((fLower === "béjaïa" && tLower === "alger") || (fLower === "alger" && tLower === "béjaïa")) return "220 km";
    if ((fLower === "blida" && tLower === "constantine") || (fLower === "constantine" && tLower === "blida")) return "400 km";
    return "~350 km";
  };

  const renderDetailOffreScreen = (offre: OffreFret) => {
    const isOwner = currentUser?.id === offre.donneurId;
    const isTransporteur = currentUser?.profil === ProfileType.Transporteur;
    const isFavorited = favoritedOffres.includes(offre.id);

    // Filter propositions for this offer
    const linkedBids = propositions.filter(p => p.offreId === offre.id);
    const myBid = propositions.find(p => p.offreId === offre.id && p.transporteurId === currentUser?.id);

    // Calculate dynamic offer status
    let displayStatusLabel = lang === "ar" ? "قيد الانتظار" : "En attente";
    let statusClass = "bg-yellow-50 text-yellow-800 border-yellow-200";
    if (offre.status === OffreStatus.Attribue) {
      displayStatusLabel = lang === "ar" ? "مؤكدة" : "Confirmée";
      statusClass = "bg-blue-50 text-blue-800 border-blue-200";
    } else if (offre.status === OffreStatus.Charge) {
      displayStatusLabel = lang === "ar" ? "جاري الشحن" : "Chargée / En cours";
      statusClass = "bg-amber-50 text-amber-800 border-amber-200";
    } else if (offre.status === OffreStatus.Decharge || offre.status === OffreStatus.Valide) {
      displayStatusLabel = lang === "ar" ? "تم التسليم" : "Livrée";
      statusClass = "bg-emerald-50 text-emerald-950 border-emerald-300 font-extrabold";
    } else if (linkedBids.length > 0) {
      displayStatusLabel = lang === "ar" ? "عروض مرسلة" : "Propositions reçues";
      statusClass = "bg-orange-50 text-orange-850 border-orange-200";
    }

    const toggleFavorite = () => {
      let updated;
      if (isFavorited) {
        updated = favoritedOffres.filter(id => id !== offre.id);
        triggerSystemLog("Retiré de vos favoris", "info");
      } else {
        updated = [...favoritedOffres, offre.id];
        triggerSystemLog("Ajouté à vos favoris !", "success");
      }
      setFavoritedOffres(updated);
      localStorage.setItem("netlog_favorites", JSON.stringify(updated));
    };

    const handleDeleteOffer = () => {
      const updated = offres.filter(o => o.id !== offre.id);
      saveState(undefined, undefined, updated);
      triggerSystemLog("Offre annulée et retirée de la bourse", "danger");
      setSelectedDetailOffre(null);
    };

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Navigation & back button */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs">
          <button
            onClick={() => setSelectedDetailOffre(null)}
            className="flex items-center gap-1.5 text-slate-600 hover:text-[#1D9E75] font-black uppercase text-[10px] tracking-wider cursor-pointer transition-colors"
          >
            <span>⬅</span> {lang === "ar" ? "العودة إلى البورصة" : "Retour à la Bourse d'offres"}
          </button>
          
          <span className="text-slate-400 font-mono text-[11px] font-bold">
            STATUT: <strong className="uppercase text-[#1D9E75]">{offre.status}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT PANEL: OFFER INFO (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* BLOC 1 — En-tête de l'offre */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-[11px] font-black rounded-full border ${statusClass}`}>
                    🔵 {displayStatusLabel}
                  </span>
                  <span className="text-[10px] bg-slate-100 font-mono font-bold px-2 py-1 rounded text-slate-500 uppercase">
                    OFF-2025-{offre.id.toUpperCase().substring(5)}
                  </span>
                </div>
                {isTransporteur && (
                  <button
                    onClick={toggleFavorite}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full border text-[11px] font-bold cursor-pointer transition-all ${
                      isFavorited 
                        ? "bg-rose-50 text-rose-600 border-rose-200 shadow-3xs" 
                        : "bg-white text-slate-400 border-slate-200 hover:text-rose-500"
                    }`}
                  >
                    ❤️ {isFavorited ? "Enregistré" : "Favoris"}
                  </button>
                )}
              </div>

              <div>
                <h1 className="text-xl font-bold font-sans text-slate-900 tracking-tight">
                  Acheminement de {translateMarchandise(offre.marchandise, lang)} ({offre.poids} tonnes)
                </h1>
                <p className="text-[11px] text-slate-400 mt-1">
                  📅 Publié le {new Date(offre.dateCreation || "2026-05-25").toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR")} par <strong className="text-slate-700 font-bold">{offre.donneurRaisonSociale}</strong>
                </p>
              </div>
            </div>

            {/* BLOC 2 — Le trajet (visuel) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wide block">🌍 Trajet logistique</span>
              
              <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center p-5 bg-gradient-to-br from-slate-50 to-emerald-50/10 rounded-2xl border border-slate-100">
                <div className="md:col-span-4 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-[#1D9E75] tracking-widest block font-mono">📍 DEPART (WILAYA)</span>
                  <p className="font-extrabold text-sm text-slate-800">{translateCity(offre.depart, lang).toUpperCase()}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{offre.departDetails || "Dépôt d'Enlèvement central"}</p>
                </div>

                <div className="md:col-span-3 flex flex-col items-center justify-center py-2 md:py-0">
                  <span className="text-[10px] font-bold font-mono text-slate-400 bg-white px-3 py-0.5 rounded-full border border-slate-100 shadow-3xs">
                    {getEstimatedDistance(offre.depart, offre.arrivee)}
                  </span>
                  <span className="text-[#1D9E75] font-black text-lg h-6">➔➔➔</span>
                </div>

                <div className="md:col-span-4 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-rose-500 tracking-widest block font-mono">📍 ARRIVEE (WILAYA)</span>
                  <p className="font-extrabold text-sm text-slate-800">{translateCity(offre.arrivee, lang).toUpperCase()}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{offre.arriveeDetails || "Dépôt de livraison de destination"}</p>
                </div>
              </div>
            </div>

            {/* BLOC 3 — Détails de la marchandise */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wide block">📦 Descriptif & Caractéristiques</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5 text-xs text-slate-700">
                <div className="space-y-0.5 border-b pb-2 sm:border-0 sm:pb-0">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Nature fret</span>
                  <span className="font-extrabold text-slate-800">{translateMarchandise(offre.marchandise, lang)}</span>
                </div>
                <div className="space-y-0.5 border-b pb-2 sm:border-0 sm:pb-0">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Masse utile</span>
                  <span className="font-mono font-black text-[#1D9E75]">{offre.poids} tonnes</span>
                </div>
                <div className="space-y-0.5">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Camion imposé</span>
                  <span className="font-extrabold text-slate-800">{translateMoyenType(offre.moyenExige, lang)}</span>
                </div>
                <div className="space-y-0.5 pt-2">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Longueur minimale</span>
                  <span className="font-mono font-bold">{offre.longueurExigee || 12.0} mètres</span>
                </div>
                <div className="space-y-0.5 pt-2">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Rotation voyages</span>
                  <span className="font-extrabold text-slate-800">{offre.nombreVoyages} voyage{offre.nombreVoyages > 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-0.5 pt-2">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Type de transport</span>
                  <span className="font-semibold text-slate-500">Ponctuel ferme</span>
                </div>
                <div className="space-y-0.5 pt-2">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Heures d'Enlèvement</span>
                  <span className="font-bold text-slate-800 font-mono">📅 {offre.dateChargement}</span>
                </div>
                <div className="space-y-0.5 pt-2">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Date de livraison</span>
                  <span className="font-bold text-rose-600 font-mono">📅 {offre.dateLivraison}</span>
                </div>
              </div>

              {offre.commentaire && (
                <div className="mt-4 p-3 bg-slate-50/70 border border-slate-100 rounded-xl text-slate-600 text-[11px] leading-relaxed">
                  <strong className="text-slate-700 block mb-0.5">💬 Commentaire du DO :</strong>
                  {offre.commentaire}
                </div>
              )}
            </div>

            {/* BLOC 5 — Contact DO (uniquement si mission confirmée / attribuée) */}
            {(offre.status !== OffreStatus.Publie) && (
              <div className="bg-emerald-50/80 border border-emerald-200/50 p-6 rounded-3xl space-y-4">
                <span className="text-[10px] text-emerald-800 uppercase font-black tracking-wide block">📞 Informations de liaison (Contact direct)</span>
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-emerald-200/10">
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900">{offre.donneurRaisonSociale}</h4>
                    <span className="text-[10px] text-slate-400">DO de transport d'offres permanent certifié par NETLOG</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => triggerSystemLog(`Appel sortant simulé vers le donneur d'ordre (${offre.donneurRaisonSociale}) au +213(0)23102040...`, "success")}
                      className="px-3 py-1.5 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-[11px] font-bold rounded cursor-pointer"
                    >
                      📞 Appeler (+213 23 10 20)
                    </button>
                    <button 
                      type="button"
                      onClick={() => triggerSystemLog("Messagerie intégrée bientôt disponible.", "info")}
                      className="px-3 py-1.5 border border-[#1D9E75] text-[#1D9E75] hover:bg-emerald-100/10 text-[11px] font-bold rounded cursor-pointer"
                    >
                      💬 Message
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* BLOC 7 — Propositions reçues (uniquement visible par le DO propriétaire de l'offre!) */}
            {isOwner && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                <div className="border-b pb-3 flex justify-between items-center flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                      📈 Propositions des transporteurs ({linkedBids.length})
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Comparez et sélectionnez le prestataire pour lui confier cette mission immédiatement.
                    </p>
                  </div>
                </div>

                {linkedBids.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    Aucune proposition reçue pour le moment de la part de notre réseau de transporteurs.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const cheapest = [...linkedBids].sort((a,b) => a.prixPropose - b.prixPropose)[0];

                      return linkedBids.map(bid => {
                        const score = 4.8;
                        const isCheapest = bid.id === cheapest.id && linkedBids.length > 1;

                        return (
                          <div 
                            key={bid.id} 
                            className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row justify-between gap-4 ${
                              offre.status === OffreStatus.Attribue && bid.status === "Accepté"
                                ? "bg-emerald-50/50 border-emerald-300 shadow-3xs"
                                : "bg-white border-slate-100 hover:border-slate-200"
                            }`}
                          >
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-[13px] text-slate-950">
                                  {bid.transporteurRaisonSociale}
                                </h4>
                                <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                                  ⭐ {score} <span className="text-slate-400">(47 missions)</span>
                                </span>
                                {isCheapest && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                    Meilleure offre (Moins chère)
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-600 space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 font-mono">
                                <p>🚚 Véhicule assigné : <strong className="text-slate-800">{moyens.find(m => m.id === bid.moyenId)?.marque || "Camion plateau"}</strong></p>
                                {bid.commentaire && <p>💬 Note : "{bid.commentaire}"</p>}
                              </div>
                            </div>

                            <div className="flex md:flex-col items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 shrink-0">
                              <div className="text-right">
                                <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Tarif proposé</span>
                                <span className="text-base font-black text-[#1D9E75] font-mono">{bid.prixPropose.toLocaleString()} DZD</span>
                              </div>

                              <div className="flex gap-1.5">
                                {bid.status === "En attente" && offre.status === OffreStatus.Publie ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptBid(bid.id)}
                                    className="px-3 py-1.5 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-[11px] font-black rounded-lg cursor-pointer transition-colors"
                                  >
                                    Attribuer la mission
                                  </button>
                                ) : (
                                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${
                                    bid.status === "Accepté" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                                  }`}>
                                    {bid.status === "Accepté" ? "Mission attribuée" : "Rejetée"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: ACTIONS & TARIFF (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* BLOC 4 — Tarif CARD */}
            <div className="bg-[#101F1A] p-6 rounded-3xl text-white shadow-md space-y-4">
              <span className="text-[9px] text-[#1D9E75] uppercase font-black tracking-widest block font-mono">💰 BUDGET LOGISTIQUE CIBLE</span>
              
              <div className="space-y-1">
                {offre.prixFixe ? (
                  <>
                    <span className="text-2xl font-black font-mono block text-[#1D9E75]">
                      {offre.prixFixe.toLocaleString()} DZD
                    </span>
                    <p className="text-[11px] text-emerald-100/70 font-semibold">
                      Tarif contractuel requis d'office par le DO.
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-black block text-amber-500">
                      Budget Ouvert / Libre
                    </span>
                    <p className="text-[11px] text-amber-200/70 font-semibold">
                      Proposez votre meilleure tarification à de l'arbitrage direct.
                    </p>
                  </>
                )}
              </div>

              <div className="border-t border-[#1D9E75]/20 pt-3 text-[11px] text-slate-300 space-y-2">
                <p>💸 Paiement garanti par la plateforme NETLOG après confirmation asymétrique de livraison.</p>
                <p>📉 Commissions incluses : 200 DA pour le courtage de transaction.</p>
              </div>
            </div>

            {/* BLOC 6 — Boutons d'action (selon le profil connecté) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-3.5">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wide block">⚡ Actions disponibles</span>
              
              <div className="space-y-3">
                {isTransporteur && (
                  <>
                    {/* If are transporteur, check if already bidded, or if completed */}
                    {offre.status === OffreStatus.Publie ? (
                      myBid ? (
                        <div className="space-y-3 text-xs">
                          <div className="bg-emerald-50 text-emerald-800 p-3.5 rounded-xl border border-emerald-200 leading-relaxed">
                            <p className="font-extrabold">✅ Proposition transmise !</p>
                            <p className="mt-1 font-mono">Tarif proposé : <strong className="font-black">{myBid.prixPropose.toLocaleString()} DZD</strong></p>
                            <p className="text-[10px] text-slate-400 mt-1">En attente de réponse ou sélection par le donneur d'ordre.</p>
                          </div>

                          <button 
                            type="button"
                            onClick={() => {
                              const updatedBids = propositions.filter(p => p.id !== myBid.id);
                              saveState(undefined, undefined, undefined, updatedBids);
                              triggerSystemLog("Votre proposition a été retirée.", "info");
                            }}
                            className="w-full py-2.5 border border-rose-300 hover:bg-rose-50 text-rose-600 text-[11px] font-bold rounded-xl transition-all cursor-[#1D9E75]"
                          >
                            ❌ Retirer ma proposition
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={() => initiateBid(offre)}
                            className="w-full py-3 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-2"
                          >
                            ⚡ Proposer mon prix
                          </button>
                          
                          <button
                            type="button"
                            onClick={toggleFavorite}
                            className={`w-full py-2.5 border rounded-xl font-bold text-xs cursor-pointer text-center ${
                              isFavorited 
                                ? "bg-rose-50 border-rose-200 text-rose-600" 
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            💖 {isFavorited ? "Enregistré dans mes Favoris" : "Sauvegarder en Favoris"}
                          </button>
                        </div>
                      )
                    ) : (
                      // Offer assigned
                      <div className="bg-slate-50 rounded-xl p-4 border text-[11px] leading-relaxed text-slate-500">
                        <p className="font-bold text-slate-700">🔒 Statut de la Bourse suspendu</p>
                        <p className="mt-1">Cette offre est déjà attribuée ou active en cours de transport sur la plateforme.</p>
                      </div>
                    )}
                  </>
                )}

                {isOwner && (
                  <div className="space-y-3">
                    <p className="text-[11px] italic text-slate-400">Vous êtes le Donneur d'Ordre propriétaire de cette offre.</p>
                    
                    {offre.status === OffreStatus.Publie && (
                      <button
                        type="button"
                        onClick={handleDeleteOffer}
                        className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        ❌ Retirer / Annuler l'offre de la bourse
                      </button>
                    )}
                  </div>
                )}

                {!currentUser && (
                  <div className="space-y-3 text-center">
                    <p className="text-[11px] text-slate-400 font-semibold">Identifiez-vous comme transporteur routier certifié pour pouvoir chiffrer cette expédition.</p>
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className="w-full py-2.5 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      🔐 Se connecter
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1D9E75] text-white">
        <div className="flex flex-col items-center space-y-6">
          {/* Large stylized truck container */}
          <div className="w-22 h-22 bg-white/10 rounded-full flex items-center justify-center border-2 border-white/20 animate-pulse relative">
            <span className="text-4xl">🚛</span>
            <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
          </div>
          
          <div className="text-center space-y-1.5 animate-pulse">
            <h1 className="text-2xl font-black tracking-widest text-white">NETLOG</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
              {lang === "ar" ? "بورصة الشحن بالجزائر" : "Bourse de Fret Algérie"}
            </p>
          </div>

          <div className="flex flex-col items-center space-y-2 pt-2">
            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-75">
              {lang === "ar" ? "جاري تحميل المنصة..." : "Chargement de la plateforme..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-slate-950 flex flex-col text-[#1A1A2E] dark:text-slate-100 pb-[80px] transition-colors duration-300">
      
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-rose-600 text-white text-[10.5px] font-black uppercase tracking-wider text-center py-2.5 px-4 shrink-0 shadow-sm animate-pulse z-50">
          📡 {lang === "ar" ? "أنت غير متصل بالإنترنت — بعض الميزات محدودة" : "Vous êtes hors ligne — Certaines fonctions sont limitées"}
        </div>
      )}

      {/* FLOATING TOASTS NOTIFICATION PANEL */}
      <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((t) => {
          let styleObj = { backgroundColor: '#059669', color: '#ffffff', borderColor: '#047857' };
          let icon = "✅";
          if (t.type === "warning") {
            styleObj = { backgroundColor: '#d97706', color: '#ffffff', borderColor: '#b45309' };
            icon = "⚠️";
          } else if (t.type === "error") {
            styleObj = { backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' };
            icon = "❌";
          } else if (t.type === "info") {
            styleObj = { backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' };
            icon = "ℹ️";
          }

          return (
            <div 
              key={t.id} 
              style={styleObj}
              className="p-3.5 rounded-2xl shadow-lg border text-xs font-black flex items-center gap-3 animate-slide-up pointer-events-auto cursor-pointer transition-all hover:scale-102"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            >
              <span className="text-sm shrink-0" style={{ color: '#ffffff' }}>{icon}</span>
              <span className="flex-1 leading-normal" style={{ color: '#ffffff' }}>{t.message}</span>
              <button className="text-[10px] opacity-75 hover:opacity-100 font-extrabold uppercase ml-2 select-none" style={{ color: '#ffffff' }}>✕</button>
            </div>
          );
        })}
      </div>
      
      {/* 1. EN-TÊTE FIXE EN HAUT de 56px */}
      <header className="h-[56px] border-b border-[#E5E7EB] bg-white sticky top-0 z-40 shadow-xs flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Gauche: Logo Officiel */}
        <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setCurrentTab("accueil")}>
          <span className="text-lg font-black tracking-tight text-[#1D9E75] flex items-center gap-1">
            <span className="text-xl">🚛</span> NETLOG
          </span>
          <span className="text-[10px] text-[#6B7280] ml-1 pt-1.5 uppercase font-bold tracking-widest hidden xs:inline">
            Bourse de Fret
          </span>
        </div>

        {/* Droite: Actions Authentification ou Profil connecté */}
        <div className="flex items-center gap-3">
          {/* Global Search Button 🔍 */}
          <button 
            onClick={() => setGlobalSearchOpen(!globalSearchOpen)}
            className={`p-1.5 hover:bg-slate-100 rounded-full transition-colors font-bold cursor-pointer relative ${globalSearchOpen ? "text-[#1D9E75] bg-emerald-50" : "text-slate-600"}`}
            title="Recherche Globale"
            aria-label="Recherche Globale"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Selecteur de Langue minimal */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setLang("fr")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                lang === "fr" ? "bg-[#1D9E75] text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLang("ar")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                lang === "ar" ? "bg-[#1D9E75] text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              عربي
            </button>
          </div>

          {/* Le "Simulateur de Profil express" a été retiré : il permettait
              de se connecter à n'importe quel compte de la plateforme
              (y compris Admin) sans authentification. */}

          {/* Connected state indicators */}
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              {/* Cloche de notifications */}
              <div 
                className="relative cursor-pointer p-1.5 hover:bg-slate-100 rounded-full transition-colors"
                onClick={() => {
                  const label = currentUser.status === "en_attente" 
                    ? "Compte en attente de vérification KYC administrative." 
                    : `Connecté en tant que ${currentUser.prenom} - Bienvenue sur NETLOG!`;
                  triggerSystemLog(label, "info");
                }}
              >
                <span className="text-md">🔔</span>
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#D85A30] rounded-full ring-2 ring-white"></span>
              </div>
              
              {/* Dynamic Color Avatar based on role */}
              {(() => {
                let colorBg = "bg-blue-100 text-[#0C447C] font-black border border-blue-200";
                let label = "DO";
                if (currentUser.profil === ProfileType.Transporteur) {
                  colorBg = "bg-emerald-100 text-[#085041] font-black border border-emerald-200";
                  label = "TR";
                } else if (currentUser.profil === ProfileType.Chauffeur) {
                  colorBg = "bg-amber-100 text-amber-800 font-black border border-amber-200";
                  label = "CH";
                } else if (currentUser.profil === ProfileType.Commercial) {
                  colorBg = "bg-orange-100 text-[#993C1D] font-black border border-orange-200";
                  label = "BVF";
                } else if (currentUser.profil === ProfileType.Admin) {
                  colorBg = "bg-purple-100 text-[#3B1E7B] font-black border border-purple-200";
                  label = "ADM";
                }

                return (
                  <div className="flex items-center gap-2 border-l pl-2.5">
                    <button 
                      onClick={() => {
                        if (currentUser.profil === ProfileType.DonneurOrdre) {
                          setCurrentTab("donneur");
                        } else if (currentUser.profil === ProfileType.Transporteur) {
                          setCurrentTab("transporteur");
                        } else if (currentUser.profil === ProfileType.Chauffeur) {
                          setCurrentTab("chauffeur");
                        } else if (currentUser.profil === ProfileType.Commercial) {
                          setCurrentTab("commercial");
                        } else if (currentUser.profil === ProfileType.Admin) {
                          setCurrentTab("admin");
                        }
                      }}
                      className={`w-8 h-8 rounded-full ${colorBg} font-extrabold text-xs transition-shadow flex items-center justify-center cursor-pointer shadow-inner uppercase tracking-wider hover:ring-2 hover:ring-offset-2 hover:ring-[#1D9E75]`}
                      title={`Statut: ${currentUser.status || "valide"}`}
                    >
                      {currentUser.nom.substring(0,1)}{currentUser.prenom.substring(0,1)}
                    </button>
                    
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[11px] font-extrabold text-[#1A1A2E]">
                        {currentUser.prenom} {currentUser.nom.substring(0,1)}.
                      </span>
                      <span className="text-[9px] font-black uppercase text-slate-400 mt-0.5 tracking-wider flex items-center gap-1">
                        <span>{label}</span>
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                      </span>
                    </div>

                    <button 
                      onClick={handleLogout}
                      className="ml-1.5 p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                      title="Se déconnecter"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => {
                  setShowPassword(false);
                  setShowLoginModal(true);
                }}
                className="border border-[#1D9E75] text-[#1D9E75] hover:bg-[#E1F5EE] transition-all rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Connexion
              </button>
              <button 
                onClick={() => {
                  setRegStep(1);
                  setShowRegisterModal(true);
                }} 
                className="bg-[#1D9E75] text-white hover:bg-[#085041] transition-all rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm"
              >
                S'inscrire
              </button>
            </div>
          )}
        </div>
      </header>

      {/* GLOBAL LIVE GROUPED SEARCH PANEL */}
      {globalSearchOpen && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-lg p-4 transition-all duration-200 relative z-50">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[#1D9E75] font-black">🔍</span>
              <input 
                type="text"
                placeholder={lang === "ar" ? "ابحث عن عروض (مسار، بضاعة)، ناقلين (ولاية) أو مهام..." : "Rechercher des offres (trajet, marchandise), transporteurs (raison sociale, wilaya) ou missions..."}
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-850 text-slate-900 dark:text-slate-100 border-none rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-xs font-bold leading-none placeholder-slate-400"
                autoFocus
              />
              <button 
                onClick={() => {
                  setGlobalSearchQuery("");
                  setGlobalSearchOpen(false);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-xs uppercase text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                ✕ {lang === "ar" ? "إغلاق" : "Fermer"}
              </button>
            </div>

            {globalSearchQuery.trim().length > 0 && (() => {
              const query = globalSearchQuery.trim().toLowerCase();
              
              const matchedOffres = offres.filter(o => 
                o.depart.toLowerCase().includes(query) ||
                o.arrivee.toLowerCase().includes(query) ||
                o.marchandise.toLowerCase().includes(query)
              );

              const matchedTransporteurs = users.filter(usr => 
                usr.profil === ProfileType.Transporteur && (
                  usr.nom.toLowerCase().includes(query) ||
                  usr.prenom.toLowerCase().includes(query) ||
                  (usr.raisonSociale && usr.raisonSociale.toLowerCase().includes(query)) ||
                  (usr.wilaya && usr.wilaya.toLowerCase().includes(query))
                )
              );

              // Extract unique missions from MOCK data or active state
              const matchedMissions = (missions || []).filter(m => 
                (m.depart && m.depart.toLowerCase().includes(query)) ||
                (m.arrivee && m.arrivee.toLowerCase().includes(query)) ||
                (m.id && m.id.toLowerCase().includes(query))
              );

              const hasResults = matchedOffres.length > 0 || matchedTransporteurs.length > 0 || matchedMissions.length > 0;

              return (
                <div className="max-h-[350px] overflow-y-auto space-y-4 pt-2 font-sans divide-y divide-slate-100 dark:divide-slate-800">
                  {!hasResults ? (
                    <div className="text-center py-6 text-xs font-bold text-slate-400">
                      📭 Aucun résultat ne correspond à "{globalSearchQuery}"
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      {/* Section 1: Offres */}
                      {matchedOffres.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-[#1D9E75] flex items-center gap-1.5">
                            📦 OFFRES DE FRET EN DIRECT ({matchedOffres.length})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {matchedOffres.map(o => (
                              <div 
                                key={o.id}
                                onClick={() => {
                                  setSelectedDetailOffre(o);
                                  setGlobalSearchOpen(false);
                                  showToast(`Affichage détaillé de l'offre ${o.id}`, "info");
                                }}
                                className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-[#1D9E75] transition-all flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-extrabold text-slate-800 dark:text-slate-100 block">{o.depart} ➔ {o.arrivee}</span>
                                  <span className="text-[10px] text-slate-500 font-medium block">{o.marchandise} · {o.poids}T</span>
                                </div>
                                <span className="text-[10px] font-mono font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-xl">
                                  {o.prixFixe ? `${o.prixFixe.toLocaleString()} DA` : "Sur offre"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Transporteurs */}
                      {matchedTransporteurs.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-[#378ADD] flex items-center gap-1.5">
                            🚛 TRANSPORTEURS AGRÉÉS ({matchedTransporteurs.length})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {matchedTransporteurs.map(usr => (
                              <div 
                                key={usr.id} 
                                className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-extrabold text-[#1A1A2E] dark:text-white block">{usr.raisonSociale || `${usr.prenom} ${usr.nom}`}</span>
                                  <span className="text-[10px] text-slate-500 font-medium block">📍 Wilaya : {usr.wilaya || "Alger"} · {usr.tel}</span>
                                </div>
                                <span className="bg-blue-50 dark:bg-blue-950 text-blue-850 dark:text-blue-200 text-[9px] font-black px-2 py-1 rounded-full uppercase">
                                  {usr.status || "valide"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 3: Missions */}
                      {matchedMissions.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                            ⚙️ EN COURS / HISTORIQUE MISSIONS ({matchedMissions.length})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {matchedMissions.map(m => (
                              <div 
                                key={m.id}
                                className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs"
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-extrabold text-slate-800 dark:text-slate-100">{m.depart || "Alger"} ➔ {m.arrivee || "Oran"}</span>
                                  <span className="text-[10px] font-bold text-amber-600 font-mono tracking-wider">{m.id}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 flex justify-between">
                                  <span>Client: {m.donneurRaisonSociale || "NETLOG Client"}</span>
                                  <span className="capitalize">{m.moyenMarque || "Tracteur"}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SYSTEM LOG ALERTS POPUP */}
      {systemLog && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          {(() => {
            let styleObj = { backgroundColor: '#059669', color: '#ffffff', borderColor: '#047857' };
            if (systemLog.type === "danger") {
              styleObj = { backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' };
            } else if (systemLog.type === "info") {
              styleObj = { backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' };
            }
            return (
              <div 
                style={styleObj}
                className="p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-sm transition-all border"
              >
                <Info className="w-4.5 h-4.5 shrink-0" style={{ color: '#ffffff' }} />
                <span className="flex-1 leading-normal" style={{ color: '#ffffff' }}>{systemLog.text}</span>
                <button
                  onClick={() => setSystemLog(null)}
                  style={{ color: '#ffffff' }}
                  className="p-1 rounded-full cursor-pointer transition hover:bg-white/20"
                >
                  ✕
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* 2. CONTENU PRINCIPAL DE LA PAGE */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!currentUser && !guestMode ? (
          /* =========================================================================
             PORTAIL DE CONNEXION / INSCRIPTION UNIQUE DE NETLOG – BOURSE DE FRET
             ========================================================================= */
          <div className="max-w-4xl mx-auto my-2 md:my-8 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden font-sans" id="netlog-auth-portail">
            <div className="grid grid-cols-1 md:grid-cols-12" dir={lang === "ar" ? "rtl" : "ltr"}>
              
              {/* Colonne d'introduction (Masquée sur petit mobile pour préserver mobile-first épuré) */}
              <div className="md:col-span-5 bg-[#085041] p-6 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#1D9E75] opacity-20"></div>
                
                <div className="relative z-10 space-y-4">
                  <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 px-2 text-center py-1 rounded-full border border-emerald-400/20">
                    {lang === "ar" ? "بورصة الشحن الرسمية" : "Bourse de Fret Officielle"}
                  </span>
                  
                  <h2 className="text-xl md:text-2xl font-black leading-tight tracking-tight mt-2">
                    {lang === "ar" ? "NETLOG – ملتقى نقل الشحن في الجزائر" : "NETLOG – Le carrefour du transport de fret en Algérie"}
                  </h2>
                  
                  <p className="text-xs text-emerald-100 leading-relaxed font-semibold">
                    {lang === "ar"
                      ? "منصة فريدة تربط بين طالبي الشحن الصناعيين والتجار مع أكثر من 12,000 ناقل في الجزائر بكل شفافية، سرعة وبدون عمولات مخفية للوسطاء."
                      : "Une plateforme unique reliant les donneurs d'ordre industriels et commerçants avec plus de 12 000 transporteurs d'Algérie de façon transparente, rapide et sans frais d'intermédiaires."}
                  </p>
                </div>

                <div className="relative z-10 pt-8 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="text-emerald-300">✓</span>
                    <div>
                      <strong className="text-white block font-extrabold">
                        {lang === "ar" ? "إدارة مبسطة لـ KYC" : "Gestion KYC Simplifiée"}
                      </strong>
                      <span className="text-[10px] text-emerald-100 text-slate-100 font-medium">
                        {lang === "ar" ? "التسجيل عبر التحقق من السجل التجاري (RC) بشكل رسمي." : "Inscription par validation de Registre de Commerce (RC)."}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="text-emerald-300">✓</span>
                    <div>
                      <strong className="text-white block font-extrabold">
                        {lang === "ar" ? "تأمين شامل للعمليات" : "Sécurisation Totale"}
                      </strong>
                      <span className="text-[10px] text-emerald-100 text-slate-100 font-medium">
                        {lang === "ar" ? "تأكيد واستلام الشحنة برمز سري فريد OTP." : "Confirmation de décharge par code secret unique."}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="text-emerald-300">✓</span>
                    <div>
                      <strong className="text-white block font-extrabold">
                        {lang === "ar" ? "بدون عمولات مخفية" : "Zéro Commission Masquée"}
                      </strong>
                      <span className="text-[10px] text-emerald-100 text-slate-100 font-medium">
                        {lang === "ar" ? "عروض الأسعار والدفع يتم مباشرة وبشفافية بين الأطراف وبلا وسطاء." : "Les cotations se font en toute franchise et en direct."}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 pt-8 border-t border-emerald-800 flex justify-between items-center text-[10px] text-emerald-200">
                  <span>{lang === "ar" ? "الإصدار الرئيسي 2.4" : "Version Majeur 2.4"}</span>
                  <span className="font-mono">{lang === "ar" ? "تطبيق الويب متوفر" : "PWA Disponible"}</span>
                </div>
              </div>

              {/* Colonne Formulaires Dynamiques (Connexion / Inscription) */}
              <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  
                  {/* Sélecteurs d'onglets épurés à deux chemins (Connexion VS Inscription) */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-150 mb-6">
                    <button
                      onClick={() => {
                        setAuthView("login");
                        setRegStep(1);
                      }}
                      className={`flex-1 py-3 text-center text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                        authView === "login" 
                          ? "bg-white text-[#1D9E75] shadow-sm font-black" 
                          : "text-slate-400 hover:text-slate-700"
                      }`}
                    >
                      {lang === "ar" ? "تسجيل الدخول" : "Se Connecter"}
                    </button>
                    <button
                      onClick={() => {
                        setAuthView("register");
                        setRegStep(1);
                      }}
                      className={`flex-1 py-3 text-center text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                        authView === "register" 
                          ? "bg-white text-[#1D9E75] shadow-sm font-black" 
                          : "text-slate-400 hover:text-slate-700"
                      }`}
                    >
                      {lang === "ar" ? "إنشاء حساب جديد" : "Créer un Compte"}
                    </button>
                  </div>

                  {/* VUE 1 : FORMULAIRE DE CONNEXION NATIVE */}
                  {authView === "login" && (
                    <div className="space-y-4 animate-fade-in">
                      <div>
                        <h3 className="text-lg font-black text-slate-800">
                          {lang === "ar" ? "الولوج إلى مساحة NETLOG" : "Accéder à l'Espace NETLOG"}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {lang === "ar" ? "يرجى إدخال بيانات الاعتماد لإدارة نشاط الشحن البري الخاص بك" : "Indiquez vos identifiants pour administrer votre activité de fret"}
                        </p>
                      </div>

                      <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs font-semibold">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                            {lang === "ar" ? "عنوان البريد الإلكتروني للمؤسسة *" : "Adresse email professionnelle *"}
                          </label>
                          <input 
                            type="email" 
                            required
                            placeholder={lang === "ar" ? "exemple@netlog.dz أو company@batimex.dz" : "exemple@netlog.dz ou nom@batimex.dz"}
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            className="w-full px-3.5 py-3 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75] transition-all"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500">
                              {lang === "ar" ? "كلمة المرور لدخول الحساب *" : "Mot de passe d'accès *"}
                            </label>
                            <button
                              type="button"
                              onClick={() => triggerSystemLog(lang === "ar" ? "لحسابات التجربة الافتراضية، استخدم كلمة المرور 'Test@2025'" : "Pour les comptes d'essai de démo, utilisez le mot de passe 'Test@2025'", "info")}
                              className="text-[10px] text-[#1D9E75] hover:underline bg-transparent border-0 cursor-pointer p-0"
                            >
                              {lang === "ar" ? "هل تحتاج لمساعدة ؟" : "Besoin d'aide ?"}
                            </button>
                          </div>
                          
                          <div className="relative">
                            <input 
                              type={showPassword ? "text" : "password"}
                              required
                              placeholder="••••••••"
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              className="w-full px-3.5 py-3 pr-10 border border-slate-200 rounded-xl text-xs text-slate-700 font-mono transition-all focus:outline-none focus:border-[#1D9E75]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer"
                            >
                              <Eye className="w-4.5 h-4.5 shrink-0" />
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3.5 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-xl transition-all text-xs font-black uppercase tracking-wider text-center shadow-lg hover:shadow-xl cursor-pointer mt-1"
                        >
                          {lang === "ar" ? "تسجيل الدخول إلى لوحة القيادة ➔" : "Se connecter au Tableau de bord ➔"}
                        </button>

                        <div className="relative flex py-1 items-center">
                          <div className="flex-grow border-t border-slate-100"></div>
                          <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {lang === "ar" ? "أو" : "ou"}
                          </span>
                          <div className="flex-grow border-t border-slate-100"></div>
                        </div>

                      </form>

                      {/* Le panneau "Démo Express" (identifiants pré-remplis,
                          dont admin@netlog.dz) a été retiré : exposer de
                          vrais identifiants en clair dans le bundle JS
                          public est un risque, même si l'authentification
                          elle-même passe désormais par Supabase. */}

                    </div>
                  )}

                  {/* VUE 2 : FORMULAIRE D'INSCRIPTION SUR-MESURE */}
                  {authView === "register" && (
                    <div className="space-y-4 animate-fade-in">
                      
                      {/* Étape d'inscription 1 sur 2 : Sélection du Profil */}
                      {regStep === 1 && (
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-base font-black text-slate-800">
                              {lang === "ar" ? "أي نوع من الفاعلين أنت ؟" : "Quel type d'acteur êtes-vous ?"}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              {lang === "ar"
                                ? "اختر فئة النشاط التي تتوافق مع عملك لعرض نموذج التحقق والـ KYC المناسب لك."
                                : "Choisissez la catégorie d'acteur qui correspond à votre exploitation pour afficher le bon processus KYC."}
                            </p>
                          </div>

                          <div className="space-y-2">
                            {/* Option 1: Donneur d'Ordre */}
                            <div 
                              onClick={() => setRegProfil(ProfileType.DonneurOrdre)}
                              className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-3 cursor-pointer ${
                                regProfil === ProfileType.DonneurOrdre 
                                  ? "border-[#1D9E75] bg-[#E1F5EE]/40" 
                                  : "border-slate-100 bg-slate-50/60 hover:border-slate-200"
                              }`}
                            >
                              <span className="text-2xl pt-1">🏭</span>
                              <div className="flex-1">
                                <strong className="text-xs text-slate-850 block font-extrabold">
                                  {lang === "ar" ? "حساب طالب شحن (آمر صرف Fret)" : "Espace Donneur d'Ordre (DO)"}
                                </strong>
                                <span className="text-[10px] text-slate-500 font-semibold block">
                                  {lang === "ar"
                                    ? "مؤسسات، شركات مصغرة، أو تجار يقومون بنشر عروض نقل البضائع وشحن الطرقات."
                                    : "Entreprises, PME, ou commerçants publiant des offres de fret routier à expédier."}
                                </span>
                              </div>
                            </div>

                            {/* Option 2: Transporteur */}
                            <div 
                              onClick={() => setRegProfil(ProfileType.Transporteur)}
                              className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-3 cursor-pointer ${
                                regProfil === ProfileType.Transporteur 
                                  ? "border-[#1D9E75] bg-[#E1F5EE]/40" 
                                  : "border-slate-100 bg-slate-50/60 hover:border-slate-200"
                              }`}
                            >
                              <span className="text-2xl pt-1">🚛</span>
                              <div className="flex-1">
                                <strong className="text-xs text-slate-850 block font-extrabold">
                                  {lang === "ar" ? "ناقل بضائع بري / مقدم خدمات لوجستية" : "Transporteur Routier / Prestataire"}
                                </strong>
                                <span className="text-[10px] text-slate-500 font-semibold block">
                                  {lang === "ar"
                                    ? "سائقو شاحنات مستقلون، حرفيو نقل، أو مسيرو أساطيل شحن بري في مختلف الولايات."
                                    : "Camionneurs indépendants, artisans logistiques, ou gérants de flotte de transport routier."}
                                </span>
                              </div>
                            </div>

                            {/* Option 3: Commercial */}
                            <div 
                              onClick={() => setRegProfil(ProfileType.Commercial)}
                              className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-3 cursor-pointer ${
                                regProfil === ProfileType.Commercial 
                                  ? "border-[#1D9E75] bg-[#E1F5EE]/40" 
                                  : "border-slate-100 bg-slate-50/60 hover:border-slate-200"
                              }`}
                            >
                              <span className="text-2xl pt-1">💼</span>
                              <div className="flex-1">
                                <strong className="text-xs text-slate-850 block font-extrabold">
                                  {lang === "ar" ? "وكيل تجاري مستقل في BVF" : "Commercial indépendant de BVF"}
                                </strong>
                                <span className="text-[10px] text-slate-500 font-semibold block">
                                  {lang === "ar"
                                    ? "مندوب تجاري تابع لشبكة NETLOG، وسطاء معتمدون، ومستشارو توظيف مسجلون."
                                    : "Agent commercial indépendant de NETLOG, apporteurs d'affaires et recruteurs connectés."}
                                </span>
                              </div>
                            </div>

                            {/* Option 4: Manutentionnaire */}
                            <div 
                              onClick={() => setRegProfil(ProfileType.Manutentionnaire)}
                              className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-3 cursor-pointer ${
                                regProfil === ProfileType.Manutentionnaire 
                                  ? "border-[#1D9E75] bg-[#E1F5EE]/40" 
                                  : "border-slate-100 bg-slate-50/60 hover:border-slate-200"
                              }`}
                            >
                              <span className="text-2xl pt-1">🏗️</span>
                              <div className="flex-1">
                                <strong className="text-xs text-slate-850 block font-extrabold">
                                  {lang === "ar" ? "مقاول مناولة (رافعات، شاحنات رفع)" : "Manutentionnaire (Engins de levage)"}
                                </strong>
                                <span className="text-[10px] text-slate-500 font-semibold block">
                                  {lang === "ar"
                                    ? "مقدمو خدمات الرفع والمناولة: رافعات، شاحنات شوكية، جرافات، نصابات."
                                    : "Prestataires de manutention : grues, chariots élévateurs, pelles, nacelles."}
                                </span>
                              </div>
                            </div>

                            {/* Option 5: Commissionnaire */}
                            <div 
                              onClick={() => setRegProfil(ProfileType.Commissionnaire)}
                              className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-3 cursor-pointer ${
                                regProfil === ProfileType.Commissionnaire 
                                  ? "border-[#1D9E75] bg-[#E1F5EE]/40" 
                                  : "border-slate-100 bg-slate-50/60 hover:border-slate-200"
                              }`}
                            >
                              <span className="text-2xl pt-1">🗂️</span>
                              <div className="flex-1">
                                <strong className="text-xs text-slate-850 block font-extrabold">
                                  {lang === "ar" ? "وسيط / مفوض نقل (répertoire خاص)" : "Transitaire / Commissionnaire en transport"}
                                </strong>
                                <span className="text-[10px] text-slate-500 font-semibold block">
                                  {lang === "ar"
                                    ? "ينظم عمليات النقل ويدير شبكته الخاصة من الناقلين والمركبات الموثوقة."
                                    : "Organise les transports et gère son propre répertoire de transporteurs de confiance."}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setRegStep(2)}
                            className="w-full py-3 bg-[#1D9E75] hover:bg-[#085041] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md mt-2 cursor-pointer"
                          >
                            {lang === "ar" ? "متابعة التسجيل ➔" : "Continuer l'inscription ➔"}
                          </button>
                        </div>
                      )}

                      {/* Étape d'inscription 2 sur 2 : Renseignement du Formulaire de KYC */}
                      {regStep === 2 && (
                        <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs font-semibold max-h-[50vh] overflow-y-auto pr-2">
                          
                          {/* En-tête de catégorie en cours d'inscription */}
                          <div className="bg-[#E1F5EE] text-[#085041] p-3 rounded-xl flex justify-between items-center">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-emerald-800">
                                {lang === "ar" ? "أنت تسجل بصفتك:" : "Vous vous inscrivez en tant que :"}
                              </span>
                              <strong className="block text-xs uppercase font-black">
                                {regProfil === ProfileType.DonneurOrdre 
                                  ? (lang === "ar" ? "🏭 طالب شحن / آمر صرف" : "🏭 Donneur d'Ordre") 
                                  : regProfil === ProfileType.Transporteur 
                                    ? (lang === "ar" ? "🚛 ناقل بري محترف" : "🚛 Transporteur Routier") 
                                    : regProfil === ProfileType.Manutentionnaire
                                      ? (lang === "ar" ? "🏗️ مقاول مناولة" : "🏗️ Manutentionnaire")
                                      : (lang === "ar" ? "💼 وكيل تجاري" : "💼 Agent Commercial")}
                              </strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRegStep(1)}
                              className="text-[10px] underline hover:no-underline font-extrabold bg-transparent border-0 cursor-pointer"
                            >
                              {lang === "ar" ? "تغيير" : "Changer"}
                            </button>
                          </div>

                          {/* 1. Bloc des coordonnées personnelles communes */}
                          <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block border-b pb-1">
                              {lang === "ar" ? "الإحداثيات المهنية للممثل" : "Coordonnées Professionnelles"}
                            </span>
                            
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  {lang === "ar" ? "اللقب *" : "Nom de famille *"}
                                </label>
                                <input 
                                  type="text" required placeholder={lang === "ar" ? "أدخل لقبك" : "Saisir votre nom"}
                                  value={regNom} onChange={(e) => setRegNom(e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  {lang === "ar" ? "الاسم الأول *" : "Prénom *"}
                                </label>
                                <input 
                                  type="text" required placeholder={lang === "ar" ? "أدخل اسمك الأول" : "Saisir votre prénom"}
                                  value={regPrenom} onChange={(e) => setRegPrenom(e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  {lang === "ar" ? "رقم الهاتف المحمول *" : "Numéro de téléphone *"}
                                </label>
                                <input 
                                  type="tel" required placeholder="ex: 0555123456"
                                  value={regTel} onChange={(e) => setRegTel(e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  {lang === "ar" ? "البريد الإلكتروني *" : "Adresse email *"}
                                </label>
                                <input 
                                  type="email" required placeholder="ex: contact@societe.dz"
                                  value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  {lang === "ar" ? "الولاية الإدارية *" : "Wilaya d'administration *"}
                                </label>
                                <select 
                                  value={regWilaya} onChange={(e) => setRegWilaya(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                >
                                  {wilayas.map(w => (
                                    <option key={w.code} value={lang === "ar" ? w.ar : w.fr}>
                                      {lang === "ar" ? w.ar : w.fr}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  {lang === "ar" ? "العنوان الفعلي للنشاط *" : "Adresse physique *"}
                                </label>
                                <input 
                                  type="text" required placeholder={lang === "ar" ? "الشارع، المنطقة الصناعية، إلخ" : "Rue, Zone industrielle"}
                                  value={regAdresse} onChange={(e) => setRegAdresse(e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  {lang === "ar" ? "كلمة المرور *" : "Mot de passe *"}
                                </label>
                                <input 
                                  type="password" required placeholder={lang === "ar" ? "8 أحرف على الأقل" : "Au moins 8 carac."}
                                  value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                                  className="w-full px-2.5 py-1.5 pr-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  {lang === "ar" ? "تأكيد كلمة المرور *" : "Confirmer le mot de passe *"}
                                </label>
                                <input 
                                  type="password" required placeholder={lang === "ar" ? "تأكيد" : "Confirmer"}
                                  value={regPasswordConfirm} onChange={(e) => setRegPasswordConfirm(e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 2. Bloc des spécificités professionnelles selon Profil Actif */}
                          
                          {/* Cas 2A : CHAMPS SPÉCIFIQUES POUR LE DONNEUR D'ORDRE */}
                          {regProfil === ProfileType.DonneurOrdre && (
                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block border-b pb-1">
                                {lang === "ar" ? "معلومات استغلال الشحن والتعاقد" : "Informations d'exploitation d'affrètement"}
                              </span>
                              
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "نوع الهيكل التجاري *" : "Type de structure *"}
                                  </label>
                                  <select
                                    value={regDoTypeEntite} onChange={(e) => setRegDoTypeEntite(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    <option value="Entreprise">
                                      {lang === "ar" ? "شركة معتمدة (ذ.م.م، ش.ذ.م.م، ش.م)" : "Entreprise certifiée (EURL, SARL, SPA)"}
                                    </option>
                                    <option value="Artisan">
                                      {lang === "ar" ? "حرفي / موزع مستقل" : "Artisan / Distributeur"}
                                    </option>
                                    <option value="Particulier">
                                      {lang === "ar" ? "شخص طبيعي (خاص)" : "Particulier (Indépendant)"}
                                    </option>
                                  </select>
                                </div>
                                {regDoTypeEntite !== "Particulier" && (
                                  <div>
                                    <label className="block text-[10px] text-slate-500 mb-0.5">
                                      {lang === "ar" ? "الاسم التجاري للمؤسسة *" : "Raison Sociale de l'établissement *"}
                                    </label>
                                    <input 
                                      type="text" required placeholder={lang === "ar" ? "مثال: الشركة الجزائرية للباتيمكس" : "ex: SPA Batimex Algérie"}
                                      value={regDoRaisonSociale} onChange={(e) => setRegDoRaisonSociale(e.target.value)}
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                    />
                                  </div>
                                )}
                              </div>

                              {regDoTypeEntite !== "Particulier" && (
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="block text-[10px] text-slate-500 mb-0.5">
                                      {lang === "ar" ? "رقم السجل التجاري (RC) *" : "N° Registre de Commerce (RC) *"}
                                    </label>
                                    <input 
                                      type="text" placeholder="ex: 16/00-0943521B21"
                                      value={regDoRC} onChange={(e) => setRegDoRC(e.target.value)}
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-slate-500 mb-0.5">
                                      {lang === "ar" ? "الرقم التعريفي الجبائي (NIF)" : "Identifiant Fiscal (NIF)"}
                                    </label>
                                    <input 
                                      type="text" placeholder="ex: 000123567123456"
                                      value={regDoNIF} onChange={(e) => setRegDoNIF(e.target.value)}
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-mono"
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "قطاع النشاط الرئيسي" : "Secteur d'activité principal"}
                                  </label>
                                  <select
                                    value={regDoSecteur} onChange={(e) => setRegDoSecteur(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    <option value="BTP">
                                      {lang === "ar" ? "البناء، الأشغال العمومية ومواد البناء" : "BTP, Cimenterie & Matériaux de Construction"}
                                    </option>
                                    <option value="Agroalimentaire">
                                      {lang === "ar" ? "الصناعات الغذائية والمشروبات" : "Boissons & Agroalimentaire"}
                                    </option>
                                    <option value="Chimie">
                                      {lang === "ar" ? "المواد الكيميائية والبلاستيكية والمحروقات" : "Chimie, Plasturgie & Carburants"}
                                    </option>
                                    <option value="Électroménager">
                                      {lang === "ar" ? "الإلكترونيات والأجهزة الكهرومنزلية" : "Électronique & Électroménager"}
                                    </option>
                                    <option value="Import/Export">
                                      {lang === "ar" ? "الاستيراد والتصدير والحاويات" : "Import / Export & Conteneurs"}
                                    </option>
                                    <option value="Autre">
                                      {lang === "ar" ? "قطاعات صناعية أخرى" : "Autre secteur industriel"}
                                    </option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "حجم الشحن الشهري التقديري" : "Volume d'expédition estimé"}
                                  </label>
                                  <select
                                    value={regDoVolume} onChange={(e) => setRegDoVolume(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    <option value="Ponctuel">
                                      {lang === "ar" ? "أقل من 5 شاحنات في الشهر" : "Moins de 5 camions par mois"}
                                    </option>
                                    <option value="5-20 camions">
                                      {lang === "ar" ? "بين 5 و 20 شاحنة في الشهر" : "Entre 5 et 20 camions par mois"}
                                    </option>
                                    <option value="20-50 camions">
                                      {lang === "ar" ? "بين 20 و 50 شاحنة في الشهر" : "Entre 20 et 50 camions par mois"}
                                    </option>
                                    <option value="50+ camions">
                                      {lang === "ar" ? "أكثر من 50 شاحنة في الشهر" : "Plus de 50 camions (Flux cadencés)"}
                                    </option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Cas 2B : CHAMPS SPÉCIFIQUES POUR LE TRANSPORTEUR ROUTIER */}
                          {regProfil === ProfileType.Transporteur && (
                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block border-b pb-1">
                                {lang === "ar" ? "المعلومات اللوجستية لأسطول النقل" : "Spécificités logistiques de la flotte d'Algérie"}
                              </span>
                              
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "الوضع القانوني للنشاط *" : "Statut juridique d'activité *"}
                                  </label>
                                  <select
                                    value={regTransTypeEntite} onChange={(e) => setRegTransTypeEntite(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    <option value="Artisan transporteur">
                                      {lang === "ar" ? "ناقل حرفي (مستقل / سائق مستغل)" : "Artisan Transporteur (Indépendant / Chauffeur-propriétaire)"}
                                    </option>
                                    <option value="Entreprise de transport">
                                      {lang === "ar" ? "شركة نقل بري ولوجستيات (ش.ذ.م.م أو ش.م)" : "SARL ou SPA de Transport Logistique"}
                                    </option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "اسم الشركة أو اسم الاستغلال التجاري *" : "Nom d'exploitation ou Raison Sociale *"}
                                  </label>
                                  <input 
                                    type="text" required placeholder={lang === "ar" ? "مثال: ترانس الصحراء للوجستيات" : "ex: SARL Trans-Sahara"}
                                    value={regTransRaisonSociale} onChange={(e) => setRegTransRaisonSociale(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "رقم السجل التجاري (RC) إلزامي *" : "N° Registre de Commerce (RC) obligatoire *"}
                                  </label>
                                  <input 
                                    type="text" required placeholder={lang === "ar" ? "أدخل رقم السجل التجاري للنقل" : "N° RC de transporteur"}
                                    value={regTransRC} onChange={(e) => setRegTransRC(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "رقم ترخيص النقل البري للبضائع *" : "Titre d'autorisation de transport routier *"}
                                  </label>
                                  <input 
                                    type="text" required placeholder={lang === "ar" ? "رقم الاعتماد أو رخصة ممارسة النشاط" : "N° Certificat Ministériel de transport"}
                                    value={regTransAutorisation} onChange={(e) => setRegTransAutorisation(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-mono"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "الولاية الرئيسية للنشاط (المنطقة)" : "Wilaya d'activité principale (Région)"}
                                  </label>
                                  <select 
                                    value={regTransWilayaActivite} onChange={(e) => setRegTransWilayaActivite(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    {wilayas.map(w => (
                                      <option key={w.code} value={lang === "ar" ? w.ar : w.fr}>
                                        {lang === "ar" ? w.ar : w.fr}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "حجم وحجم الأسطول (عدد الشاحنات)" : "Taille de votre flotte (camions)"}
                                  </label>
                                  <select
                                    value={regTransNbCamions} onChange={(e) => setRegTransNbCamions(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-[#E5E7EB] rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    <option value="1">
                                      {lang === "ar" ? "شاحنة واحدة (سائق مالك فريد)" : "1 camion (Mon Chauffeur unique)"}
                                    </option>
                                    <option value="2-5">
                                      {lang === "ar" ? "من 2 إلى 5 شاحنات عاملة" : "2 à 5 camions opérationnels"}
                                    </option>
                                    <option value="5-15">
                                      {lang === "ar" ? "من 5 إلى 15 شاحنة ثقيلة" : "5 à 15 camions lourds"}
                                    </option>
                                    <option value="15+">
                                      {lang === "ar" ? "أكثر من 15 مقطورة سيمي-رومورك" : "Plus de 15 semi-remorques"}
                                    </option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Cas 2C : CHAMPS SPÉCIFIQUES POUR LE COMMERCIAL DE BVF */}
                          {regProfil === ProfileType.Commercial && (
                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block border-b pb-1">
                                {lang === "ar" ? "تأهيل وكالة وتنمية المبيعات" : "Qualification Réseau Apporteur d'affaires"}
                              </span>
                              
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "أعلى شهادة علمية حاصل عليها *" : "Plus haut diplôme *"}
                                  </label>
                                  <select
                                    value={regCommDiplome} onChange={(e) => setRegCommDiplome(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    <option value="Master/Ingénieur">
                                      {lang === "ar" ? "ماستر جامعي أو مهندس دولة في اللوجستيات" : "Master universitaire ou Ingénieur logistique"}
                                    </option>
                                    <option value="Licence">
                                      {lang === "ar" ? "ليسانس في التسيير أو العلوم التجارية" : "Licence en gestion / sciences commerciales"}
                                    </option>
                                    <option value="TS Logistique">
                                      {lang === "ar" ? "تقني سامي في التسيير واللوجستيات" : "Technicien Supérieur (TS) en Logistique"}
                                    </option>
                                    <option value="Bac">
                                      {lang === "ar" ? "التعليم الثانوي أو البكالوريا" : "Études secondaires ou Baccalauréat"}
                                    </option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "ولاية التدخل التجاري الرئيسية *" : "Wilaya d'intervention principale *"}
                                  </label>
                                  <select 
                                    value={regCommWilayaInterv} onChange={(e) => setRegCommWilayaInterv(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    {wilayas.map(w => (
                                      <option key={w.code} value={lang === "ar" ? w.ar : w.fr}>
                                        {lang === "ar" ? w.ar : w.fr}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "هل لديك خبرة سابقة في الشحن اللوجستي؟" : "Expérience dans le transport routier ?"}
                                  </label>
                                  <select
                                    value={regCommExperience} onChange={(e) => setRegCommExperience(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    <option value="Oui">
                                      {lang === "ar" ? "نعم (أكثر من سنتين في مجال النقل)" : "Oui (Plus de 2 ans dans le domaine logistique)"}
                                    </option>
                                    <option value="Débutant">
                                      {lang === "ar" ? "لا (رغبة في التدريب وبدء مسار تجاري)" : "Non (Débutant ou reconversion commerciale)"}
                                    </option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "كيف تعرفت على NETLOG-BVF؟ *" : "Comment avez-vous connu NETLOG-BVF ? *"}
                                  </label>
                                  <input 
                                    type="text" required placeholder={lang === "ar" ? "توصية، مواقع التواصل الاجتماعي، إلخ" : "Bouche à oreille, réseaux sociaux..."}
                                    value={regCommSource} onChange={(e) => setRegCommSource(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Cas 2D : CHAMPS SPÉCIFIQUES POUR LE MANUTENTIONNAIRE */}
                          {regProfil === ProfileType.Manutentionnaire && (
                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block border-b pb-1">
                                {lang === "ar" ? "معلومات نشاط المناولة" : "Informations d'activité de manutention"}
                              </span>

                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "الاسم التجاري *" : "Raison sociale *"}
                                  </label>
                                  <input
                                    type="text" required placeholder={lang === "ar" ? "مثال: مناولة الجزائر" : "ex: Manutention Alger SARL"}
                                    value={regManRaisonSociale} onChange={(e) => setRegManRaisonSociale(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "رقم السجل التجاري (RC) *" : "N° Registre de Commerce (RC) *"}
                                  </label>
                                  <input
                                    type="text" required placeholder="ex: 16/00-0943521B21"
                                    value={regManRC} onChange={(e) => setRegManRC(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-mono"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "نوع العتاد المتوفر *" : "Type d'engin principal *"}
                                  </label>
                                  <select
                                    value={regManTypesEngins[0]} onChange={(e) => setRegManTypesEngins([e.target.value])}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    <option value="Grue">{lang === "ar" ? "رافعة" : "Grue"}</option>
                                    <option value="Chariot élévateur">{lang === "ar" ? "شاحنة شوكية" : "Chariot élévateur"}</option>
                                    <option value="Pelle">{lang === "ar" ? "حفارة" : "Pelle"}</option>
                                    <option value="Chargeuse">{lang === "ar" ? "جرافة" : "Chargeuse"}</option>
                                    <option value="Nacelle">{lang === "ar" ? "نصاب" : "Nacelle"}</option>
                                    <option value="Autre">{lang === "ar" ? "أخرى" : "Autre"}</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "ولاية النشاط الرئيسية *" : "Wilaya d'activité principale *"}
                                  </label>
                                  <select
                                    value={regManWilayaActivite} onChange={(e) => setRegManWilayaActivite(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                  >
                                    {wilayas.map(w => (
                                      <option key={w.code} value={lang === "ar" ? w.ar : w.fr}>
                                        {lang === "ar" ? w.ar : w.fr}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Cas 2E : CHAMPS SPÉCIFIQUES POUR LE COMMISSIONNAIRE */}
                          {regProfil === ProfileType.Commissionnaire && (
                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block border-b pb-1">
                                {lang === "ar" ? "معلومات نشاط الوساطة" : "Informations d'activité Transitaire/Commissionnaire"}
                              </span>

                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "الاسم التجاري *" : "Raison sociale *"}
                                  </label>
                                  <input
                                    type="text" required placeholder={lang === "ar" ? "مثال: وساطة الجزائر" : "ex: Transit Alger SARL"}
                                    value={regTCRaisonSociale} onChange={(e) => setRegTCRaisonSociale(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-0.5">
                                    {lang === "ar" ? "رقم السجل التجاري (RC) *" : "N° Registre de Commerce (RC) *"}
                                  </label>
                                  <input
                                    type="text" required placeholder="ex: 16/00-0943521B21"
                                    value={regTCRC} onChange={(e) => setRegTCRC(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  {lang === "ar" ? "ولاية النشاط الرئيسية *" : "Wilaya d'activité principale *"}
                                </label>
                                <select
                                  value={regTCWilayaActivite} onChange={(e) => setRegTCWilayaActivite(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 cursor-pointer"
                                >
                                  {wilayas.map(w => (
                                    <option key={w.code} value={lang === "ar" ? w.ar : w.fr}>
                                      {lang === "ar" ? w.ar : w.fr}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}

                          {/* Case d'acceptation des conditions d'utilisation */}
                          <div className="flex items-start gap-2.5 pt-1">
                            <input 
                              type="checkbox" 
                              id="reg-accept-cgu-form"
                              required
                              checked={regAcceptCGU}
                              onChange={(e) => setRegAcceptCGU(e.target.checked)}
                              className="mt-0.5 accent-[#1D9E75] cursor-pointer"
                            />
                            <label htmlFor="reg-accept-cgu-form" className="text-[10.5px] leading-relaxed text-slate-500 font-semibold">
                              {lang === "ar" ? (
                                <>
                                  أنا أقبل بدون تحفظ{" "}
                                  <button type="button" onClick={() => setShowCGUModal(true)} className="text-[#1D9E75] font-bold hover:underline bg-transparent border-0 cursor-pointer inline p-0">
                                    شروط الاستخدام العامة
                                  </button>{" "}
                                  لمنصة NETLOG وألتزم بتقديم وثائق إدارية صحيحة وهويات حقيقية.
                                </>
                              ) : (
                                <>
                                  J'accepte sans réserve les{" "}
                                  <button type="button" onClick={() => setShowCGUModal(true)} className="text-[#1D9E75] font-bold hover:underline bg-transparent border-0 cursor-pointer inline p-0">
                                    Conditions Générales d'Utilisation
                                  </button>{" "}
                                  de la plateforme NETLOG et m'engage à fournir des justificatifs administratifs authentiques.
                                </>
                              )}
                            </label>
                          </div>

                          {/* Bouton de soumission finale pour s'enregistrer */}
                          <button
                            type="submit"
                            className="w-full py-3.5 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-xl transition-all text-xs font-black uppercase tracking-wider text-center shadow-lg cursor-pointer mt-1"
                          >
                            {lang === "ar" ? "إنهاء عملية التسجيل والتحقق من حسابي ➔" : "Finaliser mon inscription et valider KYC ➔"}
                          </button>
                        </form>
                      )}

                    </div>
                  )}

                </div>

                {/* Pied de conteneur d'authentification avec option invité */}
                <div className="pt-6 border-t border-slate-100 text-center space-y-2">
                  <p className="text-[10px] text-slate-400 font-semibold">
                    NETLOG sécurise l'intégralité des flux logistiques en Algérie sous le contrôle de BVF Algérie.
                  </p>
                  
                  <button
                    onClick={() => {
                      setGuestMode(true);
                      triggerSystemLog("Bienvenue en mode invité (Accès public anonyme). Certaines actions d'affrètement exclusives nécessiteront un profil valide.", "info");
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-[#1D9E75] hover:text-[#085041] font-black underline hover:no-underline cursor-pointer bg-transparent border-0"
                  >
                    Consulter librement la bourse de fret (Mode invité) ➔
                  </button>
                </div>
              </div>

            </div>
          </div>
        ) : selectedDetailOffre ? (
          renderDetailOffreScreen(selectedDetailOffre)
        ) : (
          <>
            {/* ----------------- TAB 1: ACCUEIL BOURSE DE FRET (PUBLIC REDESIGNED) ----------------- */}
        {currentTab === "accueil" && (
          <div className="space-y-6">
            
            {/* Zone 1 — Bandeau de bienvenue (si non connecté) */}
            {!currentUser && (
              <div style={{ background: 'linear-gradient(135deg, #085041 0%, #1D9E75 100%)' }} className="rounded-[16px] p-6 text-white text-center relative overflow-hidden shadow-sm shadow-[#1d9e7520] mb-6">
                <div className="relative z-10 space-y-2 max-w-2xl mx-auto">
                  <h2 className="text-xl font-extrabold md:text-3xl text-white tracking-tight leading-tight">
                    Trouvez des transporteurs fiables dans toute l'Algérie
                  </h2>
                  <p className="text-xs md:text-sm text-emerald-100 font-semibold opacity-90">
                    600 000+ camions · 58 wilayas · Gratuit pour les donneurs d'ordre
                  </p>
                  <div className="pt-2">
                    <button 
                      onClick={() => setShowRegisterModal(true)} 
                      className="bg-white text-[#085041] text-xs font-bold rounded-[8px] px-5 py-2.5 hover:bg-emerald-50 transition-colors shadow-sm cursor-pointer"
                    >
                      S'inscrire gratuitement
                    </button>
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
                  <Truck className="w-64 h-64 text-white" />
                </div>
              </div>
            )}

            {/* Zone 2 — Barre de filtre rapide (fond blanc, ombre légère, sticky sous l'en-tête de 56px) */}
            <div className="sticky top-[56px] z-30 bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_4px_10px_rgba(0,0,0,0.04)] p-4 space-y-3 mb-6">
              {/* Ligne 1 : Wilayas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs text-slate-400">📍</span>
                  <select 
                    value={filterDepart} 
                    onChange={(e) => {
                      setFilterDepart(e.target.value);
                      triggerSystemLog(`Filtre départ réglé sur: ${e.target.value}`, "info");
                    }}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-[#E5E7EB] rounded-[8px] text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1D9E75] cursor-pointer"
                  >
                    <option value="Tous">Toutes les wilayas (Départ) ▼</option>
                    {[...wilayas].sort((a,b) => a.fr.localeCompare(b.fr)).map(w => (
                      <option key={w.code} value={w.fr}>{w.fr}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs text-slate-400">📍</span>
                  <select 
                    value={filterArrivee} 
                    onChange={(e) => {
                      setFilterArrivee(e.target.value);
                      triggerSystemLog(`Filtre arrivée réglé sur: ${e.target.value}`, "info");
                    }}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-[#E5E7EB] rounded-[8px] text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1D9E75] cursor-pointer"
                  >
                    <option value="Tous">Toutes les wilayas (Arrivée) ▼</option>
                    {[...wilayas].sort((a,b) => a.fr.localeCompare(b.fr)).map(w => (
                      <option key={w.code} value={w.fr}>{w.fr}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ligne 2 : Type camion, Date et Bouton filtrer */}
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="flex-1 relative">
                  <span className="absolute left-3.5 top-3 text-xs text-slate-400">🚛</span>
                  <select 
                    value={filterMoyen} 
                    onChange={(e) => setFilterMoyen(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-[#E5E7EB] rounded-[8px] text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1D9E75] cursor-pointer"
                  >
                    <option value="Tous">Tous types de camion ▼</option>
                    <option value={MoyenType.Tautliner}>Tautliner (bâché)</option>
                    <option value={MoyenType.Plateau}>Plateau</option>
                    <option value={MoyenType.Citerne}>Citerne</option>
                    <option value={MoyenType.Fourgon}>Fourgon fermé</option>
                    <option value={MoyenType.BenneBasculante}>Benne basculante</option>
                    <option value={MoyenType.CamionFrigorifique}>Frigorifique</option>
                    <option value={MoyenType.PorteEngin}>Porte-engin</option>
                    <option value={MoyenType.VUL}>VUL (véhicule utilitaire léger)</option>
                    <option value={MoyenType.CamionPorteur}>Porteur</option>
                    <option value={MoyenType.Tracteur}>Tracteur</option>
                    <option value={MoyenType.Fardier}>Fardier</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div className="flex-1 relative">
                  <span className="absolute left-3.5 top-3 text-xs text-slate-400">📅</span>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-[#E5E7EB] rounded-[8px] text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1D9E75]"
                  />
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button 
                    onClick={() => triggerSystemLog("Recherche actualisée sur la Bourse !", "success")}
                    className="bg-[#1D9E75] text-white hover:bg-[#085041] transition-all rounded-[8px] px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    🔍 Filtrer
                  </button>
                  
                  {(filterDepart !== "Tous" || filterArrivee !== "Tous" || filterMoyen !== "Tous" || filterMarchandise || filterDate) && (
                    <button 
                      onClick={() => {
                        setFilterDepart("Tous");
                        setFilterArrivee("Tous");
                        setFilterMoyen("Tous");
                        setFilterMarchandise("");
                        setFilterDate("");
                        triggerSystemLog("Tous les filtres sont effacés !", "info");
                      }}
                      className="text-xs text-[#6B7280] hover:text-[#D85A30] font-semibold whitespace-nowrap underline cursor-pointer"
                    >
                      Effacer les filtres
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Zone 3 — Statistiques rapides (3 compteurs dans le respect de la charte) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="card p-4 text-center flex items-center justify-center gap-3 border-l-4 border-l-[#1D9E75]">
                <span className="text-2xl">🚛</span>
                <div className="text-left">
                  <div className="text-xs font-black text-[#1A1A2E]">1 247</div>
                  <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wide">camions inscrits</div>
                </div>
              </div>
              <div className="card p-4 text-center flex items-center justify-center gap-3 border-l-4 border-l-[#378ADD]">
                <span className="text-2xl">📋</span>
                <div className="text-left">
                  <div className="text-xs font-black text-[#1A1A2E]">{offres.length}</div>
                  <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wide">offres actives</div>
                </div>
              </div>
              <div className="card p-4 text-center flex items-center justify-center gap-3 border-l-4 border-l-[#085041]">
                <span className="text-2xl">✅</span>
                <div className="text-left">
                  <div className="text-xs font-black text-[#1A1A2E]">3 420</div>
                  <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wide">missions réalisées</div>
                </div>
              </div>
            </div>

            {/* Zone 4 — Liste des offres de fret (cartes défilantes) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-[#085041]">Offres de fret disponibles</span>
                  <span className="bg-[#E1F5EE] text-[#085041] rounded-[20px] px-2.5 py-0.5 text-xs font-bold">{filteredBourseOffres.length} offres</span>
                </div>
                <div className="flex items-center gap-1.5 self-stretch sm:self-auto overflow-x-auto text-xs py-1">
                  <button 
                    onClick={() => setSortBy("recent")}
                    className={`px-3.5 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                      sortBy === "recent" ? "bg-[#1D9E75] text-white shadow-xs" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    🕐 {lang === "ar" ? "الأحدث" : "Plus récentes"}
                  </button>
                  <button 
                    onClick={() => setSortBy("price")}
                    className={`px-3.5 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                      sortBy === "price" ? "bg-[#1D9E75] text-white shadow-xs" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    💰 {lang === "ar" ? "السعر" : "Prix croissant"}
                  </button>
                  <button 
                    onClick={() => setSortBy("proximity")}
                    className={`px-3.5 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                      sortBy === "proximity" ? "bg-[#1D9E75] text-white shadow-xs" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    📍 {lang === "ar" ? "القرب" : "Proximité"}
                  </button>
                </div>
              </div>

              {filteredBourseOffres.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500 dark:text-slate-400 shadow-sm animate-fade-in flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-[#1D9E75]/20 dark:text-emerald-500/20">
                    <Truck className="w-8 h-8 text-[#1D9E75] dark:text-[#1D9E75]" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-[#1A1A2E] dark:text-white text-xs uppercase tracking-wide">
                      {lang === "ar" ? "لا توجد عروض نقل تطابق معاييرك الحالية" : "Aucune offre de transport disponible"}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-400 font-semibold leading-normal animate-pulse">
                      {lang === "ar" ? "حاول تغيير ولاية المغادرة أو الوصول لتوسيع البحث." : "Essayez de relâcher les Wilayas de départ ou d'arrivée de vos filtres."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...filteredBourseOffres]
                    .sort((a,b) => {
                      if (sortBy === "recent") {
                        return new Date(b.dateCreation || b.dateChargement).getTime() - new Date(a.dateCreation || a.dateChargement).getTime();
                      } else if (sortBy === "price") {
                        const priceA = a.prixFixe || 9999999;
                        const priceB = b.prixFixe || 9999999;
                        return priceA - priceB;
                      } else {
                        return a.depart.localeCompare(b.depart, 'fr');
                      }
                    })
                    .map((offre) => {
                      const isOwner = currentUser?.id === offre.donneurId;
                      const isTransporteur = currentUser?.profil === ProfileType.Transporteur;
                      
                      let badgeColor = "badge-vert";
                      if (offre.moyenExige === MoyenType.CamionFrigorifique) badgeColor = "badge-bleu";
                      else if (offre.moyenExige === MoyenType.BenneBasculante) badgeColor = "badge-orange";
                      else if (offre.moyenExige === MoyenType.Plateau) badgeColor = "badge-rouge";

                      return (
                        <div 
                          key={offre.id} 
                          onClick={() => setSelectedDetailOffre(offre)}
                          className="card p-5 flex flex-col justify-between hover:shadow-lg hover:border-[#1D9E75]/30 cursor-pointer transition-all bg-white border border-gray-100 group"
                        >
                          <div>
                            {/* Ligne badges */}
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex gap-1.5 flex-wrap">
                                <span className={`${badgeColor}`}>
                                  {translateMoyenType(offre.moyenExige, lang)}
                                </span>
                                {isOwner && (
                                  <span className="badge-vert border border-emerald-300 bg-emerald-50 text-[#085041] uppercase leading-none px-2 py-0.5 font-bold">
                                    Mon offre
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase group-hover:text-[#1D9E75] transition-colors">
                                Réf: {offre.id.toUpperCase().substring(0, 6)} 🔍
                              </span>
                            </div>

                            {/* Trajet: Gros et gras */}
                            <div className="py-2.5 px-3 bg-slate-50 group-hover:bg-emerald-50/20 rounded-xl mb-4 border border-dashed border-slate-100 flex items-center justify-between transition-colors">
                              <div className="font-black text-sm text-[#085041] flex items-center gap-1.5">
                                <span className="text-xs">📍</span> {translateCity(offre.depart, lang).toUpperCase()}
                              </div>
                              <span className="text-[#1D9E75] font-black group-hover:translate-x-1 transition-transform">➔</span>
                              <div className="font-black text-sm text-[#085041] flex items-center gap-1.5">
                                <span className="text-xs">📍</span> {translateCity(offre.arrivee, lang).toUpperCase()}
                              </div>
                            </div>

                            {/* Détails fret */}
                            <div className="space-y-2 mb-4">
                              <div className="text-xs font-bold text-[#1A1A2E] flex items-center gap-2">
                                <span className="text-sm">📦</span>
                                <span>{translateMarchandise(offre.marchandise, lang)}</span>
                              </div>
                              <div className="text-[11px] text-[#6B7280] font-mono font-semibold flex items-center gap-2">
                                <span>⚖️ {offre.poids} Tonnes</span>
                                <span>·</span>
                                <span>🔄 {offre.nombreVoyages} voyage{offre.nombreVoyages > 1 ? "s" : ""}</span>
                              </div>
                              <div className="text-[11px] text-[#6B7280] font-semibold flex items-center gap-2">
                                <span>📅 Enlèvement :</span>
                                <span className="text-slate-800 font-bold">{offre.dateChargement}</span>
                              </div>
                            </div>
                          </div>

                          {/* Footer avec prix et CTA */}
                          <div 
                            className="pt-3.5 border-t border-[#E5E7EB] flex items-center justify-between mt-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280] block">Tarif Cible</span>
                              {offre.prixFixe ? (
                                <span className="text-md font-bold text-[#085041] block">
                                  {offre.prixFixe.toLocaleString()} DA
                                </span>
                              ) : (
                                <span className="text-xs italic text-[#6B7280] font-bold block">
                                  Prix à négocier
                                </span>
                              )}
                            </div>

                            <div className="flex gap-1.5">
                              {isOwner ? (
                                <button 
                                  onClick={() => {
                                    setCurrentTab("donneur");
                                    triggerSystemLog("Rendu sur votre espace personnel Donneur pour administrer le fret", "info");
                                  }}
                                  className="bg-[#1D9E75] text-white hover:bg-[#085041] transition-colors rounded-[8px] px-3 py-1.5 text-xs font-bold cursor-pointer"
                                >
                                  Gérer
                                </button>
                              ) : isTransporteur ? (
                                <button 
                                  onClick={() => initiateBid(offre)}
                                  className="bg-[#1D9E75] text-white hover:bg-[#085041] transition-colors rounded-[8px] px-3 py-1.5 text-xs font-bold cursor-pointer"
                                >
                                  Proposer un prix
                                </button>
                              ) : (
                                <button 
                                  onClick={() => {
                                    triggerSystemLog("Pour proposer une cotation, veuillez vous connecter comme Transporteur (en haut ou via le menu !)", "info");
                                  }}
                                  className="bg-white border border-[#1D9E75] text-[#1D9E75] hover:bg-[#E1F5EE] transition-colors rounded-[8px] px-3 py-1.5 text-xs font-bold cursor-pointer animate-pulse-slow"
                                >
                                  S'enregistrer
                                </button>
                              )}
                              
                              <button
                                onClick={() => setSelectedDetailOffre(offre)}
                                className="bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-[8px] px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors"
                              >
                                Détails →
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Zone 5 — Section "Pourquoi NETLOG ?" (visible si non connecté) */}
            {!currentUser && (
              <div className="mt-10 pt-8 border-t border-[#E5E7EB]">
                <h3 className="text-center font-bold text-base text-[#085041] mb-6">
                  Pourquoi utiliser la Bourse de Fret NETLOG ?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="card p-5 bg-white text-center space-y-2 border border-gray-100">
                    <div className="text-3xl">🔍</div>
                    <h4 className="font-bold text-xs text-[#085041] uppercase tracking-wider">Trouvez rapidement</h4>
                    <p className="text-xs text-[#6B7280] leading-relaxed font-semibold">
                      Recherchez instantanément parmi des centaines de transporteurs qualifiés et d'offres de transport partout en Algérie.
                    </p>
                  </div>
                  <div className="card p-5 bg-white text-center space-y-2 border border-gray-100">
                    <div className="text-3xl">💰</div>
                    <h4 className="font-bold text-xs text-[#085041] uppercase tracking-wider">Meilleurs tarifs</h4>
                    <p className="text-xs text-[#6B7280] leading-relaxed font-semibold">
                      Évitez les intermédiaires gourmands en marges d'affrètement. Des cotations réelles directes conformes au marché national.
                    </p>
                  </div>
                  <div className="card p-5 bg-white text-center space-y-2 border border-gray-100">
                    <div className="text-3xl">📊</div>
                    <h4 className="font-bold text-xs text-[#085041] uppercase tracking-wider">Suivi en temps réel</h4>
                    <p className="text-xs text-[#6B7280] leading-relaxed font-semibold">
                      Sécurisez vos chargements grâce au logigramme dynamique et l'authentification des décharges par codes uniques.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ----------------- TAB: ESPACE DONNEUR D'ORDRE (PROFIL 1) ----------------- */}
        {currentTab === "donneur" && currentUser?.profil === ProfileType.DonneurOrdre && (
          <DonneurDashboard
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            lang={lang}
            t={t}
            saveState={saveState}
            offres={offres}
            propositions={propositions}
            factures={factures}
            devis={devis}
            counters={counters}
            incrementCounter={incrementCounter}
            users={users}
            triggerSystemLog={triggerSystemLog}
            setActiveContractDoc={setActiveContractDoc}
            translateCity={translateCity}
            translateMoyenType={translateMoyenType}
            translateMarchandise={translateMarchandise}
            setCurrentTab={setCurrentTab}
          />
        )}

        {/* ----------------- TAB: ESPACE TRANSPORTEUR (PROFIL 2) ----------------- */}
        {currentTab === "transporteur" && currentUser?.profil === ProfileType.Transporteur && (
          <TransporteurDashboard
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            lang={lang}
            t={t}
            moyens={moyens}
            saveState={saveState}
            offres={offres}
            propositions={propositions}
            factures={factures}
            devis={devis}
            counters={counters}
            incrementCounter={incrementCounter}
            users={users}
            initiateBid={initiateBid}
            triggerSystemLog={triggerSystemLog}
            setActiveContractDoc={setActiveContractDoc}
            translateCity={translateCity}
            translateMoyenType={translateMoyenType}
            translateMarchandise={translateMarchandise}
            setCurrentTab={setCurrentTab}
          />
        )}

        {/* ----------------- TAB: ESPACE CHAUFFEUR (PROFIL 6) ----------------- */}
        {currentTab === "chauffeur" && currentUser?.profil === ProfileType.Chauffeur && (
          <ChauffeurDashboard
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            offres={offres}
            users={users}
            saveState={saveState}
            lang={lang}
            t={t}
            triggerSystemLog={triggerSystemLog}
            translateCity={translateCity}
            translateMarchandise={translateMarchandise}
          />
        )}

        {/* ----------------- TAB: ESPACE COMMERCIAL BVF (PROFIL 3) ----------------- */}
        {currentTab === "commercial" && currentUser?.profil === ProfileType.Commercial && (
          <CommercialDashboard
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            lang={lang}
            t={t}
            saveState={saveState}
            offres={offres}
            users={users}
            propositions={propositions}
            factures={factures}
            triggerSystemLog={triggerSystemLog}
          />
        )}

        {/* ----------------- TAB: ESPACE ADMIN NETLOG (PROFIL 4) ----------------- */}
        {currentTab === "admin" && currentUser?.profil === ProfileType.Admin && (
          <AdminDashboard
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            lang={lang}
            t={t}
            saveState={saveState}
            offres={offres}
            users={users}
            propositions={propositions}
            factures={factures}
            triggerSystemLog={triggerSystemLog}
            moyens={moyens}
          />
        )}
        {false && currentTab === "admin" && currentUser?.profil === ProfileType.Admin && (
          <div className="space-y-6">
            
            {/* Header branding */}
            <div style={{ backgroundColor: '#0f172a' }} className="bg-slate-900 text-white p-6 rounded-3xl shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="bg-[#1D9E75] text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">
                  🛡️ Super Admin NETLOG
                </span>
                <h2 className="text-lg md:text-xl font-black font-sans !text-white">
                  Portail NetLog Administration & Validation KYC
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Session ID: {currentUser.id} • Droits: Contrôle Total, KYC Approbation, Modérateur Système
                </p>
              </div>
              
              <button 
                onClick={() => {
                  // Quick simulate administrative factory database reset
                  localStorage.clear();
                  window.location.reload();
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl px-4 py-2.5 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Réinitialiser la BDD Démo
              </button>
            </div>

            {/* Admin stats dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-xl shrink-0">
                  👥
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wide">Inscrits Globaux</span>
                  <span className="text-lg font-black block font-mono text-[#1A1A2E]">{users.length}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-xl shrink-0">
                  📦
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wide">Cargaisons Publiées</span>
                  <span className="text-lg font-black block font-mono text-[#1A1A2E]">{offres.length}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-xl shrink-0">
                  🤝
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wide">Affrètements Signés</span>
                  <span className="text-lg font-black block font-mono text-[#1A1A2E]">
                    {offres.filter(o => o.status !== OffreStatus.Publie).length}
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-xl shrink-0">
                  ⚖️
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wide">Fret Total (tonnes)</span>
                  <span className="text-lg font-black block font-mono text-[#1A1A2E]">
                    {offres.reduce((acc, o) => acc + o.poids, 0).toLocaleString()} t
                  </span>
                </div>
              </div>
            </div>

            {/* Core Section: KYC verification queues (PENDING) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left column (8 cols) -> validation queues and member controls */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* KYC Validation pending list */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 border-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🛡️</span>
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-[#085041]">
                          Validation d'accès KYC administrative
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          Examinez et validez les documents légaux d'inscription des nouveaux transporteurs et donneurs d'ordres.
                        </p>
                      </div>
                    </div>
                    
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full animate-pulse">
                      {users.filter(u => u.status === "en_attente").length} En Attente
                    </span>
                  </div>

                  {users.filter(u => u.status === "en_attente").length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-gray-150 text-xs font-semibold text-slate-400">
                      🎉 Aucun dossier KYC en attente d'approbation administrative. Tous les membres sont d'équerre !
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {users.filter(u => u.status === "en_attente").map((u) => (
                        <div key={u.id} className="p-4 rounded-2xl bg-amber-50/10 border border-amber-200/50 space-y-3.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100/60 pb-3">
                            <div className="space-y-0.5">
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                                {u.profil} (En Attente Verification)
                              </span>
                              <h4 className="font-extrabold text-[#1a1a2e] text-xs pt-1">
                                {u.raisonSociale} — {u.wilaya}
                              </h4>
                              <p className="text-[10px] text-slate-500">
                                Contact: {u.prenom} {u.nom} • Email: {u.email} • Tel: {u.tel}
                              </p>
                            </div>
                            
                            <span className="text-[10px] font-mono text-slate-400 font-bold shrink-0 self-start sm:self-center">
                              RC: {u.nrc}
                            </span>
                          </div>

                          {/* Render specific profile documentation provided for transparency */}
                          <div className="p-3 bg-slate-50 rounded-xl grid grid-cols-2 md:grid-cols-3 gap-3 text-[10px] font-medium text-slate-600">
                            <div>
                              <span className="text-slate-400 block">Secteur / Nb Camions</span>
                              <span className="font-bold text-slate-800">{u.secteur || u.nbCamions || "Non précisé"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Volume Fret / Wilaya Activité</span>
                              <span className="font-bold text-slate-800">{u.volumeFret || u.wilayaActivite || "Nationale"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Identifiant Fiscal (NIF)</span>
                              <span className="font-bold text-slate-800 font-mono">{u.nif || u.nrc.split(" ")[0]}</span>
                            </div>
                          </div>

                          {/* Approve and reject actions */}
                          <div className="flex items-center gap-2 justify-end pt-1">
                            <button 
                              onClick={() => handleSuspendUser(u.id)}
                              className="bg-slate-100 border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-500 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                            >
                              Déclarer non-conforme
                            </button>
                            <button 
                              onClick={() => handleApproveUser(u.id)}
                              className="bg-[#1D9E75] hover:bg-[#085041] text-white font-extrabold px-4 py-1.5 rounded-lg text-xs cursor-pointer shadow-sm transition-colors"
                            >
                              ✔ Approuver KYC d'Admission
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Member compliance ledger list */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <span className="text-xs font-black uppercase tracking-wider text-[#1a1a2e] block border-b pb-2.5 border-gray-50">
                    🏢 Grand Livre des Acteurs Enregistrés NETLOG
                  </span>

                  <div className="space-y-2.5">
                    {users.map((u) => {
                      let tagBg = "bg-emerald-50 text-emerald-800 border-emerald-200";
                      let tagLabel = "Actif";
                      if (u.status === "en_attente") {
                        tagBg = "bg-amber-50 text-amber-800 border-amber-200";
                        tagLabel = "KYC non validé";
                      } else if (u.status === "suspendu") {
                        tagBg = "bg-rose-50 text-rose-800 border-rose-200";
                        tagLabel = "Suspendu";
                      }

                      return (
                        <div key={u.id} className="p-3 bg-slate-50/60 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-[#1a1a2e] text-[12px]">{u.raisonSociale}</span>
                              <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider ${
                                u.profil === ProfileType.DonneurOrdre ? "bg-blue-100 text-[#0C447C]" : 
                                u.profil === ProfileType.Transporteur ? "bg-emerald-100 text-[#085041]" : "bg-purple-100 text-[#3B1E7B]"
                              }`}>
                                {u.profil}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block font-sans">
                              Contact: {u.prenom} {u.nom} • {u.email} • Tel: {u.tel}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className={`border px-2 py-0.5 rounded-full text-[9px] font-black ${tagBg}`}>
                              {tagLabel}
                            </span>
                            
                            {u.profil !== ProfileType.Admin && (
                              <button 
                                onClick={() => {
                                  if (u.status === "suspendu") handleApproveUser(u.id);
                                  else handleSuspendUser(u.id);
                                }}
                                className={`text-[9.5px] font-bold px-2.5 py-1 border rounded-lg cursor-pointer transition-colors ${
                                  u.status === "suspendu" 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                                    : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                }`}
                              >
                                {u.status === "suspendu" ? "Réactiver" : "Suspendre"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Right column (4 cols) -> quick administration simulation tools */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* System settings and tools */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <div className="border-b pb-2.5 border-gray-50 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase text-[#6B7280] tracking-wide block">
                      ⚙️ Outils Systèmes Démo
                    </span>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={() => {
                        // Create a totally brand new mock cargo offer
                        const newMockOffre: OffreFret = {
                          id: "offre-mock-" + Date.now(),
                          donneurId: "user-do-1",
                          donneurRaisonSociale: "SARL BATIMEX",
                          depart: "Alger",
                          arrivee: "Oran",
                          departDetails: "Rouïba, Alger",
                          arriveeDetails: "Zone Portuaire, Oran",
                          dateChargement: new Date(Date.now() + 86400000).toISOString().split("T")[0],
                          dateLivraison: new Date(Date.now() + 172800000).toISOString().split("T")[0],
                          poids: 22,
                          marchandise: "Profilés d'Aluminium en fardeaux",
                          moyenExige: MoyenType.Tautliner,
                          nombreVoyages: 1,
                          prixFixe: 125000,
                          status: OffreStatus.Publie,
                          codeConfirmation: "8899",
                          dateCreation: new Date().toISOString().split("T")[0]
                        };
                        
                        const updated = [newMockOffre, ...offres];
                        saveState(undefined, undefined, updated);
                        triggerSystemLog("Cargaison témoin injectée avec succès dans la bourse publique d'Alger !", "success");
                      }}
                      className="w-full text-left p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-[#1D9E75] transition-all flex items-center gap-3 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <span className="text-lg">⚡</span>
                      <div>
                        <span>Injecter une cargaison témoin</span>
                        <span className="text-[9px] text-slate-400 block font-normal">Ajoute un fret direct sur Alger-Oran</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => {
                        // Generate mock CCP invoices directly for testing
                        triggerSystemLog("Validation administrative de tous les justificatifs CCP !", "success");
                      }}
                      className="w-full text-left p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-[#378ADD] transition-all flex items-center gap-3 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <span className="text-lg">📜</span>
                      <div>
                        <span>Valider tous les justificatifs PDF</span>
                        <span className="text-[9px] text-slate-400 block font-normal">Approuve instantanément tous les pro-formas</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Regulatory reminders conformable to PDF */}
                <div className="bg-white p-5 rounded-3xl border border-[#E1F5EE] shadow-sm space-y-3 bg-[#E1F5EE]/10">
                  <span className="text-[11px] font-black uppercase text-[#085041] tracking-widest block border-b pb-2 border-emerald-250/30">
                    📜 Rappel Réglementaire d'Affrètement
                  </span>
                  
                  <div className="text-[10px] text-[#085041] leading-relaxed font-semibold space-y-1.5 font-sans">
                    <p>
                      Conformément à la Loi d'Affrètement Routier de Fret en Algérie :
                    </p>
                    <ul className="list-disc pl-3.5 space-y-1">
                      <li>Toute validation de KYC nécessite un Registre du Commerce d'Activité de Transport ou Entreprise valide.</li>
                      <li>Le code unique à 4 chiffres sécurise le transfert de responsabilité à destination.</li>
                      <li>Les réserves écrites doivent être visées contradictoirement lors de la livraison du fret.</li>
                    </ul>
                  </div>
                </div>

              </div>
              
            </div>

          </div>
        )}

        {/* ----------------- TAB: LIVE ALGERIA MAP (currentTab === "carte") ----------------- */}
        {currentTab === "carte" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <span className="bg-[#1D9E75]/10 text-[#1D9E75] text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                    🗺️ Géolocalisation & Flux Algérie Bourse
                  </span>
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                    Carte interactive de densité des flux de transport
                  </h2>
                  <p className="text-[11px] text-slate-500 font-sans leading-normal">
                    Visualisez les corridors logistiques nationaux et les volumes de camions en temps réel par wilayas clés d'exploitation.
                  </p>
                </div>
                
                <div className="flex gap-4 font-mono text-[10px] text-slate-500 font-bold">
                  <div className="bg-emerald-50 text-emerald-800 px-3.5 py-2.5 rounded-2xl border border-emerald-100 text-center">
                    <span className="block font-black text-xs">1,240</span>
                    Moyens Actifs
                  </div>
                  <div className="bg-indigo-50 text-indigo-800 px-3.5 py-2.5 rounded-2xl border border-indigo-100 text-center">
                    <span className="block font-black text-xs">58</span>
                    Wilayas Couvertes
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Wilaya lists with metrics */}
                <div className="lg:col-span-4 space-y-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-l-2 border-[#1D9E75] pl-2">
                    Densité Fret par Wilaya
                  </h3>
                  
                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-2 scrollbar-thin">
                    {[
                      { code: "16", name: "Alger (Capitale)", count: 485, load: 92, trend: "up" },
                      { code: "31", name: "Oran", count: 320, load: 78, trend: "up" },
                      { code: "19", name: "Sétif (Hauts-Plateaux)", count: 210, load: 65, trend: "neutral" },
                      { code: "30", name: "Ouargla (Hassi Messaoud)", count: 185, load: 84, trend: "up" },
                      { code: "25", name: "Constantine (Est)", count: 160, load: 58, trend: "down" },
                      { code: "06", name: "Béjaïa (Port principal)", count: 155, load: 88, trend: "up" },
                      { code: "23", name: "Annaba", count: 120, load: 50, trend: "neutral" },
                      { code: "13", name: "Tlemcen", count: 95, load: 45, trend: "down" },
                      { code: "47", name: "Ghardaïa (Porte du Sud)", count: 110, load: 72, trend: "up" },
                      { code: "39", name: "El Oued", count: 85, load: 60, trend: "up" }
                    ].map((entry) => (
                      <div key={entry.code} className="p-3 bg-slate-50 hover:bg-slate-100/75 rounded-2xl border border-slate-100 flex items-center justify-between text-xs transition duration-150">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-xl bg-slate-900 text-white font-mono font-black flex items-center justify-center text-[10px]">
                            {entry.code}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-800 block text-[11px] leading-tight">{entry.name}</span>
                            <span className="font-mono text-[9px] text-slate-400 font-extrabold uppercase">Taux remplissage : {entry.load}%</span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <span className="font-mono font-black text-slate-900 block">{entry.count} Camions</span>
                          <span className={`text-[9px] font-black uppercase ${
                            entry.trend === "up" ? "text-emerald-600" : entry.trend === "down" ? "text-rose-500" : "text-amber-500"
                          }`}>
                            {entry.trend === "up" ? "▲ Hausse" : entry.trend === "down" ? "▼ Baisse" : "● Stable"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Leaflet OpenStreetMap Algeria Map */}
                <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 text-slate-800 dark:text-slate-200 min-h-[460px] flex flex-col justify-between relative overflow-hidden shadow-inner">
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-[#1D9E75]/10 text-[#1D9E75] px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider font-mono">
                      🛰️ OpenStreetMap Live Algerian Network
                    </span>
                    <span className="text-[9px] text-[#6B7280] font-bold font-mono">
                      LIVE BEACONS ACTIVE · ROTATION: GPS
                    </span>
                  </div>

                  {/* Leaflet container */}
                  <div className="w-full flex-1 min-h-[380px] relative z-20">
                    <LeafletMap 
                      offres={offres} 
                      moyens={moyens} 
                      onSelectOffre={setSelectedDetailOffre} 
                      lang={lang} 
                    />
                  </div>

                  <div className="flex gap-4 items-center border-t border-slate-100 dark:border-slate-800 pt-3 mt-3 relative z-10">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
                    <p className="text-[10px] text-slate-500 font-sans leading-normal">
                      Couplé au GPS de la flotte des transporteurs NETLOG. Les calculs d'itinéraires intègrent les corridors logistiques nationaux et l'état des routes nationales (RN1, RN3, RN5).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB: PUBLISH OF FREIGHT (currentTab === "publier") ----------------- */}
        {currentTab === "publier" && (() => {
          const isDO = currentUser?.profil === ProfileType.DonneurOrdre;

          const handleQuickPublishOfferSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (!isDO) {
              triggerSystemLog("Interdit : Vous devez être connecté en tant que Donneur d'Ordre pour poster une offre.", "danger");
              return;
            }

            const newId = `offre-${offres.length + 1}`;
            const newOffer: OffreFret = {
              id: newId,
              donneurId: currentUser.id,
              donneurRaisonSociale: currentUser.raisonSociale || `${currentUser.prenom} ${currentUser.nom}`,
              depart: pubDepart,
              arrivee: pubArrivee,
              departDetails: `Entrepôt principal de ${pubDepart}`,
              arriveeDetails: `Dépôt client d'arrivée à ${pubArrivee}`,
              dateChargement: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
              dateLivraison: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
              poids: pubPoids,
              marchandise: pubMarchandise,
              moyenExige: pubMoyen,
              nombreVoyages: 1,
              prixFixe: pubPrix,
              status: OffreStatus.Publie,
              commentaire: pubCommentaire || "Acheminement rapide conforme aux normes NETLOG d'Algérie.",
              codeConfirmation: String(Math.floor(1000 + Math.random() * 9000)),
              dateCreation: new Date().toISOString()
            };

            const updatedOffres = [newOffer, ...offres];
            saveState(undefined, undefined, updatedOffres);
            triggerSystemLog(`Félicitations ! Votre offre de fret ${newId} (Axe: ${pubDepart} ➔ ${pubArrivee}) est publiée en direct sur la bourse de fret !`, "success");
            
            // Redirect to main listing!
            setCurrentTab("accueil");
          };

          return (
            <div className="space-y-6">
              {!isDO ? (
                <div className="bg-white p-8 rounded-3xl border border-rose-100 shadow-md text-center max-w-2xl mx-auto space-y-5">
                  <span className="text-3xl block">🔒</span>
                  <div className="space-y-1.5">
                    <h3 className="font-extrabold text-sm uppercase text-rose-800 tracking-wider">
                      Accès Restreint aux Donneurs d'Ordre
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                      La publication directe d'offres de fret ou de demandes de transport sur la bourse NETLOG nécessite un compte professionnel de type <strong className="text-slate-900">Donneur d'Ordre d'entreprise</strong> (Shipper).
                    </p>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-50 flex flex-col sm:flex-row justify-center gap-3">
                    <button
                      onClick={() => {
                        const targetUser = users.find(u => u.profil === ProfileType.DonneurOrdre) || users[1];
                        setCurrentUser(targetUser);
                        triggerSystemLog(`Connecté en séance d'évaluation en tant que : ${targetUser.raisonSociale}`, "success");
                      }}
                      className="px-5 py-3 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-xs font-black rounded-xl transition cursor-pointer active:scale-95 text-center shadow-sm"
                    >
                      ⚡ Devenir Donneur d'Ordre (SARL BATIMEX)
                    </button>
                    <button
                      onClick={() => setCurrentTab("menu")}
                      className="px-4 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Simuler d'autres comptes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <span className="text-[#D85A30] text-[9px] font-black uppercase tracking-widest block mb-1">
                      NOUVELLE DEMANDE DE FRET ROUTIER
                    </span>
                    <h2 className="text-base font-black text-slate-900 uppercase">
                      Publier une offre sur la bourse NETLOG
                    </h2>
                    <p className="text-[11px] text-slate-500 font-sans mt-0.5 leading-normal">
                      Remplissez les détails logistiques de votre chargement routier. Une fois validée, l'offre apparaîtra aux transporteurs certifiés KYC d'Algérie.
                    </p>
                  </div>

                  <form onSubmit={handleQuickPublishOfferSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Ville de Chargement */}
                      <div className="space-y-1.5 text-xs text-slate-600 font-bold">
                        <label>📍 Ville de Chargement (Départ) *</label>
                        <select 
                          value={pubDepart} 
                          onChange={(e) => setPubDepart(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl font-bold font-sans text-xs focus:ring-[#1D9E75] focus:border-[#1D9E75] cursor-pointer"
                        >
                          {["Alger", "Oran", "Sétif", "Hassi Messaoud", "Béjaïa", "Constantine", "Annaba", "Djelfa", "Tlemcen", "Biskra", "Ghardaïa"].map((w) => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      </div>

                      {/* Ville d'Arrivée */}
                      <div className="space-y-1.5 text-xs text-slate-600 font-bold">
                        <label>🏁 Ville de Déchargement (Destination) *</label>
                        <select 
                          value={pubArrivee} 
                          onChange={(e) => setPubArrivee(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl font-bold font-sans text-xs focus:ring-[#1D9E75] focus:border-[#1D9E75] cursor-pointer"
                        >
                          {["Alger", "Oran", "Sétif", "Hassi Messaoud", "Béjaïa", "Constantine", "Annaba", "Djelfa", "Tlemcen", "Biskra", "Ghardaïa"].map((w) => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Form validators */}
                    {(() => {
                      const isMarchandiseValid = pubMarchandise.trim().length >= 3;
                      const isPoidsValid = pubPoids > 0 && pubPoids <= 100;
                      const isPrixValid = pubPrix >= 5000;
                      const isFormValid = isMarchandiseValid && isPoidsValid && isPrixValid;

                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Mode / Type de Camion */}
                            <div className="space-y-1.5 text-xs text-slate-600 font-bold">
                              <label>🚚 Type de Camion Requis *</label>
                              <select 
                                value={pubMoyen} 
                                onChange={(e) => setPubMoyen(e.target.value as MoyenType)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl font-bold font-sans text-xs focus:ring-[#1D9E75] focus:border-[#1D9E75] cursor-pointer"
                              >
                                {Object.values(MoyenType).map((t) => (
                                  <option key={t} value={t}>{translateMoyenType(t, lang)}</option>
                                ))}
                              </select>
                            </div>

                            {/* Weight */}
                            <div className="space-y-1.5 text-xs text-slate-600 font-bold">
                              <label>⚖️ Poids de la cargaison (T) *</label>
                              <input 
                                type="number" 
                                min={1} 
                                max={100}
                                value={pubPoids} 
                                onChange={(e) => setPubPoids(Number(e.target.value))}
                                className={`w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs outline-none transition-all ${
                                  pubPoids === 0 ? "border-slate-200 focus:border-slate-400" :
                                  isPoidsValid ? "border-emerald-500 focus:border-emerald-600" : "border-rose-500 focus:border-rose-600"
                                }`}
                                required
                              />
                              {pubPoids > 0 && !isPoidsValid && (
                                <p className="text-[10px] text-rose-500 font-bold">⚠️ Entre 1T et 100T max</p>
                              )}
                            </div>

                            {/* Offered target rate */}
                            <div className="space-y-1.5 text-xs text-slate-600 font-bold">
                              <label>💰 Budget d'affrètement (DA) *</label>
                              <input 
                                type="number" 
                                min={5000} 
                                value={pubPrix} 
                                onChange={(e) => setPubPrix(Number(e.target.value))}
                                className={`w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs font-mono text-[#1D9E75] outline-none transition-all ${
                                  pubPrix === 0 ? "border-slate-200 focus:border-slate-400" :
                                  isPrixValid ? "border-emerald-500 focus:border-emerald-600" : "border-rose-500 focus:border-rose-600"
                                }`}
                                required
                              />
                              {pubPrix > 0 && !isPrixValid && (
                                <p className="text-[10px] text-rose-500 font-bold">⚠️ Minimum 5 000 DA requis</p>
                              )}
                            </div>
                          </div>

                          {/* Cargo profile nature & details */}
                          <div className="space-y-1.5 text-xs text-slate-600 font-bold">
                            <label>📦 Nature de la marchandise *</label>
                            <input 
                              type="text" 
                              value={pubMarchandise} 
                              onChange={(e) => setPubMarchandise(e.target.value)}
                              className={`w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs outline-none transition-all ${
                                pubMarchandise.length === 0 ? "border-slate-200 focus:border-slate-400" :
                                isMarchandiseValid ? "border-emerald-500 focus:border-emerald-600" : "border-rose-500 focus:border-rose-600"
                              }`}
                              placeholder="Ex: Produits Agroalimentaires, Blé en vrac, Rond à béton..."
                              required
                            />
                            {pubMarchandise.length > 0 && !isMarchandiseValid && (
                              <p className="text-[10px] text-rose-500 font-bold">⚠️ Saisissez au moins 3 caractères</p>
                            )}
                          </div>

                          {/* Instruction specifics */}
                          <div className="space-y-1.5 text-xs text-slate-600 font-bold font-sans">
                            <label>📝 Instructions particulières, exigences et manutention</label>
                            <textarea 
                              rows={3}
                              value={pubCommentaire} 
                              onChange={(e) => setPubCommentaire(e.target.value)}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl font-semibold text-xs leading-normal"
                              placeholder="Bâchage régulier requis, chauffeur obligatoirement muni de gants et de chaussures de sécurité de chantier..."
                            />
                          </div>

                          {/* Certify regulations */}
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60 text-[10px] text-slate-500 leading-relaxed font-semibold">
                            <p className="font-bold text-slate-700">📜 Charte d'Affrètement NETLOG Algérie :</p>
                            En soumettant cette demande de fret, vous vous engagez à détenir la propriété des biens à transporter ou un mandat licite, et à honorer la facture émise consécutivement au code de validation transmis par votre destinataire lors de la livraison.
                          </div>

                          <button
                            type="submit"
                            disabled={!isFormValid}
                            className={`w-full py-3.5 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-sm transition ${
                              isFormValid ? "bg-[#D85A30] hover:bg-orange-700 active:scale-[0.98]" : "bg-slate-300 cursor-not-allowed opacity-60"
                            }`}
                          >
                            🚀 {isFormValid ? "Publier ma commande de fret" : "Veuillez remplir correctement les champs requis (*)"}
                          </button>
                        </>
                      );
                    })()}
                  </form>
                </div>
              )}
            </div>
          );
        })()}

        {/* ----------------- TAB: OPTIONS DE DÉMONSTRATION & ABONNEMENT (currentTab === "menu") ----------------- */}
        {currentTab === "menu" && (() => {
          const baseMonthlyRate = subSelectedPlan === "free" ? 0 : subSelectedPlan === "premium" ? 4900 : 9900;
          const grossPrice = baseMonthlyRate * subSelectedDuration;
          
          let discountMultiplier = 1;
          let remisePct = 0;
          if (subSelectedDuration === 3) {
            remisePct = 5;
            discountMultiplier = 0.95;
          } else if (subSelectedDuration === 6) {
            remisePct = 10;
            discountMultiplier = 0.90;
          } else if (subSelectedDuration === 12) {
            remisePct = 20;
            discountMultiplier = 0.80;
          }

          const finalPrice = Math.floor(grossPrice * discountMultiplier);
          const savings = grossPrice - finalPrice;

          const handleActivateSubscriptionSelection = () => {
            if (subSelectedPlan === "free") {
              triggerSystemLog("Plan standard d'évaluation activé par défaut (Sans frais).", "info");
              return;
            }
            
            triggerSystemLog(`Fiche de paiement Pro-forma générée ! CCP NETLOG Algérie Clé 52. Abonnement ${subSelectedPlan.toUpperCase()} de ${subSelectedDuration} mois pré-activé.`, "success");
            
            // Build temporary proforma printing element inside active Contract documents view!
            if (setActiveContractDoc) {
              const currentYear = new Date().getFullYear();
              const seqString = String(Math.floor(1000 + Math.random() * 9000));
              const tempSubInvoiceId = `PRO-${currentYear}-${seqString}`;

              // Create arbitrary invoice payload to match contract document view
              const tempSubInvoice: Facture = {
                id: tempSubInvoiceId,
                offreId: "SUB-MEMBERSHIP",
                donneurId: currentUser?.id || "user-do-1",
                transporteurId: currentUser?.id || "user-trans-1",
                montant: finalPrice,
                status: "Facture Transmise" as any,
                prestation: `Abonnement Plateforme NETLOG - Catégorie ${subSelectedPlan.toUpperCase()} (${subSelectedDuration} Mois)`,
                dateEmission: new Date().toISOString().split("T")[0],
              };

              setActiveContractDoc({
                type: "FACTURE",
                offre: {
                  id: "SUB-SYS",
                  donneurRaisonSociale: "NETLOG BOURSE DE FRET ALGÉRIE",
                  depart: "Alger",
                  arrivee: "Alger",
                  dateChargement: "Abonnement",
                  dateLivraison: `Échéance ${subSelectedDuration} Mois`,
                  poids: 0,
                  marchandise: `Formule de service : ${subSelectedPlan.toUpperCase()}`,
                  moyenExige: MoyenType.Tautliner,
                  nombreVoyages: 1,
                  status: OffreStatus.Valide,
                  codeConfirmation: "0000",
                  dateCreation: new Date().toISOString(),
                  prixFixe: finalPrice
                },
                fac: tempSubInvoice
              });
            }
          };

          return (
            <div className="space-y-6">
              
              {/* Menu Sub-Nav Bar - Bento Theme */}
              <div className="flex gap-2 border-b border-slate-100 pb-3 flex-wrap">
                <button
                  onClick={() => setActiveSubTabMenu("profiles")}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition cursor-pointer active:scale-95 ${
                    activeSubTabMenu === "profiles" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  👥 Simulateur d'acteurs (KYC)
                </button>
                <button
                  onClick={() => setActiveSubTabMenu("subscription")}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                    activeSubTabMenu === "subscription" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  💳 Abonnement NETLOG Pro
                  <span className="bg-[#1D9E75] text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">PRO</span>
                </button>
                 <button
                  onClick={() => setActiveSubTabMenu("legals")}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition cursor-pointer active:scale-95 ${
                    activeSubTabMenu === "legals" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📜 Documents légaux & CGU
                </button>
                <button
                  onClick={() => setActiveSubTabMenu("config")}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition cursor-pointer active:scale-95 ${
                    activeSubTabMenu === "config" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ⚙️ {lang === "ar" ? "الإعدادات والمظهر" : "Paramètres & Thème"}
                </button>
              </div>

              {/* 1. SIMULATEUR D'ACTEURS SUB PANELS */}
              {activeSubTabMenu === "profiles" && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
                  <div className="border-b border-slate-50 pb-3">
                    <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest">
                      👥 Portefeuille de démonstration d'acteurs de test
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Basculez instantanément d'un profil métier à un autre pour examiner l'ensemble des modules interactifs, du chargement routier à la facturation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                    {users.map((profileUser) => {
                      const isActive = currentUser?.id === profileUser.id;
                      
                      return (
                        <div 
                          key={profileUser.id} 
                          className={`p-4 rounded-2xl border transition duration-150 flex flex-col justify-between space-y-3 ${
                            isActive ? "border-[#1D9E75] bg-[#E1F5EE]/10 shadow-sm" : "border-slate-100 hover:border-slate-200 bg-white"
                          }`}
                        >
                          <div className="space-y-1">
                            <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              profileUser.profil === ProfileType.Admin ? "bg-indigo-50 text-indigo-800" :
                              profileUser.profil === ProfileType.Commercial ? "bg-orange-50 text-orange-950" :
                              profileUser.profil === ProfileType.DonneurOrdre ? "bg-teal-50 text-[#085041]" :
                              "bg-slate-50 text-slate-800"
                            }`}>
                              {profileUser.profil}
                            </span>
                            <h4 className="font-extrabold text-[12.5px] text-slate-900 leading-tight mt-1">
                              {profileUser.raisonSociale || `${profileUser.prenom} ${profileUser.nom}`}
                            </h4>
                            <p className="font-mono text-[9px] text-slate-400">RC : {profileUser.nrc || "Non requis"}</p>
                            <p className="text-[9.5px] text-slate-500 font-sans leading-relaxed">
                              Wilaya : {profileUser.wilaya || "Algérie"} · {profileUser.email}
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              setCurrentUser(profileUser);
                              
                              if (profileUser.profil === ProfileType.DonneurOrdre) {
                                setCurrentTab("donneur");
                              } else if (profileUser.profil === ProfileType.Transporteur) {
                                setCurrentTab("transporteur");
                              } else if (profileUser.profil === ProfileType.Commercial) {
                                setCurrentTab("commercial");
                              } else if (profileUser.profil === ProfileType.Admin) {
                                setCurrentTab("admin");
                              }
                              triggerSystemLog(`Identité simulée changée pour : ${profileUser.raisonSociale || profileUser.nom}`, "success");
                            }}
                            className={`w-full py-2 text-xs font-bold rounded-lg cursor-pointer transition ${
                              isActive ? "bg-[#1D9E75] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {isActive ? "✓ Identité Active" : "Simuler"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. ABONNEMENT NETLOG PRO VIEWS (MEMBER SPEC) */}
              {activeSubTabMenu === "subscription" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Pricing Matrix choices (7 cols) */}
                  <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-slate-900 uppercase">
                        💳 Matrice d'abonnement réglementaire NETLOG
                      </h3>
                      <p className="text-[11px] text-slate-400 font-sans leading-normal">
                        Les transporteurs d'Algérie doivent souscrire à une formule pour ajouter des véhicules routiers à leur flotte d'affrètement.
                      </p>
                    </div>

                    {/* Choose Formula */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-black tracking-widest text-[#085041] block">
                        Étape 1 : Choisir la formule
                      </span>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: "free", name: "Formule Free", price: "0 DA", desc: "Max 3 Camions", style: "border-slate-200" },
                          { id: "premium", name: "Premium Fleet", price: "4 900 DA/mois", desc: "Max 12 Camions", style: "border-[#1D9E75]" },
                          { id: "gold", name: "Directeur Or", price: "9 900 DA/mois", desc: "Véhicules illimités", style: "border-amber-400" }
                        ].map((formula) => (
                          <div 
                            key={formula.id}
                            onClick={() => setSubSelectedPlan(formula.id as any)}
                            className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between text-center space-y-1 ${
                              subSelectedPlan === formula.id ? `${formula.style} bg-slate-50/50 shadow-xs` : "border-slate-100 hover:border-slate-200 bg-white"
                            }`}
                          >
                            <span className="font-extrabold text-[11px] text-slate-800 block">{formula.name}</span>
                            <span className="font-black text-xs text-slate-900 font-mono block">{formula.price}</span>
                            <span className="text-[9.5px] font-bold text-slate-400 uppercase leading-none">{formula.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Choose Duration */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-black tracking-widest text-[#085041] block">
                        Étape 2 : Durée d'engagement (Économisez jusqu'à 20%)
                      </span>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        {[
                          { val: 1, label: "1 Mois", rate: "Mensuel", disc: "0%" },
                          { val: 3, label: "3 Mois", rate: "Trimestriel", disc: "5% Remise" },
                          { val: 6, label: "6 Mois", rate: "Semestriel", disc: "10% Remise" },
                          { val: 12, label: "12 Mois", rate: "Annuel (Meilleur)", disc: "20% Remise" }
                        ].map((d) => (
                          <div
                            key={d.val}
                            onClick={() => setSubSelectedDuration(d.val as any)}
                            className={`p-3 rounded-2xl border cursor-pointer transition ${
                              subSelectedDuration === d.val ? "border-[#1D9E75] bg-[#E1F5EE]/40 text-slate-900 font-black shadow-xs" : "border-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-50 bg-white"
                            }`}
                          >
                            <span className="block text-[11px] font-extrabold">{d.label}</span>
                            <span className="block text-[9.5px] font-bold text-[#1D9E75] uppercase mt-0.5">{d.disc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pricing Invoice Summary Panel (4 cols) */}
                  <div className="lg:col-span-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-850 shadow-md space-y-6 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="border-b border-slate-800 pb-3">
                        <span className="text-teal-400 font-mono text-[9px] font-black uppercase tracking-wider">
                          📋 CALCUL DE FACTURATION PRO-FORMA
                        </span>
                        <h4 className="text-sm font-black !text-white uppercase mt-0.5">Votre Devis</h4>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 font-bold">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Formule plan :</span>
                          <span className="text-white capitalize">{subSelectedPlan}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Durée :</span>
                          <span className="text-white font-mono">{subSelectedDuration} mois</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Prix de base :</span>
                          <span className="text-white font-mono">{baseMonthlyRate.toLocaleString()} DA/mois</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-800/60 pt-2 text-slate-400">
                          <span>Montant brut total :</span>
                          <span className="font-mono text-white text-xs line-through">{grossPrice.toLocaleString()} DA</span>
                        </div>
                        {remisePct > 0 && (
                          <div className="flex justify-between text-emerald-400 font-bold">
                            <span>Remise appliquée ({remisePct}%) :</span>
                            <span className="font-mono">- {savings.toLocaleString()} DA</span>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-850 pt-3 space-y-1 flex justify-between items-center bg-slate-950/20 p-2 rounded-xl">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Montant Final TTC</span>
                          <span className="text-xl font-black font-mono text-emerald-400">{finalPrice.toLocaleString()} DA</span>
                        </div>
                        <span className="bg-[#1D9E75]/30 text-emerald-300 font-black font-mono text-[9px] px-2.5 py-1 rounded-full border border-teal-500/30">
                          {lang === "ar" ? "جاهز للدفع" : "PRÊT"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleActivateSubscriptionSelection}
                      className="w-full py-3.5 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer text-center"
                    >
                      📄 IMPRIMER PRO-FORMA ET PAYER
                    </button>
                  </div>
                </div>
              )}

              {/* 3. LAW REGULATORY & USER LICENSE AGREEMENT LEGAL PANEL */}
              {activeSubTabMenu === "legals" && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <div className="border-b border-slate-50 pb-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      📜 Mentions Légales, Régulation des Transports et CGU
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      NETLOG est opéré conformément au cahier des charges national algérien régissant les prestataires d'affrètement de fret routier.
                    </p>
                  </div>

                  <div className="text-xs text-slate-650 leading-relaxed space-y-3 font-sans font-medium">
                    <p>
                      <strong>1. Exploitation de la Bourse :</strong> L'accès direct à la plateforme d'affrètement NETLOG est strictement interdit à tout transporteur ne détenant pas de Registre du Commerce algérien (activité transports) valide, ainsi que d'une autorisation réglementaire de circulation délivrée par la wilaya d'immatriculation.
                    </p>
                    <p>
                      <strong>2. Responsabilité Civile Professionnelle :</strong> Chaque chargement validé par le biais de la Lettre de voiture (LDV) réglementaire de transport émise requiert que le transporteur conserve une assurance multirisque de transport de marchandises en cours de validité routière.
                    </p>
                    <p>
                      <strong>3. Solution Administrative BVF :</strong> Les commissionnaires territoriaux en douane ou BVF opèrent à titre d'agents intermédiaires d'état civil de régulation, contrôlant l'authenticité physique des dépôts de garantie lors de la livraison.
                    </p>
                  </div>
                </div>
              )}

              {/* 4. SETTINGS & APP PARAMETERS PANEL */}
              {activeSubTabMenu === "config" && (
                <div className="space-y-6">
                  {/* Bento Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Dark/Light mode theme configurations */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                      <div>
                        <h4 className="text-xs font-black uppercase text-[#1D9E75] tracking-widest">
                          🌓 {lang === "ar" ? "مظهر النظام" : "Mettre à jour le thème"}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {lang === "ar" ? "اختر المظهر المناسب لراحتك البصرية" : "Gérer les préférences d'affichage visuel de l'application"}
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => setDarkMode(false)}
                          className={`flex-1 py-3 px-4 rounded-xl border text-xs font-extrabold cursor-pointer transition-all ${!darkMode ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                        >
                          ☀️ {lang === "ar" ? "نهاري" : "Mode Clair"}
                        </button>
                        <button 
                          onClick={() => setDarkMode(true)}
                          className={`flex-1 py-3 px-4 rounded-xl border text-xs font-extrabold cursor-pointer transition-all ${darkMode ? "bg-[#1D9E75] border-[#1D9E75] text-white shadow-sm" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                        >
                          🌙 {lang === "ar" ? "ليلي" : "Mode Sombre"}
                        </button>
                      </div>
                    </div>

                    {/* Progressive Web App (PWA) installation parameters */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                      <div>
                        <h4 className="text-xs font-black uppercase text-[#378ADD] tracking-widest">
                          📲 {lang === "ar" ? "تثبيت تطبيق NETLOG" : "Installation PWA Mobile"}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {lang === "ar" ? "ثبّت التطبيق على شاشتك الرئيسية للوصول المباشر" : "Accédez à NETLOG directement de votre écran d'accueil sans navigateur"}
                        </p>
                      </div>

                      {deferredPrompt ? (
                        <button 
                          onClick={async () => {
                            if (deferredPrompt) {
                              deferredPrompt.prompt();
                              const { outcome } = await deferredPrompt.userChoice;
                              if (outcome === 'accepted') {
                                showToast(lang === "ar" ? "🎉 شكرًا لتثبيتك التطبيق !" : "🎉 Merci d'avoir installé NETLOG !", "success");
                              }
                              setDeferredPrompt(null);
                            }
                          }}
                          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition-all text-center block"
                        >
                          📥 {lang === "ar" ? "تثبيت الآن" : "Installer l'application NETLOG"}
                        </button>
                      ) : (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] text-slate-500 font-bold border border-slate-100 dark:border-slate-700 leading-normal">
                          {lang === "ar" 
                            ? "✓ تم دمج الخدمة ومتصفحك يدعم التطبيقات التقدمية. التطبيق مثبت أو جاهز للاستخدام الفوري." 
                            : "✓ Service Worker enregistré et actif. L'application est déjà installée sur cet appareil ou est gérée nativement par votre navigateur."}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Automatic numbering counters visualization */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                    <div>
                      <h4 className="text-xs font-black uppercase text-amber-600 tracking-widest">
                        🔢 {lang === "ar" ? "العدادات التلقائية المستمرة" : "Compteurs de Séquençage Automatique"}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {lang === "ar" ? "الأرقام النشطة للمستندات والعمليات المسجلة بـ localStorage" : "Valeurs d'indexation persistées localement pour la génération des bordereaux rattachés"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: lang === "ar" ? "العروض" : "Offres Fret", value: `NET-OFF-${counters.offres}`, key: "offres" },
                        { label: lang === "ar" ? "المهام" : "Missions", value: `NET-MIS-${counters.missions}`, key: "missions" },
                        { label: lang === "ar" ? "الفواتير" : "Factures", value: `NET-FAC-${counters.factures}`, key: "factures" },
                        { label: lang === "ar" ? "رسائل الشحن" : "Lettres de Voiture", value: `NET-LDV-${counters.ldv}`, key: "ldv" },
                      ].map((c) => (
                        <div key={c.key} className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-between text-center space-y-1.5">
                          <span className="text-[9.5px] text-slate-400 font-black uppercase tracking-wider">{c.label}</span>
                          <span className="font-mono text-xs font-black text-[#1D9E75]">{c.value}</span>
                          <button 
                            onClick={() => incrementCounter(c.key as any)}
                            className="text-[9px] font-black text-slate-500 hover:text-slate-900 dark:hover:text-white uppercase tracking-wider underline cursor-pointer bg-transparent border-0"
                          >
                            + {lang === "ar" ? "زيادة" : "Incrémenter"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Informational corporate / Support section */}
                  <div style={{ backgroundColor: '#0f172a' }} className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-md flex flex-col sm:flex-row gap-6 justify-between items-center">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black uppercase tracking-wider text-teal-400 font-mono">NETLOG – Bourse de Fret Algérie v2.1</h4>
                      <p className="text-[10.5px] text-slate-300 leading-normal max-w-xl">
                        Née pour digitaliser les chaînes de valeur de fret lourd méditerranéen vers le Sahara algérien. 
                        NETLOG est la première solution intégrée d'affrètement routier avec KYC.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                      <button 
                        onClick={() => setActiveLegalModal("about")}
                        className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer transition-all"
                      >
                        ℹ️ {lang === "ar" ? "حول المنصة" : "À Propos"}
                      </button>
                      <button 
                        onClick={() => setActiveLegalModal("contact")}
                        className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer transition-all"
                      >
                        📨 Contactez-nous
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* ----------------- TAB: LOGIN PORTAL SELECTOR (currentTab === "login_portal") ----------------- */}
        {currentTab === "login_portal" && (
          <div className="max-w-xl mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="text-center space-y-1">
              <span className="text-3xl block">👤</span>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                Simulateur de Connexion NETLOG
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Sélectionnez l'un de nos profils pré-configurés de test pour accéder instantanément à ses données d'exploitation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users.map((profileUser) => (
                <button
                  key={profileUser.id}
                  onClick={() => {
                    setCurrentUser(profileUser);
                    
                    // Route to correct layout instantly
                    if (profileUser.profil === ProfileType.DonneurOrdre) {
                      setCurrentTab("donneur");
                    } else if (profileUser.profil === ProfileType.Transporteur) {
                      setCurrentTab("transporteur");
                    } else if (profileUser.profil === ProfileType.Commercial) {
                      setCurrentTab("commercial");
                    } else if (profileUser.profil === ProfileType.Admin) {
                      setCurrentTab("admin");
                    }
                    
                    triggerSystemLog(`Bienvenue ! Connecté en tant que : ${profileUser.raisonSociale || profileUser.prenom}`, "success");
                  }}
                  className={`p-4 rounded-2xl border-2 text-left hover:bg-slate-50 cursor-pointer transition space-y-1.5 ${
                    currentUser?.id === profileUser.id ? "border-[#1D9E75] bg-[#E1F5EE]/10" : "border-slate-100 bg-white"
                  }`}
                >
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
                    Profil : {profileUser.profil}
                  </span>
                  <span className="text-xs font-black text-slate-900 leading-tight block">
                    {profileUser.raisonSociale || `${profileUser.prenom} ${profileUser.nom}`}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans block truncate">
                    {profileUser.email}
                  </span>
                  <span className="text-[9px] text-[#1D9E75] font-black uppercase block pt-1">
                    Connecter ➔
                  </span>
                </button>
              ))}
            </div>

            {currentUser && (
              <div className="pt-4 border-t border-slate-100 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  Vous êtes connecté en tant que : <strong className="text-slate-900">{currentUser.raisonSociale || currentUser.nom}</strong>
                </p>
                <button
                  onClick={() => {
                    setCurrentUser(null);
                    setCurrentTab("accueil");
                    triggerSystemLog("Identité réinitialisée.", "info");
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-xs rounded-xl cursor-pointer"
                >
                  Se Déconnecter
                </button>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </main>

      {/* FOOTER DESCR DE FIN DU CAHIER DES CHARGES */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-xs mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="font-sans font-bold text-[#1D9E75]">
            {lang === "ar" ? "NETLOG – بورصة الشحن بالجزائر" : "NETLOG – Bourse de Fret Algérie"}
          </p>
          <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
            {lang === "ar" ? (
              <>
                ربط منظم وقانوني بين المتعاملين في شحن البضائع البري، النقل الخاص والاستثنائي، والخدمات اللوجستية في الجزائر.<br />
                © {new Date().getFullYear()} شركة ذ.م.م NETLOG. مطابق لقوانين شحن واستئجار الطرق الصادرة عن وزارة النقل بالجزائر.
              </>
            ) : (
              <>
                Mise en relation réglementée d'acteurs de fret routier, transports spéciaux, et services logistiques en Algérie.<br />
                © {new Date().getFullYear()} NETLOG Sarl. Conforme aux règles d'affrètement du Ministère des Transports d'Algérie.
              </>
            )}
          </p>
        </div>
      </footer>

      {/* ----------------- MODAL MONTRANT LES CONTRATS ENTIERS IMPRIMABLES ----------------- */}
      {activeContractDoc && (() => {
        const doId = activeContractDoc.offre?.donneurId || activeContractDoc.fac?.donneurId;
        const doUser = users.find(u => u.id === doId) || users[0];
        const prUser = users.find(u => u.id === activeContractDoc.prop?.transporteurId || u.id === activeContractDoc.fac?.transporteurId) || users[1];
        const usedMoyen = moyens.find(m => m.id === activeContractDoc.prop?.moyenId);

        return (
          <ContractDocument
            type={activeContractDoc.type}
            offre={activeContractDoc.offre}
            proposition={activeContractDoc.prop}
            facture={activeContractDoc.fac}
            groupedMissions={activeContractDoc.groupedMissions}
            donneur={doUser}
            prestataire={prUser}
            moyen={usedMoyen}
            lang={lang}
            onClose={() => setActiveContractDoc(null)}
            onSimulateScan={(id) => {
              setActiveContractDoc(null);
              setTrackedOffreId(id);
              // Clear previous inputs
              setTrackerReserves("");
              setTrackerNoReserves(true);
            }}
          />
        );
      })()}

      {/* ----------------- MODAL DE SUIVI ET D'ACQUITTEMENT QR CODE ----------------- */}
      {trackedOffreId && (() => {
        const trackedOffre = offres.find(o => o.id === trackedOffreId);
        if (!trackedOffre) {
          return (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-100 text-center space-y-4">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xl mx-auto animate-spin">
                  ⏳
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Recherche de la livraison en cours...</h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Chiffrement de la liaison de transit en direct. Récupération des informations de l'expédition #{trackedOffreId}...
                </p>
                <button 
                  onClick={() => setTrackedOffreId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer border-none"
                >
                  Fermer
                </button>
              </div>
            </div>
          );
        }

        const doUser = users.find(u => u.id === trackedOffre.donneurId) || users.find(u => u.profil === ProfileType.DonneurOrdre) || users[0];
        const transporteurUser = users.find(u => u.profil === ProfileType.Transporteur) || users[1];
        const caniveauMoyen = moyens.find(m => m.transporteurId === transporteurUser.id) || moyens[0];

        const handleValidateLoading = () => {
          const updated = offres.map(o => {
            if (o.id === trackedOffre.id) {
              return { ...o, status: OffreStatus.Charge };
            }
            return o;
          });
          saveState(undefined, undefined, updated);
          setSystemLog({
            text: `Chargement de l'expédition ${trackedOffre.id} validé avec succès ! Statut mis à jour : "Sur la route".`,
            type: "success"
          });
        };

        const handleValidateDelivery = (hasReserves: boolean) => {
          const reservesText = hasReserves ? trackerReserves.trim() : "";
          const updated = offres.map(o => {
            if (o.id === trackedOffre.id) {
              return { 
                ...o, 
                status: OffreStatus.Valide, 
                reserves: reservesText 
              };
            }
            return o;
          });
          saveState(undefined, undefined, updated);
          setSystemLog({
            text: hasReserves 
              ? `Déchargement de l'expédition ${trackedOffre.id} validé avec réserves consignées : "${reservesText}".`
              : `Déchargement de l'expédition ${trackedOffre.id} validé sans réserve. Livraison close !`,
            type: "success"
          });
        };

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden flex flex-col my-4 max-h-[92vh]">
              
              {/* Header */}
              <div className="bg-slate-950 text-white p-5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#1D9E75] flex items-center justify-center text-white font-black text-sm">
                    🛰️
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#1D9E75]">
                      Suivi d'Expédition Logistique Routière
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400">
                      RÉGULATION DES FLUX • CODE UNIQUE : {trackedOffre.id}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setTrackedOffreId(null)}
                  className="p-1 px-2.5 text-slate-400 hover:text-white bg-slate-900 rounded-xl hover:bg-slate-850 active:scale-95 transition-all text-xs font-black cursor-pointer"
                >
                  ✕ Fermer
                </button>
              </div>

              {/* Body */}
              <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6 text-slate-800 text-xs">
                
                {/* Visual Tracker Timeline */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <h4 className="font-extrabold uppercase text-[#085041] mb-4 text-[10px] tracking-wide border-b border-slate-200 pb-1.5 flex justify-between items-center">
                    <span>TIMELINE DE LIVRAISON</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono rounded text-[8px] font-bold">
                      {trackedOffre.status.toUpperCase()}
                    </span>
                  </h4>

                  <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-2">
                    
                    {/* Step 1: Attribué */}
                    <div className="flex items-center gap-3 md:flex-col md:text-center md:flex-1 relative z-10">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black">
                        ✓
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-[11px]">Étape 1 : Attribué</p>
                        <p className="text-[9px] text-slate-500 font-medium">Contrat signé transporteur</p>
                      </div>
                    </div>

                    <div className="hidden md:block h-0.5 bg-slate-200 flex-1 mx-2" />

                    {/* Step 2: Chargé */}
                    {trackedOffre.status === OffreStatus.Attribue || trackedOffre.status === OffreStatus.Publie ? (
                      <div className="flex items-center gap-3 md:flex-col md:text-center md:flex-1 relative z-10 opacity-70">
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold">
                          2
                        </div>
                        <div>
                          <p className="font-black text-slate-700 text-[11px]">Étape 2 : Chargement</p>
                          <p className="text-[9px] text-amber-600 font-bold">En attente de chargement</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 md:flex-col md:text-center md:flex-1 relative z-10">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black">
                          ✓
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-[11px]">Étape 2 : Chargement</p>
                          <p className="text-[9px] text-emerald-600 font-semibold">Marchandise chargée</p>
                        </div>
                      </div>
                    )}

                    <div className={`hidden md:block h-0.5 flex-1 mx-2 ${
                      trackedOffre.status === OffreStatus.Charge || trackedOffre.status === OffreStatus.Decharge || trackedOffre.status === OffreStatus.Valide ? "bg-emerald-600" : "bg-slate-200"
                    }`} />

                    {/* Step 3: Déchargé & Validé */}
                    {trackedOffre.status === OffreStatus.Valide || trackedOffre.status === OffreStatus.Decharge ? (
                      <div className="flex items-center gap-3 md:flex-col md:text-center md:flex-1 relative z-10">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black">
                          ✓
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-[11px]">Étape 3 : Arrivée</p>
                          <p className="text-[9px] text-emerald-600 font-semibold">Livre & Acquitté</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 md:flex-col md:text-center md:flex-1 relative z-10 opacity-50">
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold">
                          3
                        </div>
                        <div>
                          <p className="font-black text-slate-700 text-[11px]">Étape 3 : Arrivée</p>
                          <p className="text-[9px] text-slate-400 font-medium">Contrôle à quai</p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Info Card with Cargo details */}
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div className="p-3.5 border border-slate-150 rounded-xl bg-slate-50 space-y-1">
                    <strong className="text-slate-400 text-[9px] uppercase tracking-wider block">DÉPART (EXPÉDITEUR)</strong>
                    <div className="text-slate-900 font-bold">{trackedOffre.depart}</div>
                    <div className="text-slate-500 text-[10px] leading-tight mt-0.5">{trackedOffre.departDetails || "Port National"}</div>
                    <div className="text-[#1D9E75] font-black text-[9px] mt-1.5 uppercase">DO : {doUser.raisonSociale}</div>
                  </div>

                  <div className="p-3.5 border border-slate-150 rounded-xl bg-slate-50 space-y-1">
                    <strong className="text-slate-400 text-[9px] uppercase tracking-wider block">ARRIVÉE (DESTINATAIRE)</strong>
                    <div className="text-slate-900 font-bold">{trackedOffre.arrivee}</div>
                    <div className="text-slate-500 text-[10px] leading-tight mt-0.5">{trackedOffre.arriveeDetails || "Zone Industrielle"}</div>
                    <div className="text-[#1D9E75] font-black text-[9px] mt-1.5 uppercase">CODE OTP VAL: {trackedOffre.codeConfirmation}</div>
                  </div>
                </div>

                <div className="p-4 border border-slate-150 rounded-2xl bg-[#E1F5EE]/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 leading-normal">
                    <span className="text-[9px] text-slate-400 uppercase font-black block">Description du Cargo</span>
                    <strong className="text-slate-900 text-xs">📦 {trackedOffre.marchandise}</strong>
                    <div className="text-slate-500 font-medium text-[10.5px]">Moyen requis : {trackedOffre.moyenExige} • Poids : <b>{trackedOffre.poids} tonnes</b></div>
                  </div>

                  <div className="space-y-1 leading-normal">
                    <span className="text-[9px] text-slate-400 uppercase font-black block">Prestataire et Camion</span>
                    <strong className="text-slate-900 text-xs">🚛 {transporteurUser.raisonSociale}</strong>
                    <div className="text-slate-500 font-medium text-[10.5px]">Plaque d'immatr. : <b className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">{caniveauMoyen?.immatriculation || "012356-116-31"}</b></div>
                  </div>
                </div>

                {/* ACTIVE OPERATION MODULE */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs bg-white">
                  <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    ⚙️ MODULE DE CONTROLE ACTIF ({trackedOffre.status})
                  </h4>

                  {/* Operational Controls based on currentState */}
                  {(trackedOffre.status === OffreStatus.Attribue || trackedOffre.status === OffreStatus.Publie) && (
                    <div className="space-y-3.5">
                      <div className="bg-emerald-50 text-emerald-950 p-3.5 rounded-xl text-xs font-medium border border-emerald-100 leading-normal">
                        <strong>📌 Instruction de chargement :</strong> Le transporteur est arrivé au quai d'enlèvement. Veuillez inspecter la marchandise à charger puis cliquez sur le bouton de validation ci-dessous pour confirmer la prise en charge et le départ de l'expédition.
                      </div>
                      
                      <button
                        onClick={handleValidateLoading}
                        className="w-full py-3 bg-[#1D9E75] hover:bg-[#085041] active:scale-95 text-white text-xs font-black uppercase rounded-xl transition cursor-pointer shadow-md text-center flex items-center justify-center gap-1.5 border-none"
                      >
                        📦 Confirmer et valider le Chargement
                      </button>
                    </div>
                  )}

                  {trackedOffre.status === OffreStatus.Charge && (
                    <div className="space-y-4">
                      <div className="bg-amber-50 text-amber-950 p-3.5 rounded-xl font-medium border border-amber-200/50 leading-normal">
                        <strong>📌 Instruction de livraison de destination :</strong> Le camion s'est présenté au quai de déchargement. Veuillez procéder à la vérification physique des colis et de l'état de la cargaison. Si vous constatez des dommages ou manquants, renseignez les réserves écrites ci-dessous avant d'acquitter, sinon valisez directement.
                      </div>

                      {/* Reserves inputs */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-bold">
                          <label className="text-slate-700">Mentionner des réserves (optionnel)</label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[#D85A30]">
                            <input 
                              type="checkbox" 
                              checked={!trackerNoReserves}
                              onChange={(e) => {
                                setTrackerNoReserves(!e.target.checked);
                                if (!e.target.checked) setTrackerReserves("");
                              }}
                              className="accent-[#D85A30]"
                            />
                            <span>Anomalies constatées ?</span>
                          </label>
                        </div>
                        
                        {!trackerNoReserves && (
                          <textarea
                            value={trackerReserves}
                            onChange={(e) => setTrackerReserves(e.target.value)}
                            placeholder="Écrivez ici les réserves de livraison (ex: Rupture de 3 sacs de ciment, humidité sur la palette N° 12...)"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1D9E75] text-[11px]"
                            rows={3}
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <button
                          onClick={() => handleValidateDelivery(false)}
                          className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-xl transition cursor-pointer shadow flex items-center justify-center gap-1.5 border-none"
                        >
                          ✅ Valider sans Réserve (Conforme)
                        </button>

                        <button
                          onClick={() => handleValidateDelivery(true)}
                          disabled={!trackerNoReserves && !trackerReserves.trim()}
                          className={`py-3 text-white text-xs font-black uppercase rounded-xl transition shadow flex items-center justify-center gap-1.5 border-none ${
                            !trackerNoReserves && trackerReserves.trim() 
                              ? "bg-[#D85A30] hover:bg-rose-700 cursor-pointer" 
                              : "bg-slate-300 cursor-not-allowed opacity-60 text-slate-500"
                          }`}
                        >
                          ⚠️ Valider avec réserves
                        </button>
                      </div>
                    </div>
                  )}

                  {(trackedOffre.status === OffreStatus.Valide || trackedOffre.status === OffreStatus.Decharge) && (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center space-y-3">
                      <div className="text-3xl">🎉</div>
                      <h5 className="font-extrabold text-emerald-800 text-xs uppercase text-center">
                        EXPÉDITION CLÔTURÉE ET ACQUITTÉE AVEC SUCCÈS !
                      </h5>
                      <p className="font-medium text-emerald-950 leading-normal max-w-md mx-auto text-center">
                        {trackedOffre.reserves 
                          ? `Cette expédition a été dûment déchargée avec les réserves suivantes : "${trackedOffre.reserves}".`
                          : "Le déchargement à quai s'est déroulé en parfaite conformité, sans aucune réserve formulée."}
                      </p>
                      <div className="text-[10px] font-mono text-slate-500 font-semibold pt-1 border-t border-emerald-200/50 text-center">
                        Code d'authentification numérique unique : {trackedOffre.codeConfirmation}-OK
                      </div>
                    </div>
                  )}

                </div>

                {/* Sub action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Toggle to visual printable ContractDocument
                      setActiveContractDoc({
                        type: "LETTRE-VOITURE",
                        offre: trackedOffre
                      });
                      // Don't close tracker so they can return to it if needed
                    }}
                    className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-extrabold uppercase rounded-xl transition cursor-pointer text-center border-none"
                  >
                    📄 Afficher la Lettre de voiture actualisée
                  </button>
                  <button
                    onClick={() => setTrackedOffreId(null)}
                    className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase rounded-xl transition cursor-pointer border-none"
                  >
                    Fermer la console
                  </button>
                </div>

              </div>
              
              {/* Footer */}
              <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[10px] text-slate-400 font-mono">
                Portail de validation décentralisé NETLOG DZ • Conforme à la trace électronique routière algérienne.
              </div>

            </div>
          </div>
        );
      })()}

      {/* ----------------- MODAL D'INSCRIPTION ULTRA-POLI MULTI-ÉTAPES ----------------- */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 border border-slate-100 max-h-[92vh] overflow-y-auto shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase text-[#085041] tracking-wider">
                  {lang === "ar" ? "إنشاء حساب مهني NETLOG" : "Rejoindre le Réseau Pro NETLOG"}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {regStep === 1 
                    ? (lang === "ar" ? "خطوة 1: اختر نوع حسابك" : "Étape 1 sur 2 : Choisissez votre profil d'activité")
                    : (lang === "ar" ? "خطوة 2: أدخل معلوماتك الشخصية والمهنية" : "Étape 2 sur 2 : Informations d'enregistrement")}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowRegisterModal(false);
                  setRegStep(1);
                }}
                className="p-1 px-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ÉTAPE 1 : CHOIX DU PROFIL */}
            {regStep === 1 && (
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-700 text-center mb-2">
                  {lang === "ar" ? "ما هو قطاع نشاطك الرئيسي في المنصة؟" : "Quel est le profil qui décrit le mieux votre activité ?"}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Option 1: Donneur d'Ordre */}
                  <div 
                    onClick={() => setRegProfil(ProfileType.DonneurOrdre)}
                    className={`p-4 rounded-xl border-2 text-center cursor-pointer transition-all space-y-2 relative overflow-hidden select-none ${
                      regProfil === ProfileType.DonneurOrdre 
                        ? "border-[#1D9E75] bg-[#E1F5EE]/40 ring-1 ring-[#1D9E75]" 
                        : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <div className="text-3xl">🏭</div>
                    <h4 className="font-extrabold text-xs text-slate-900">Donneur d'Ordre (DO)</h4>
                    <p className="text-[10px] text-slate-500 leading-normal font-medium">
                      Entreprises, PME, commerçants ou particuliers ayant du fret à faire transporter sur l'Algérie.
                    </p>
                    {regProfil === ProfileType.DonneurOrdre && (
                      <span className="absolute top-2 right-2 w-3 h-3 bg-[#1D9E75] rounded-full ring-2 ring-white"></span>
                    )}
                  </div>

                  {/* Option 2: Transporteur */}
                  <div 
                    onClick={() => setRegProfil(ProfileType.Transporteur)}
                    className={`p-4 rounded-xl border-2 text-center cursor-pointer transition-all space-y-2 relative overflow-hidden select-none ${
                      regProfil === ProfileType.Transporteur 
                        ? "border-[#1D9E75] bg-[#E1F5EE]/40 ring-1 ring-[#1D9E75]" 
                        : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <div className="text-3xl">🚛</div>
                    <h4 className="font-extrabold text-xs text-slate-900">Transporteur Routier</h4>
                    <p className="text-[10px] text-slate-500 leading-normal font-medium">
                      Camionneurs indépendants, artisans-transporteurs ou entreprises de logistique avec flotte.
                    </p>
                    {regProfil === ProfileType.Transporteur && (
                      <span className="absolute top-2 right-2 w-3 h-3 bg-[#1D9E75] rounded-full ring-2 ring-white"></span>
                    )}
                  </div>

                  {/* Option 3: Commercial BVF */}
                  <div 
                    onClick={() => setRegProfil(ProfileType.Commercial)}
                    className={`p-4 rounded-xl border-2 text-center cursor-pointer transition-all space-y-2 relative overflow-hidden select-none ${
                      regProfil === ProfileType.Commercial 
                        ? "border-[#1D9E75] bg-[#E1F5EE]/40 ring-1 ring-[#1D9E75]" 
                        : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <div className="text-3xl">💼</div>
                    <h4 className="font-extrabold text-xs text-slate-900">Commercial BVF</h4>
                    <p className="text-[10px] text-slate-500 leading-normal font-medium">
                      Agent commercial indépendant de NETLOG, apporteurs d'affaires et recruteurs connectés.
                    </p>
                    {regProfil === ProfileType.Commercial && (
                      <span className="absolute top-2 right-2 w-3 h-3 bg-[#1D9E75] rounded-full ring-2 ring-white"></span>
                    )}
                  </div>

                  {/* Option 4: Manutentionnaire */}
                  <div 
                    onClick={() => setRegProfil(ProfileType.Manutentionnaire)}
                    className={`p-4 rounded-xl border-2 text-center cursor-pointer transition-all space-y-2 relative overflow-hidden select-none ${
                      regProfil === ProfileType.Manutentionnaire 
                        ? "border-[#1D9E75] bg-[#E1F5EE]/40 ring-1 ring-[#1D9E75]" 
                        : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <div className="text-3xl">🏗️</div>
                    <h4 className="font-extrabold text-xs text-slate-900">Manutentionnaire</h4>
                    <p className="text-[10px] text-slate-500 leading-normal font-medium">
                      Prestataires de manutention : grues, chariots élévateurs, pelles, nacelles.
                    </p>
                    {regProfil === ProfileType.Manutentionnaire && (
                      <span className="absolute top-2 right-2 w-3 h-3 bg-[#1D9E75] rounded-full ring-2 ring-white"></span>
                    )}
                  </div>

                  {/* Option 5: Commissionnaire */}
                  <div 
                    onClick={() => setRegProfil(ProfileType.Commissionnaire)}
                    className={`p-4 rounded-xl border-2 text-center cursor-pointer transition-all space-y-2 relative overflow-hidden select-none ${
                      regProfil === ProfileType.Commissionnaire 
                        ? "border-[#1D9E75] bg-[#E1F5EE]/40 ring-1 ring-[#1D9E75]" 
                        : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <div className="text-3xl">🗂️</div>
                    <h4 className="font-extrabold text-xs text-slate-900">Transitaire / Commissionnaire</h4>
                    <p className="text-[10px] text-slate-500 leading-normal font-medium">
                      Organise les transports et gère son propre répertoire de transporteurs de confiance.
                    </p>
                    {regProfil === ProfileType.Commissionnaire && (
                      <span className="absolute top-2 right-2 w-3 h-3 bg-[#1D9E75] rounded-full ring-2 ring-white"></span>
                    )}
                  </div>

                  {/* La carte "Administrateur NETLOG" déblocable par code secret
                      (Admin@2025 / bvf-admin) a été retirée : un compte admin
                      ne doit jamais pouvoir être créé depuis l'inscription
                      publique, code secret ou non. Le premier compte admin
                      s'amorce via SQL directement sur Supabase (voir procédure
                      d'amorçage), les suivants sont promus par un admin existant. */}
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setRegStep(2)}
                    className="px-5 py-2.5 bg-[#1D9E75] text-white rounded-lg text-xs font-bold hover:bg-[#085041] transition-all cursor-pointer flex items-center gap-1 shadow-md"
                  >
                    <span>Continuer l'inscription</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 2 : INFORMATIONS PERSONNELLES */}
            {regStep === 2 && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs font-semibold">
                
                {/* 1. Champs Communs */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100/60">
                  <span className="text-[10px] font-extrabold text-[#085041] uppercase tracking-wide block mb-2 border-b pb-1">
                    👥 Informations Communes
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Nom *</label>
                      <input 
                        type="text" 
                        required 
                        value={regNom} 
                        onChange={(e) => setRegNom(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#1D9E75] bg-white"
                        placeholder="Ex: Babassi"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Prénom *</label>
                      <input 
                        type="text" 
                        required 
                        value={regPrenom} 
                        onChange={(e) => setRegPrenom(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#1D9E75] bg-white"
                        placeholder="Ex: Kamel"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Numéro de téléphone *</label>
                      <input 
                        type="tel" 
                        required 
                        placeholder="05 55 12 34 56"
                        value={regTel} 
                        onChange={(e) => setRegTel(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                      />
                      <span className="text-[9px] text-slate-400 font-medium">Format DZ à 10 chiffres</span>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Adresse Email *</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="nom@exemple.dz"
                        value={regEmail} 
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Wilaya *</label>
                      <select 
                        value={regWilaya}
                        onChange={(e) => setRegWilaya(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer font-sans"
                      >
                        {wilayas.map(w => (
                          <option key={w.code} value={w.fr}>
                            {String(w.code).padStart(2, '0')} - {w.fr} ({w.ar})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Adresse complète *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="N°, rue, quartier..."
                        value={regAdresse} 
                        onChange={(e) => setRegAdresse(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Mot de passe * (min 8 car.)</label>
                      <input 
                        type={showPassword ? "text" : "password"}
                        required 
                        placeholder="••••••••"
                        value={regPassword} 
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                      />
                      {/* Strength indicator */}
                      {regPassword && (
                        <div className="mt-1 flex items-center gap-1">
                          <div className={`h-1.5 w-12 rounded ${getPasswordStrength(regPassword).color}`}></div>
                          <span className={`text-[9px] font-bold ${getPasswordStrength(regPassword).text}`}>
                            Force : {getPasswordStrength(regPassword).label}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Confirmer mot de passe *</label>
                      <input 
                        type={showPassword ? "text" : "password"}
                        required 
                        placeholder="••••••••"
                        value={regPasswordConfirm} 
                        onChange={(e) => setRegPasswordConfirm(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2">
                    <input 
                      type="checkbox" 
                      id="viewPwdReg"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <label htmlFor="viewPwdReg" className="text-[10px] text-slate-500 font-medium select-none cursor-pointer">
                      Afficher les mots de passe
                    </label>
                  </div>
                </div>

                {/* 2. Champs spécifiques DONNEUR D'ORDRE (DO) */}
                {regProfil === ProfileType.DonneurOrdre && (
                  <div className="bg-blue-50/50 p-3.5 rounded-lg border border-blue-100">
                    <span className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wide block mb-2 border-b border-blue-100 pb-1">
                      🏭 Informations Donneur d'Ordre (DO)
                    </span>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Type d'entité *</label>
                        <div className="flex gap-4">
                          {["Entreprise", "Commerçant", "Particulier"].map(v => (
                            <label key={v} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                              <input 
                                type="radio" 
                                name="doTypeEnt"
                                checked={regDoTypeEntite === v} 
                                onChange={() => setRegDoTypeEntite(v)}
                                className="text-[#1D9E75] focus:ring-0"
                              />
                              <span>{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {regDoTypeEntite !== "Particulier" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">Raison sociale *</label>
                            <input 
                              type="text" 
                              required={regDoTypeEntite !== "Particulier"}
                              placeholder="Ex: Sarl Batimex ou Distributeur Kamel"
                              value={regDoRaisonSociale}
                              onChange={(e) => setRegDoRaisonSociale(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">N° Registre du Commerce (RC)</label>
                            <input 
                              type="text" 
                              placeholder="Ex: 16/00-0987654 B 20"
                              value={regDoRC}
                              onChange={(e) => setRegDoRC(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                            />
                            <p className="text-[9px] text-slate-400 font-medium">Format: XX/XX-XXXXXXX B XX</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] text-slate-500 mb-0.5">NIF (Optionnel)</label>
                          <input 
                            type="text" 
                            placeholder="Identifiant fiscal"
                            value={regDoNIF}
                            onChange={(e) => setRegDoNIF(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Secteur d'activité</label>
                          <select 
                            value={regDoSecteur}
                            onChange={(e) => setRegDoSecteur(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer font-sans"
                          >
                            {["BTP", "Agroalimentaire", "Commerce", "Industrie", "Services", "Autre"].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Volume de fret /mois</label>
                          <select 
                            value={regDoVolume}
                            onChange={(e) => setRegDoVolume(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer font-sans"
                          >
                            {["< 5 camions", "5-20 camions", "> 20 camions"].map(vo => (
                              <option key={vo} value={vo}>{vo}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Champs spécifiques TRANSPORTEUR */}
                {regProfil === ProfileType.Transporteur && (
                  <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-100">
                    <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wide block mb-2 border-b border-emerald-100 pb-1">
                      🚛 Informations Transporteur Routier
                    </span>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Type d'entité *</label>
                        <div className="flex gap-4">
                          {["Artisan transporteur", "Entreprise de transport"].map(v => (
                            <label key={v} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                              <input 
                                type="radio" 
                                name="transTypeEnt"
                                checked={regTransTypeEntite === v} 
                                onChange={() => setRegTransTypeEntite(v)}
                                className="text-[#1D9E75] focus:ring-0"
                              />
                              <span>{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {regTransTypeEntite === "Entreprise de transport" && (
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">Raison sociale (Entreprise) *</label>
                            <input 
                              type="text" 
                              required={regTransTypeEntite === "Entreprise de transport"}
                              placeholder="Ex: SARL TRANS ALGER"
                              value={regTransRaisonSociale}
                              onChange={(e) => setRegTransRaisonSociale(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </div>
                        )}

                        <div className={regTransTypeEntite !== "Entreprise de transport" ? "sm:col-span-2" : ""}>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Numéro RC *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="Format: XX/XX-XXXXXXX A 16"
                            value={regTransRC}
                            onChange={(e) => setRegTransRC(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Autorisation de transport</label>
                          <input 
                            type="text" 
                            placeholder="N° Agrément Ministère"
                            value={regTransAutorisation}
                            onChange={(e) => setRegTransAutorisation(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Camions disponibles</label>
                          <select 
                            value={regTransNbCamions}
                            onChange={(e) => setRegTransNbCamions(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer font-sans"
                          >
                            {["1", "2-5", "6-20", "> 20"].map(ca => (
                              <option key={ca} value={ca}>{ca} camion(s)</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Wilaya principale d'activité</label>
                          <select 
                            value={regTransWilayaActivite}
                            onChange={(e) => setRegTransWilayaActivite(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer font-sans"
                          >
                            {wilayas.map(w => (
                              <option key={w.code} value={w.fr}>{w.fr}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Champs spécifiques COMMERCIAL BVF */}
                {regProfil === ProfileType.Commercial && (
                  <div className="bg-orange-50/50 p-3.5 rounded-lg border border-orange-100">
                    <span className="text-[10px] font-extrabold text-orange-950 uppercase tracking-wide block mb-2 border-b border-orange-100 pb-1">
                      💼 Informations Commercial BVF Agent
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Diplôme / Niveau d'études</label>
                        <select 
                          value={regCommDiplome}
                          onChange={(e) => setRegCommDiplome(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer font-sans"
                        >
                          {["Bac", "BTS", "Licence", "Master", "Sans diplôme"].map(di => (
                            <option key={di} value={di}>{di}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Expérience dans le transport ?</label>
                        <div className="flex gap-4 pt-1">
                          {["Oui", "Non"].map(v => (
                            <label key={v} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                              <input 
                                type="radio" 
                                name="commExp"
                                checked={regCommExperience === v} 
                                onChange={() => setRegCommExperience(v)}
                                className="text-[#D85A30] focus:ring-0"
                              />
                              <span>{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Wilaya d'intervention principale</label>
                        <select 
                          value={regCommWilayaInterv}
                          onChange={(e) => setRegCommWilayaInterv(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer font-sans"
                        >
                          {wilayas.map(w => (
                            <option key={w.code} value={w.fr}>{w.fr}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Comment nous avez-vous connus ?</label>
                        <input 
                          type="text" 
                          placeholder="Recommandation, Réseaux, Web..."
                          value={regCommSource}
                          onChange={(e) => setRegCommSource(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {regProfil === ProfileType.Manutentionnaire && (
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-extrabold text-[#085041] uppercase tracking-wide block mb-2 border-b pb-1">
                      🏗️ Informations d'activité de manutention
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Raison sociale *</label>
                        <input
                          type="text" required placeholder="ex: Manutention Alger SARL"
                          value={regManRaisonSociale} onChange={(e) => setRegManRaisonSociale(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">N° Registre de Commerce (RC) *</label>
                        <input
                          type="text" required placeholder="ex: 16/00-0943521B21"
                          value={regManRC} onChange={(e) => setRegManRC(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Type d'engin principal *</label>
                        <select
                          value={regManTypesEngins[0]} onChange={(e) => setRegManTypesEngins([e.target.value])}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer"
                        >
                          {["Grue", "Chariot élévateur", "Pelle", "Chargeuse", "Nacelle", "Autre"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Wilaya d'activité principale *</label>
                        <select
                          value={regManWilayaActivite} onChange={(e) => setRegManWilayaActivite(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer"
                        >
                          {wilayas.map(w => (
                            <option key={w.code} value={w.fr}>{w.fr}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Validation CGU */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px] leading-relaxed flex items-start gap-2 select-none">
                  <input 
                    type="checkbox" 
                    id="acceptCGUID"
                    required
                    checked={regAcceptCGU}
                    onChange={(e) => setRegAcceptCGU(e.target.checked)}
                    className="mt-0.5 h-4 w-4 text-[#1D9E75] border-slate-300 rounded focus:ring-0 cursor-pointer"
                  />
                  <div className="text-slate-600 font-medium">
                    <label htmlFor="acceptCGUID" className="cursor-pointer">
                      J'accepte sans réserve les <strong className="text-slate-800">Conditions Générales d'Utilisation</strong> de la bourse de fret NETLOG en Algérie. *
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setShowCGUModal(true)}
                      className="ml-1 text-[#1D9E75] hover:underline font-bold bg-transparent border-0 cursor-pointer"
                    >
                      (Lire le résumé des CGU)
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-bold uppercase tracking-wide cursor-pointer"
                  >
                    ← Retour
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-3 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-xl transition-colors font-bold uppercase tracking-wide cursor-pointer text-center shadow-md"
                  >
                    Créer mon compte →
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ----------------- MODAL DE CONNEXION INDÉPENDANT ----------------- */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-slate-100 shadow-2xl relative">
            <div className="text-center relative">
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginPassword("");
                }}
                className="absolute -top-1 -right-1 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="inline-flex p-3 bg-[#E1F5EE] text-[#1D9E75] rounded-full text-xl mb-1">
                🚛
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#085041]">{lang === "ar" ? "تسجيل الدخول إلى NETLOG" : "Connexion à NETLOG"}</h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Bourse de fret leader & sécurisée en Algérie
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs font-semibold">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Adresse email *</label>
                <input 
                  type="email" 
                  required
                  placeholder="nom@exemple.dz"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Mot de passe *</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-2.5 py-2 pr-9 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-xl transition-colors text-xs font-bold uppercase tracking-wider text-center shadow-md cursor-pointer mt-2"
              >
                Se connecter →
              </button>
            </form>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-center text-[11px]">
              <button 
                onClick={() => triggerSystemLog("Demande de réinitialisation transmise à l'administrateur. Un email de récupération vous sera envoyé sous peu.", "info")}
                className="text-slate-500 hover:underline font-bold block mx-auto bg-transparent border-0 cursor-pointer"
              >
                Mot de passe oublié ?
              </button>
              
              <div className="text-slate-300 text-[10px] uppercase font-bold tracking-widest py-1">
                ─── ou ───
              </div>

              <div className="text-slate-600 font-medium">
                Pas encore de compte ?{" "}
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    setShowRegisterModal(true);
                  }}
                  className="text-[#1D9E75] hover:underline font-bold bg-transparent border-0 cursor-pointer"
                >
                  S'inscrire gratuitement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL CGU SECONDAIRE ----------------- */}
      {showCGUModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-100 shadow-2xl relative">
            <h3 className="text-xs font-black uppercase text-[#085041] tracking-wider border-b pb-2">
              Conditions Générales d'Utilisation
            </h3>
            <div className="text-[11px] leading-relaxed text-slate-600 font-medium max-h-[50vh] overflow-y-auto space-y-2.5 p-1 pr-2">
              <p>
                <strong>1. Objet :</strong> NETLOG est une plateforme numérique de mise en relation de fret routier, d'affrètement national de marchandises et de services logistiques réglementés en Algérie.
              </p>
              <p>
                <strong>2. Certifications requises :</strong> Les transporteurs s'engagent à fournir des registres de commerce (RC) valides ainsi que des autorisations ministérielles réglementaires de transport routier.
              </p>
              <p>
                <strong>3. Sécurité des cargaisons :</strong> Le suivi du déchargement est validé de manière asymétrique par un code unique de confirmation partagé exclusivement entre le donneur d'ordre et le transporteur assigné.
              </p>
              <p>
                <strong>4. Tarifs et Commissions :</strong> Les propositions tarifaires sont fermes après acceptation d'une soumission. Les commerciaux agréés perçoivent une commission légale de 200 DA (portefeuille transporteur) ou 500 DA (portefeuille donneur d'ordre) par transaction validée.
              </p>
              <p>
                <strong>5. Validation Administrative :</strong> Tout compte nouvellement inscrit fait l'objet d'une analyse administrative sous 24h par l'équipe support NETLOG.
              </p>
            </div>
            <div className="pt-2 text-right">
              <button
                onClick={() => setShowCGUModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fermer & Revenir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FORMULAIRE SOUMISSION PROPOSITION MODAL (LOGIGRAPME COMPATIBILITÉ) --- */}
      {selectedOffreForBid && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 border border-slate-100 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider font-sans">
                {lang === "ar" ? "تقديم عرض سعر الشحن" : "Proposer une Cotation Logistique"}
              </h3>
              <button 
                onClick={() => setSelectedOffreForBid(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishBid} className="space-y-4 text-xs">
              
              {/* Rappel de l'offre */}
              <div className="p-3 bg-[#1D9E75]/10 rounded-lg space-y-1">
                <p className="font-extrabold text-slate-950 text-xs">
                  🌍 {translateCity(selectedOffreForBid.depart, lang)} ➔ {translateCity(selectedOffreForBid.arrivee, lang)}
                </p>
                <p className="text-slate-600 text-[11px]">
                  📦 {translateMarchandise(selectedOffreForBid.marchandise, lang)} · ⚖️ {selectedOffreForBid.poids} t
                </p>
                <p className="text-[11px] font-semibold text-[#187857]">
                  🚛 Matériel exigé : {translateMoyenType(selectedOffreForBid.moyenExige, lang)} (Min {selectedOffreForBid.longueurExigee || 12}m)
                </p>
              </div>

              {compatibilityError && (
                <div className="p-3 bg-rose-50 text-rose-850 rounded-lg text-[11px] font-bold border-l-4 border-rose-500 flex items-start gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{compatibilityError}</span>
                </div>
              )}

              {/* Check if fleet is empty */}
              {moyens.filter(m => m.transporteurId === currentUser?.id).length === 0 ? (
                <div className="p-4 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl space-y-3.5 text-xs">
                  <p className="font-black">🚨 Aucun matériel déclaré !</p>
                  <p className="leading-relaxed">Vous devez déclarer au moins un véhicule lourd dans votre **Espace Flotte** avant de soumettre des offres sur la bourse.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOffreForBid(null);
                      setCurrentTab("transporteur");
                      triggerSystemLog("Redirigé vers votre espace flotte.", "info");
                    }}
                    className="w-full text-center py-2 bg-amber-600 text-white rounded-lg font-bold"
                  >
                    Enregistrer un camion maintenant →
                  </button>
                </div>
              ) : (
                <>
                  {/* Choix du camion */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {lang === "ar" ? "اختر المركبة من أسطولك *" : "Choix du camion à utiliser *"}
                    </label>
                    <select 
                      value={bidMoyenId}
                      onChange={(e) => {
                        setBidMoyenId(e.target.value);
                        setCompatibilityError(null);
                      }}
                      className="w-full px-2.5 py-2 border rounded-lg bg-slate-50 cursor-pointer font-sans"
                    >
                      <option value="">-- Sélectionner un camion --</option>
                      {moyens.filter(m => m.transporteurId === currentUser?.id).map(m => (
                        <option key={m.id} value={m.id}>
                          🚚 {m.marque} - [ {m.immatriculation} ] ({m.poidsUtileMax} t)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tarif PROPOSE */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {lang === "ar" ? "قيمة عرض السعر (دج) *" : "Montant proposé (DZD) *"}
                    </label>
                    
                    {selectedOffreForBid.prixFixe ? (
                      <div className="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="block text-xs font-black text-slate-800 font-mono">
                          📌 PRIX FIXÉ PAR LE DO : {selectedOffreForBid.prixFixe.toLocaleString()} DZD
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            required
                            className="w-4 h-4 text-[#1D9E75] border-slate-300 rounded focus:ring-[#1D9E75]" 
                          />
                          <span className="text-[10.5px] font-bold text-slate-600">J'accepte d'effectuer le transport à ce tarif fixe</span>
                        </label>
                      </div>
                    ) : (
                      <>
                        <input 
                          type="number" 
                          required
                          value={bidPrice}
                          onChange={(e) => {
                            setBidPrice(Number(e.target.value));
                            setCompatibilityError(null);
                          }}
                          className="w-full px-2.5 py-2 border rounded-lg font-mono font-bold text-slate-800 text-sm"
                        />
                        <span className="text-[10px] text-[#1D9E75] font-semibold mt-1 block">
                          💡 Prix conseillé pour ce trajet : ~{Math.floor((selectedOffreForBid.prixFixe || 110000) * 0.95).toLocaleString()} DZD
                        </span>
                      </>
                    )}
                  </div>

                  {/* Disponibilité */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {lang === "ar" ? "تاريخ التوفر للجلب *" : "Disponible à partir du (date) *"}
                    </label>
                    <input 
                      type="date"
                      required
                      value={bidAvailabilityDate}
                      onChange={(e) => setBidAvailabilityDate(e.target.value)}
                      className="w-full px-2.5 py-2 border rounded-lg bg-slate-50 font-sans"
                    />
                  </div>

                  {/* Message libre */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                      {lang === "ar" ? "توضيحات إضافية" : "Message libre au DO (facultatif)"}
                    </label>
                    <textarea 
                      rows={2} 
                      placeholder={lang === "ar" ? "مثال: متاح فوراً، سائق مجهز ومجرب..." : "Ex: Chauffeur disponible, matériel bâché..."}
                      value={bidCommentaire}
                      onChange={(e) => setBidCommentaire(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>

                  {/* Certify Documents */}
                  <label className="flex items-start gap-2 pt-1 border-t cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={certifyDocuments}
                      onChange={(e) => {
                        setCertifyDocuments(e.target.checked);
                        setCompatibilityError(null);
                      }}
                      className="w-4.5 h-4.5 text-[#1D9E75] border-slate-300 rounded focus:ring-[#1D9E75] mt-0.5 shrink-0" 
                    />
                    <span className="text-[10.5px] leading-relaxed font-bold text-slate-600">
                      Je certifie que mes documents d'assurance transport de marchandises et documents d'exploitation sont à jour. *
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-xs font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all shadow-sm"
                  >
                    🚀 {lang === "ar" ? "إرسال المقترح" : "Envoyer ma proposition →"}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Footer d'Information Rapide */}
      <footer className="mt-8 bg-[#1D9E75] text-white flex flex-col sm:flex-row items-center justify-between px-8 py-4 sm:py-3.5 text-[10px] font-bold uppercase tracking-widest shrink-0 gap-4 border-t border-[#157B5B]/30 shadow-md mb-[64px]">
        <div>{t("footerInfo")}</div>
        <div className="flex space-x-6 items-center">
          <span>{t("support")}</span>
          <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-ping hidden sm:inline"></span>
          <span>{t("email")}</span>
        </div>
      </footer>

      {/* 64PX FIXED BOTTOM NAVIGATION BAR - PERSISTENT BAR COMPLYING WITH STYLES AND BRAND */}
      <div className="fixed bottom-0 left-0 right-0 h-[64px] bg-white border-t border-[#E5E7EB] flex items-center justify-around px-2 z-40 select-none shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        
        {/* Item 1: Accueil */}
        <button 
          id="nav-tab-accueil"
          onClick={() => {
            setCurrentTab("accueil");
            triggerSystemLog("Bourse de fret ouverte", "info");
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all cursor-pointer ${
            currentTab === "accueil" ? "text-[#1D9E75]" : "text-[#6B7280] hover:text-[#085041]"
          }`}
        >
          <Home className={`w-5 h-5 transition-transform ${currentTab === "accueil" ? "scale-110" : ""}`} />
          <span className="text-[10px] uppercase font-bold tracking-wider mt-1 block">
            {lang === "ar" ? "الرئيسية" : "Accueil"}
          </span>
        </button>

        {/* Item 2: Carte */}
        <button 
          id="nav-tab-carte"
          onClick={() => {
            setCurrentTab("carte");
            triggerSystemLog("Carte live de l'Algérie ouverte", "info");
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all cursor-pointer ${
            currentTab === "carte" ? "text-[#1D9E75]" : "text-[#6B7280] hover:text-[#1D9E75]"
          }`}
        >
          <Map className={`w-5 h-5 transition-transform ${currentTab === "carte" ? "scale-110" : ""}`} />
          <span className="text-[10px] uppercase font-bold tracking-wider mt-1 block">
            {lang === "ar" ? "الخريطة" : "Carte"}
          </span>
        </button>

        {/* Item 3: Publier */}
        <button 
          id="nav-tab-publier"
          onClick={() => {
            setCurrentTab("publier");
            triggerSystemLog("Formulaire de publication ouvert", "info");
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all cursor-pointer ${
            currentTab === "publier" ? "text-[#D85A30]" : "text-[#6B7280] hover:text-[#D85A30]"
          }`}
        >
          <PlusCircle className={`w-5 h-5 transition-transform ${currentTab === "publier" ? "scale-110 stroke-[#D85A30]" : ""}`} />
          <span className="text-[10px] uppercase font-bold tracking-wider mt-1 block">
            {lang === "ar" ? "نشر" : "Publier"}
          </span>
        </button>

        {/* Item 4: Mes données */}
        <button 
          id="nav-tab-donnees"
          onClick={() => {
            if (!currentUser) {
              setCurrentTab("login_portal");
              triggerSystemLog("Identifiez-vous d'abord !", "info");
            } else if (currentUser.profil === ProfileType.DonneurOrdre) {
              setCurrentTab("donneur");
              triggerSystemLog("Espace Donneur d'Ordre", "info");
            } else if (currentUser.profil === ProfileType.Transporteur) {
              setCurrentTab("transporteur");
              triggerSystemLog("Espace Transports", "info");
            } else if (currentUser.profil === ProfileType.Commercial) {
              setCurrentTab("commercial");
              triggerSystemLog("Espace Commercial BVF", "info");
            } else if (currentUser.profil === ProfileType.Admin) {
              setCurrentTab("admin");
              triggerSystemLog("Console Administrateur", "info");
            }
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all cursor-pointer ${
            (currentTab === "donneur" || currentTab === "transporteur" || currentTab === "commercial" || currentTab === "admin" || currentTab === "login_portal") ? "text-[#1D9E75]" : "text-[#6B7280] hover:text-[#085041]"
          }`}
        >
          {(() => {
            const count = !currentUser ? 0 : 
              currentUser.profil === "Donneur d'ordre" ? propositions.filter(p => !p.validee).length :
              currentUser.profil === "Transporteur" ? factures.filter(f => f.transporteurId === currentUser.id && f.status === "Facture Transmise" as any).length :
              1;
            return count > 0 ? (
              <div className="relative">
                <FolderOpen className={`w-5 h-5 transition-transform ${(currentTab === "donneur" || currentTab === "transporteur" || currentTab === "commercial" || currentTab === "admin" || currentTab === "login_portal") ? "scale-110" : ""}`} />
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8.5px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-white">
                  {count}
                </span>
              </div>
            ) : (
              <FolderOpen className={`w-5 h-5 transition-transform ${(currentTab === "donneur" || currentTab === "transporteur" || currentTab === "commercial" || currentTab === "admin" || currentTab === "login_portal") ? "scale-110" : ""}`} />
            );
          })()}
          <span className="text-[10px] uppercase font-bold tracking-wider mt-1 block">
            {lang === "ar" ? "بياناتي" : "Mes données"}
          </span>
        </button>

        {/* Item 5: Menu */}
        <button 
          id="nav-tab-menu"
          onClick={() => {
            setCurrentTab("menu");
            triggerSystemLog("Options de démonstration", "info");
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all cursor-pointer ${
            currentTab === "menu" ? "text-[#1D9E75]" : "text-[#6B7280] hover:text-[#085041]"
          }`}
        >
          <Menu className={`w-5 h-5 transition-transform ${currentTab === "menu" ? "scale-110" : ""}`} />
          <span className="text-[10px] uppercase font-bold tracking-wider mt-1 block">
            {lang === "ar" ? "القائمة" : "Menu"}
          </span>
        </button>

      </div>

      {/* ----------------- MULTI-PAGE CORPORATE LEGAL MODAL ----------------- */}
      {activeLegalModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in relative">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl relative text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto animate-slide-up relative z-50">
            <button 
              onClick={() => setActiveLegalModal(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ✕
            </button>

            {activeLegalModal === "about" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-2xl">🚛</span>
                  <h3 className="text-xs font-black uppercase text-[#1D9E75] tracking-widest">
                    {lang === "ar" ? "حول منصة نيتلوغ" : "À Propos de NETLOG"}
                  </h3>
                  <p className="text-[10px] text-slate-400">Digitalisation logistique nationale algérienne</p>
                </div>
                <div className="text-xs leading-relaxed space-y-2.5 font-sans font-medium text-slate-600 dark:text-slate-300">
                  <p>
                    NETLOG est plus qu'un outil d'affrètement : c'est un écosystème conçu pour sécuriser chaque transition industrielle, de la côte méditerranéenne aux infrastructures pétrolières d'Hassi Messaoud.
                  </p>
                  <p>
                    Nous connectons en toute conformité réglementaire les donneurs d'ordres, transporteurs agrées et BVF commerciaux à l'aide d'informations asymétriques assurant le suivi contractuel, le KYC automatisé et la persistance des registres.
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-[9px]">
                    <p className="font-extrabold text-[#1D9E75]">📍 NETLOG ALGERIA INC.</p>
                    <p>Cité 1200 logts, Bab Ezzouar, Alger, Algérie</p>
                    <p>Secteur : Transport Terrestre & Logistique de Fret</p>
                  </div>
                </div>
              </div>
            )}

            {activeLegalModal === "contact" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-2xl">📨</span>
                  <h3 className="text-xs font-black uppercase text-[#1D9E75] tracking-widest">
                    {lang === "ar" ? "اتصل بنا" : "Support & Assistance NETLOG"}
                  </h3>
                  <p className="text-[10px] text-slate-400">Une équipe à votre écoute 24h/7j</p>
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    showToast(lang === "ar" ? "📨 تم إرسال رسالتك بنجاح ! سنتواصل معك قريبًا." : "📨 Votre message a été transmis avec succès ! Notre support vous contactera sous 24h.", "success");
                    setActiveLegalModal(null);
                  }}
                  className="space-y-3 font-sans"
                >
                  <div>
                    <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase mb-1">Votre Nom / Raison Sociale</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="E.g. SARL Trans-Sahara" 
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-1 focus:ring-[#1D9E75] text-[#1A1A2E] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase mb-1">Adresse Email</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="contact@entreprise.dz" 
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-1 focus:ring-[#1D9E75] text-[#1A1A2E] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-500 font-extrabold uppercase mb-1">Sujet / Message</label>
                    <textarea 
                      required 
                      rows={3}
                      placeholder="Comment pouvons-nous vous aider aujourd'hui ?" 
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-1 focus:ring-[#1D9E75] text-[#1A1A2E] dark:text-white"
                    ></textarea>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-2.5 bg-[#1D9E75] hover:bg-[#157B5B] text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer transition shadow-sm text-center"
                  >
                    Envoyer le Message →
                  </button>
                </form>
              </div>
            )}

            <div className="pt-2 text-right">
              <button 
                onClick={() => setActiveLegalModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-black uppercase cursor-pointer"
              >
                {lang === "ar" ? "إغلاق" : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📡 SIMULATEUR DE SATELLITE TELECOM ET RECEPTION DES SMS / EMAILS NETLOG */}
      {/* ========================================================================= */}
      
      {/* Petit Bouton Flottant en bas à droite */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {hasNewNotifsAlert && (
          <div className="bg-[#D85A30] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg animate-bounce">
            {lang === "ar" ? "رابط جديد واصل ! 📲" : "Lien reçu ! 📲"}
          </div>
        )}
        <button 
          id="btn-simulator-notifs"
          onClick={() => {
            setIsNotifPanelExpanded(!isNotifPanelExpanded);
            setHasNewNotifsAlert(false);
          }}
          className={`flex items-center gap-2 px-4 py-3 rounded-full text-white font-black text-xs shadow-2xl transition-all duration-305 transform hover:scale-105 cursor-pointer ${isNotifPanelExpanded ? "bg-slate-900 border-2 border-slate-705 hover:bg-slate-800" : "bg-[#1D9E75] hover:bg-[#157B5B] dark:bg-[#1D9E75]"}`}
        >
          <span className="text-base animate-pulse">📡</span>
          <span>{lang === "ar" ? "محاكي روابط SMS / E-mail" : "Simulateur SMS / E-mail"}</span>
          {simulatedNotifs.length > 0 && (
            <span className="bg-white text-slate-900 rounded-full w-4.5 h-4.5 flex items-center justify-center font-extrabold text-[9px] min-w-[18px]">
              {simulatedNotifs.length}
            </span>
          )}
        </button>

        {/* Le Centre de Notifications SMS & Mail (Slide-up) */}
        {isNotifPanelExpanded && (
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl w-80 sm:w-96 shadow-2xl overflow-hidden max-h-[500px] flex flex-col font-sans select-none animate-slide-up text-slate-800 dark:text-slate-100">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-850">
              <div className="flex items-center gap-2">
                <span className="text-lg">📡</span>
                <div className="leading-tight">
                  <h4 className="text-xs font-black uppercase tracking-wider">Passerelle Télécom Netlog</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Flux d'expédition de liens SMS/E-mail</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNotifPanelExpanded(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-rose-50 text-slate-800 text-[10px] font-bold border-b border-rose-100 flex items-center gap-2">
              <span className="text-sm">💡</span>
              <p className="leading-tight">
                Simulez la réception des SMS et E-mails envoyés aux Donneurs d'Ordre lors des étapes clés (chargement et livraison). Cliquez pour rédiger les réserves !
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[300px]">
              {simulatedNotifs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic font-medium">
                  Aucun SMS/E-mail émis pour le moment.<br />Déclenchez-en en validant des actions de missions (ex: "Chargement exécuté" ou "J'ai livré") dans l'espace Transporteur !
                </div>
              ) : (
                simulatedNotifs.map((notif) => {
                  const isChargement = notif.type === "chargement";
                  return (
                    <div 
                      key={notif.id}
                      className={`p-3.5 rounded-2xl border transition-all ${notif.status === "unread" ? "bg-amber-50/60 border-amber-200" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-850"}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isChargement ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                          {isChargement ? "📋 Chargement réalisé" : "🏁 Livraison effectuée"}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 font-bold">{notif.sentAt}</span>
                      </div>

                      <div className="space-y-2 mt-1">
                        {/* Infos destinataire */}
                        <div className="text-[10px] leading-tight">
                          <p className="font-bold text-slate-800 dark:text-slate-200">Destinataire (DO) : <span className="text-indigo-600 dark:text-indigo-400">{notif.destName}</span></p>
                          <p className="font-mono text-slate-500 text-[9px] mt-0.5">📞 {notif.destPhone} • 📧 {notif.destEmail}</p>
                          <p className="text-slate-600 dark:text-slate-300 text-[10px] mt-1 font-semibold">📦 Expl: <span className="text-slate-900 dark:text-slate-150 font-extrabold">{notif.marchandise}</span> ({notif.trajet})</p>
                        </div>

                        {/* Onglets simulation direct */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[10px] text-slate-750 dark:text-slate-300">
                          <p className="font-bold text-slate-950 dark:text-white border-b pb-1 mb-1">📟 SMS &amp; EMAIL DEMO TEMPLATE :</p>
                          <p className="italic leading-normal select-text">"{notif.smsText.substring(0, 110)}..."</p>
                        </div>

                        {/* Bouton d'action simulation DO */}
                        <button
                          onClick={() => {
                            // Marquer comme lue
                            const updated = simulatedNotifs.map(n => n.id === notif.id ? { ...n, status: "read" } : n);
                            saveSimulatedNotifs(updated);
                            // Ouvrir le portail
                            setNotifPortalActive({
                              offreId: notif.offreId,
                              type: notif.type,
                              notifId: notif.id
                            });
                            // Pré-remplir le texte s'il y a déjà des réserves
                            const matchedOffre = offres.find(o => o.id === notif.offreId);
                            if (matchedOffre) {
                              const currentVal = notif.type === "chargement" 
                                ? (matchedOffre.reservesChargement || "")
                                : (matchedOffre.reservesLivraison || matchedOffre.reserves || "");
                              setTypedReserveText(currentVal);
                            } else {
                              setTypedReserveText("");
                            }
                            setIsNotifPanelExpanded(false);
                          }}
                          className="w-full py-2 bg-gradient-to-r from-[#1D9E75] to-emerald-600 text-white rounded-xl font-bold text-[11px] hover:opacity-90 flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          🔗 Ouvrir le lien de réserves (Simuler Clic DO) →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {simulatedNotifs.length > 0 && (
              <div className="p-2.5 bg-slate-50 dark:bg-[#111827] border-t border-slate-100 dark:border-slate-850 text-center">
                <button 
                  onClick={() => {
                    saveSimulatedNotifs([]);
                    triggerSystemLog("Historique du simulateur de liens vidé.", "info");
                  }}
                  className="text-red-500 hover:text-red-700 text-[10px] font-bold"
                >
                  Effacer tout l'historique
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 📲 MODAL: EXPÉRIENCE MOBILE SIMULÉE DU PORTAIL DE RÉSERVES DU DONNEUR D'ORDRE */}
      {/* ========================================================================= */}
      {notifPortalActive && (() => {
        const matchingOffre = offres.find(o => o.id === notifPortalActive.offreId);
        if (!matchingOffre) return null;

        const isChargement = notifPortalActive.type === "chargement";

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none overflow-y-auto">
            {/* Boitier de smartphone simulé */}
            <div className="bg-slate-950 rounded-[40px] border-8 border-slate-800 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative aspect-[9/19] h-[780px] max-h-[92vh] text-slate-800">
              
              {/* Encoche du micro smartphone (notch) */}
              <div className="absolute top-0 inset-x-0 h-4 flex justify-center z-20">
                <div className="bg-slate-800 w-28 h-4 rounded-b-2xl"></div>
              </div>

              {/* Barre d'état du smartphone */}
              <div className="bg-slate-910 text-white text-[10px] px-5 pt-4 pb-1.5 flex justify-between font-mono font-bold shrink-0">
                <span>Netlog LTE 📲</span>
                <span>04:16 AM</span>
                <span>🔋 98%</span>
              </div>

              {/* Corps principal : Contenu du Link Portal */}
              <div className="flex-1 bg-slate-50 overflow-y-auto px-4 py-5 flex flex-col">
                
                {/* En-tête de l'application mobile Netlog */}
                <div className="flex items-center gap-1.5 pb-3 border-b border-slate-200 mb-4">
                  <span className="text-xl">🚛</span>
                  <div>
                    <h3 className="text-xs font-black tracking-tight text-emerald-700 leading-none">NETLOG MOBILE PORTAL</h3>
                    <span className="text-[8px] font-bold text-slate-400 tracking-wider">LIEN SÉCURISÉ LOGISTIQUE</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs mb-4">
                  <span className={`text-[8.5px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full inline-block mb-2 ${isChargement ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                    {isChargement ? "📋 Phase de Chargement" : "🏁 Phase de Réception"}
                  </span>

                  <h4 className="text-xs font-black text-slate-900 font-mono">Expédition #{matchingOffre.id}</h4>
                  
                  <div className="text-[10px] mt-2 space-y-1 text-slate-600 font-medium">
                    <p><b>Axe :</b> {matchingOffre.depart} ➔ {matchingOffre.arrivee}</p>
                    <p><b>Produit :</b> 📦 {matchingOffre.marchandise}</p>
                    <p><b>Transporteur :</b> {matchingOffre.transporteurRaisonSociale || "EURL Ahmed Benzekri Transports"}</p>
                    <p><b>Tonnage :</b> {matchingOffre.poids} Tonnes</p>
                  </div>
                </div>

                {/* Zone de saisie des réserves de l'ordre */}
                <div className="space-y-2 mt-1">
                  <label className="block text-[11px] font-bold text-slate-900 leading-tight">
                    {isChargement 
                      ? "Mentionner tout réserve ou observation éventuelle au CHARGEMENT :"
                      : "Mentionner tout anomalie ou réserve contradictoire à la LIVRAISON :"}
                  </label>
                  <p className="text-[10px] text-slate-400 italic">
                    {isChargement
                      ? "Ex: Défaut de sangles pour arrimage, bâche trouée à l'arrière, etc."
                      : "Ex: Rupture de 3 sacs, humidité sur palettes constatée, etc."}
                  </p>
                  
                  <textarea
                    rows={6}
                    value={typedReserveText}
                    onChange={(e) => setTypedReserveText(e.target.value)}
                    placeholder={isChargement ? "Entrez vos réserves de chargement..." : "Entrez vos réserves de livraison (anomalies)..."}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-emerald-500 font-sans text-slate-900"
                  />
                </div>

                {/* Disclaimer officiel */}
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 mt-4 text-[9.5px] leading-relaxed text-amber-900 font-medium">
                  ⚖️ <b>Avis juridique :</b> En enregistrant ces mentions, elles seront insérées immédiatement de manière contradictoire sur la Lettre de Voiture nationale officielle NETLOG. Cette consignation fait acte de preuve juridique.
                </div>

                <div className="flex-1"></div> {/* Pousse les boutons vers le bas */}

                {/* Bouton de confirmation de formulaire */}
                <div className="space-y-2 mt-6 pt-3 border-t border-slate-200 shrink-0">
                  <button
                    onClick={() => {
                      const updatedOffres = offres.map(o => {
                        if (o.id === matchingOffre.id) {
                          if (isChargement) {
                            return { ...o, reservesChargement: typedReserveText.trim() };
                          } else {
                            return { ...o, reservesLivraison: typedReserveText.trim(), reserves: typedReserveText.trim() };
                          }
                        }
                        return o;
                      });

                      saveState(undefined, undefined, updatedOffres);
                      
                      // Marquer la notification comme completed
                      if (notifPortalActive.notifId) {
                        const updatedN = simulatedNotifs.map(n => n.id === notifPortalActive.notifId ? { ...n, status: "completed" } : n);
                        saveSimulatedNotifs(updatedN);
                      }

                      triggerSystemLog(
                        isChargement
                          ? "Réserves de chargement enregistrées avec succès sur la Lettre de voiture !"
                          : "Anomalies/Réserves de livraison consignées et enregistrées sur la Lettre de voiture !",
                        "success"
                      );
                      
                      setNotifPortalActive(null);
                      setTypedReserveText("");
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] rounded-xl cursor-pointer text-center flex items-center justify-center gap-1.5 transition"
                  >
                    💾 Enregistrer les réserves sur la LDV
                  </button>

                  <button
                    onClick={() => {
                      setNotifPortalActive(null);
                      setTypedReserveText("");
                    }}
                    className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[11px] rounded-xl cursor-pointer text-center transition"
                  >
                    Fermer sans enregistrer
                  </button>
                </div>
              </div>

              {/* Bouton physique virtuel Home du smartphone pour fermer */}
              <div className="bg-slate-900 py-3 flex justify-center shrink-0">
                <button 
                  onClick={() => {
                    setNotifPortalActive(null);
                    setTypedReserveText("");
                  }}
                  className="w-14 h-4 bg-slate-800 hover:bg-slate-700 rounded-full cursor-pointer transition border border-slate-700"
                  title="Bouton Accueil virtuel"
                />
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}

// Fonction utilitaire pour déterminer la limite de moyens du transporteur selon son abonnement fictif
function umoyens_limit(userId: string): number {
  return 10;
}
