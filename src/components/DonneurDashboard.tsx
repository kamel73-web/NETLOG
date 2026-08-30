import React, { useState } from "react";
import { 
  Plus, 
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
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Truck,
  ArrowRight,
  Sparkles,
  FileCheck,
  X,
  Upload,
  Printer,
  CreditCard
} from "lucide-react";
import { OffreStatus, ProfileType, MoyenType, Facture, FactureStatus, DevisOfficiel } from "../types";
import DevisModule from "./DevisModule";
import { createFreightOffer, acceptProposal } from "../lib/freightOffers";


function wilayaCodeFromLabel(label: string): number | null {
  const m = label.match(/^(\d{1,2})\s*-/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

const ALGERIAN_WILAYAS = [
  "01 - Adrar", "02 - Chlef", "03 - Laghouat", "04 - Oum El Bouaghi", "05 - Batna",
  "06 - Béjaïa", "07 - Biskra", "08 - Béchar", "09 - Blida", "10 - Bouira",
  "11 - Tamanrasset", "12 - Tébessa", "13 - Tlemcen", "14 - Tiaret", "15 - Tizi Ouzou",
  "16 - Alger", "17 - Djelfa", "18 - Jijel", "19 - Sétif", "20 - Saïda",
  "21 - Skikda", "22 - Sidi Bel Abbès", "23 - Annaba", "24 - Guelma", "25 - Constantine",
  "26 - Médéa", "27 - Mostaganem", "28 - M'Sila", "29 - Mascara", "30 - Ouargla",
  "31 - Oran", "32 - El Bayadh", "33 - Illizi", "34 - Bordj Bou Arréridj", "35 - Boumerdès",
  "36 - El Tarf", "37 - Tindouf", "38 - Tissemsilt", "39 - El Oued", "40 - Khenchela",
  "41 - Souk Ahras", "42 - Tipaza", "43 - Mila", "44 - Aïn Defla", "45 - Naâma",
  "46 - Aïn Témouchent", "47 - Ghardaïa", "48 - Relizane", "49 - El M'Ghair", "50 - El Meniaa",
  "51 - Ouled Djellal", "52 - Bordj Baji Mokhtar", "53 - Béni Abbès", "54 - Timimoun", "55 - Touggourt",
  "56 - Djanet", "57 - In Salah", "58 - In Guezzam"
];

interface DonneurDashboardProps {
  currentUser: any;
  setCurrentUser: (user: any) => void;
  lang: string;
  t: (key: string) => string;
  saveState: (users?: any, moyens?: any, offres?: any, propositions?: any, factures?: any, devis?: any) => void;
  offres: any[];
  propositions: any[];
  factures?: any[];
  devis: DevisOfficiel[];
  counters: { offres: number; missions: number; factures: number; ldv: number; devis: number };
  incrementCounter: (key: "offres" | "missions" | "factures" | "ldv" | "devis") => void;
  users: any[];
  triggerSystemLog: (msg: string, type: "success" | "info" | "warning" | "danger") => void;
  setActiveContractDoc?: (doc: any) => void;
  translateCity: (city: string, lang: string) => string;
  translateMoyenType: (moyen: any, lang: string) => string;
  translateMarchandise: (march: any, lang: string) => string;
  setCurrentTab: (tab: string) => void;
}

export default function DonneurDashboard({
  currentUser,
  setCurrentUser,
  lang,
  t,
  saveState,
  offres,
  propositions,
  factures = [],
  devis = [],
  counters,
  incrementCounter,
  users = [],
  triggerSystemLog,
  setActiveContractDoc,
  translateCity,
  translateMoyenType,
  translateMarchandise,
  setCurrentTab
}: DonneurDashboardProps) {

  const [activeSubTab, setActiveSubTab] = useState<"offres" | "missions" | "propositions" | "devis" | "factures" | "compte">("offres");

  // Form State for creating a new offer
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successPublishMsg, setSuccessPublishMsg] = useState("");
  const [publishedRef, setPublishedRef] = useState("");

  const [formDepartWilaya, setFormDepartWilaya] = useState(ALGERIAN_WILAYAS[15]); // Default Alger
  const [formDepartDetails, setFormDepartDetails] = useState("");
  const [formArriveeWilaya, setFormArriveeWilaya] = useState(ALGERIAN_WILAYAS[18]); // Default Sétif
  const [formArriveeDetails, setFormArriveeDetails] = useState("");
  const [formAllerRetour, setFormAllerRetour] = useState(false);
  const [formRetourWilaya, setFormRetourWilaya] = useState("");
  const [formRetourDetails, setFormRetourDetails] = useState("");

  const [formNature, setFormNature] = useState("");
  const [formCategorie, setFormCategorie] = useState("Matériaux BTP");
  const [formPoids, setFormPoids] = useState<number | "">("");
  const [formVolume, setFormVolume] = useState<number | "">("");
  const [formPalettes, setFormPalettes] = useState<number | "">("");
  const [formConditionnement, setFormConditionnement] = useState("Palettes");
  const [formFragile, setFormFragile] = useState(false);
  const [formDangereuse, setFormDangereuse] = useState(false);
  const [formDangerClasse, setFormDangerClasse] = useState("");
  const [formTemperatureVal, setFormTemperatureVal] = useState("Ambiante");

  const [formCamionType, setFormCamionType] = useState<MoyenType>(MoyenType.Tautliner);
  const [formTonnageRequis, setFormTonnageRequis] = useState<number | "">("");
  const [formNombreVoyages, setFormNombreVoyages] = useState(1);
  const [formFrequence, setFormFrequence] = useState("Unique");
  const [formDateEnlevement, setFormDateEnlevement] = useState("");
  const [formDateLimiteEnlevement, setFormDateLimiteEnlevement] = useState("");
  const [formHeureSouhaitee, setFormHeureSouhaitee] = useState("");
  const [formInstructionsChargement, setFormInstructionsChargement] = useState("");

  const [formTarifMode, setFormTarifMode] = useState<"fixe" | "libre">("fixe");
  const [formMontantFixe, setFormMontantFixe] = useState<number | "">("");
  const [formBudgetMaxLibre, setFormBudgetMaxLibre] = useState<number | "">("");
  const [formConditionsPaiement, setFormConditionsPaiement] = useState("Paiement à la livraison");

  const [formAssuranceSouhaitee, setFormAssuranceSouhaitee] = useState(false);
  const [formBonCommande, setFormBonCommande] = useState("");
  const [formRemarques, setFormRemarques] = useState("");

  // Edit State
  const [editingOffreId, setEditingOffreId] = useState<string | null>(null);

  // Active Offre details for props
  const [selectedOffreForProps, setSelectedOffreForProps] = useState<any>(null);
  const [selectedOffreForDetails, setSelectedOffreForDetails] = useState<any | null>(null);

  // Mission validation modal
  const [showValideModal, setShowValideModal] = useState(false);
  const [activeMissionToValidate, setActiveMissionToValidate] = useState<any>(null);
  const [valideConformite, setValideConformite] = useState<"conforme" | "reserves" | "litige">("conforme");
  const [valideReservesDesc, setValideReservesDesc] = useState("");
  const [valideReservesType, setValideReservesType] = useState("Retard");
  const [valideRating, setValideRating] = useState(5);
  const [valideComment, setValideComment] = useState("");

  // Facture filters & Pay screen
  const [factureFilter, setFactureFilter] = useState<"toutes" | "attente" | "payees" | "retard">("toutes");
  const [facturePeriod, setFacturePeriod] = useState<"tous" | "mois" | "trimestre">("tous");
  const [factureCarrier, setFactureCarrier] = useState<string>("tous");
  const [showReglementModal, setShowReglementModal] = useState(false);
  const [selectedFactureToPay, setSelectedFactureToPay] = useState<any>(null);
  const [uploadedJustifName, setUploadedJustifName] = useState("");
  const [devisPropToConfirm, setDevisPropToConfirm] = useState<any | null>(null);

  // States to filter active collections when clicking on dashboard indicator blocks
  const [offreFilterStatus, setOffreFilterStatus] = useState<"tous" | "actifs" | "propositions" | "annulees" | "livrees" | "en_cours">("tous");
  const [missionFilterStatus, setMissionFilterStatus] = useState<"toutes" | "en_cours" | "livrees">("toutes");

  // Initial stats that we override dynamically or mock
  const doOffres = offres.filter(o => o.donneurId === currentUser?.id);
  const totalOffres = doOffres.length;
  
  // Custom mock active offers tally
  const activeOffersCount = doOffres.filter(o => o.status === OffreStatus.Publie).length;
  const countNewProps = propositions.filter(p => doOffres.some(o => o.id === p.offreId) && p.status === "En attente").length;
  const countMissions = doOffres.filter(o => o.status === OffreStatus.Charge || o.status === OffreStatus.Attribue).length;
  const countLivreesCeMois = doOffres.filter(o => o.status === OffreStatus.Decharge || o.status === OffreStatus.Valide).length;

  // Total expenses calculated from state
  const totalExpenses = factures
    .filter(f => f.donneurId === currentUser?.id)
    .reduce((sum, f) => sum + (f.montant || 0), 0) || 640000;

  // Let's ensure mock invoices/factures exist for this display if empty
  const localFactures = factures.length > 0 ? factures.filter(f => f.donneurId === currentUser?.id) : [
    { id: "FAC-2025-008", dateEmission: "2026-05-20", prestation: "Alger ➔ Constantine (Matériaux)", montant: 45000, status: "Retard", modeReglement: "CCP" },
    { id: "FAC-2025-007", dateEmission: "2026-05-18", prestation: "Oran ➔ Sétif (Ciment)", montant: 80000, status: "Facture Transmise", modeReglement: "Virement" },
    { id: "FAC-2025-006", dateEmission: "2026-05-10", prestation: "Alger ➔ Adrar (Farine)", montant: 180000, status: "Facture Réglée", modeReglement: "Virement", dateReglement: "2026-05-12" },
    { id: "FAC-2025-005", dateEmission: "2026-05-02", prestation: "Blida ➔ Annaba (Acier)", montant: 335000, status: "Facture Réglée", modeReglement: "Virement", dateReglement: "2026-05-05" }
  ];

  // Handler for publishing a new offer
  const handlePublishOffre = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formDepartDetails || !formArriveeDetails || !formNature || !formDateEnlevement) {
      triggerSystemLog(
        lang === "ar"
          ? "يرجى ملء جميع الحقول الإلزامية "
          : "Veuillez remplir tous les champs requis d'adresse, marchandise et date.",
        "danger"
      );
      return;
    }

    if (formTarifMode === "fixe" && !formMontantFixe) {
      triggerSystemLog(
        lang === "ar" ? "يرجى إدخال مبلغ التعريفة الثابتة" : "Veuillez saisir un montant pour le tarif fixe.",
        "danger"
      );
      return;
    }

    const wilayaDepart = wilayaCodeFromLabel(formDepartWilaya);
    const wilayaArrivee = wilayaCodeFromLabel(formArriveeWilaya);
    if (wilayaDepart == null || wilayaArrivee == null) {
      triggerSystemLog("Wilaya de départ ou d'arrivée invalide.", "danger");
      return;
    }

    const departName = formDepartWilaya.replace(/^\d+\s*-\s*/, "");
    const arriveeName = formArriveeWilaya.replace(/^\d+\s*-\s*/, "");
    const prixPropose = formTarifMode === "fixe" ? Number(formMontantFixe) : 0;
    const poidsTonnes = Number(formPoids) || 10;
    const commentaire = formRemarques || formInstructionsChargement || undefined;

    // Édition : pas d'API update → local uniquement pour l'instant
    if (editingOffreId) {
      const updatedOffres = offres.map((o) =>
        o.id === editingOffreId
          ? {
              ...o,
              depart: departName,
              arrivee: arriveeName,
              departDetails: formDepartDetails,
              arriveeDetails: formArriveeDetails,
              dateChargement: formDateEnlevement,
              dateLivraison: formDateLimiteEnlevement || formDateEnlevement,
              poids: poidsTonnes,
              marchandise: formNature,
              moyenExige: formCamionType,
              nombreVoyages: Number(formNombreVoyages) || 1,
              prixFixe: formTarifMode === "fixe" ? prixPropose : undefined,
              commentaire,
            }
          : o
      );
      saveState(undefined, undefined, updatedOffres);
      triggerSystemLog(lang === "ar" ? "تم تعديل العرض بنجاح" : "Offre de fret modifiée avec succès !", "success");
      setEditingOffreId(null);
      setShowCreateModal(false);
      return;
    }

    let insertedId: string;
    let codeConfirmation: string;
    try {
      const inserted = await createFreightOffer({
        wilayaDepart,
        wilayaArrivee,
        pointRepereDepart: formDepartDetails,
        pointRepereArrivee: formArriveeDetails,
        description: commentaire,
        poidsKg: poidsTonnes * 1000,
        typeMarchandise: formNature,
        prixPropose,
        paymentMethod: "cash",
        dateEnlevementSouhaitee: formDateEnlevement,
        typeMoyenExige: formCamionType,
        nombreVoyages: Number(formNombreVoyages) || 1,
      });
      insertedId = String(inserted.id);
      codeConfirmation = inserted.code_confirmation ?? String(Math.floor(1000 + Math.random() * 9000));
    } catch (err: any) {
      triggerSystemLog(`Échec de la publication : ${err?.message ?? "erreur inconnue"}`, "danger");
      return;
    }

    const newOffre = {
      id: insertedId,
      donneurId: currentUser?.id || "DO-DEFAULT",
      donneurRaisonSociale: currentUser?.raisonSociale || "SARL BATIMEX",
      depart: departName,
      arrivee: arriveeName,
      departDetails: formDepartDetails,
      arriveeDetails: formArriveeDetails,
      dateChargement: formDateEnlevement,
      dateLivraison: formDateLimiteEnlevement || formDateEnlevement,
      poids: poidsTonnes,
      longueurExigee: 13.6,
      marchandise: formNature,
      moyenExige: formCamionType,
      nombreVoyages: Number(formNombreVoyages) || 1,
      prixFixe: formTarifMode === "fixe" ? prixPropose : undefined,
      budgetMaxLibre: formTarifMode === "libre" ? Number(formBudgetMaxLibre) : undefined,
      tarifMode: formTarifMode,
      categorie: formCategorie,
      volume: Number(formVolume) || undefined,
      palettes: Number(formPalettes) || undefined,
      conditionnement: formConditionnement,
      fragile: formFragile,
      dangereuse: formDangereuse,
      dangerClasse: formDangerClasse,
      temperature: formTemperatureVal,
      frequence: formFrequence,
      allerRetour: formAllerRetour,
      retourWilaya: formRetourWilaya,
      retourDetails: formRetourDetails,
      heureSouhaitee: formHeureSouhaitee,
      instructionsChargement: formInstructionsChargement,
      assuranceSouhaitee: formAssuranceSouhaitee,
      bonCommande: formBonCommande,
      commentaire,
      status: OffreStatus.Publie,
      codeConfirmation,
      dateCreation: new Date().toISOString().split("T")[0],
    };

    saveState(undefined, undefined, [newOffre, ...offres]);
    setPublishedRef(insertedId);
    setSuccessPublishMsg(`✅ Offre publiée ! Référence : ${insertedId}. Visible en base.`);
    triggerSystemLog(lang === "ar" ? "تم نشر العرض بنجاح على البورصة" : "Offre publiée en base.", "success");

    setFormDepartDetails("");
    setFormArriveeDetails("");
    setFormNature("");
    setFormPoids("");
    setFormVolume("");
    setFormPalettes("");
    setFormMontantFixe("");
    setFormBudgetMaxLibre("");
    setFormInstructionsChargement("");
    setFormRemarques("");
    setFormBonCommande("");
  };

  // Handler to request official quote conversion
  const handleRequestDevis = (prop: any) => {
    const currentYear = new Date().getFullYear();
    const nextNum = String(counters.devis || 12).padStart(4, "0");
    const devisId = `DEV-${currentYear}-${nextNum}`;
    
    // Find transporter details to populate from KYC users registry
    const transUser = users.find(u => u.id === prop.transporteurId) || {
      nrc: "16/00-0987654B26",
      nif: "19871601002345600000",
      tel: prop.tel || "0550 12 34 56",
      adresse: "Zone Industrielle Oued Smar, Alger",
    };
    
    const matchedOffre = offres.find(o => o.id === prop.offreId);

    const newDevis: DevisOfficiel = {
      id: devisId,
      propositionId: prop.id,
      offreId: prop.offreId,
      transporteurId: prop.transporteurId,
      transporteurRaisonSociale: prop.transporteurRaisonSociale,
      transporteurNRC: transUser.nrc || "16/00-0987654SB26",
      transporteurNIF: transUser.nif || "19851601004481200000",
      transporteurNIS: "001601080029314", // simulated NIS
      transporteurTel: transUser.tel || "0550 12 34 56",
      transporteurAdresse: transUser.adresse || "Zone Industrielle, Alger",
      donneurId: currentUser.id,
      donneurRaisonSociale: currentUser.raisonSociale || `${currentUser.prenom} ${currentUser.nom}`,
      marchandise: matchedOffre ? matchedOffre.marchandise : "Fret Routier",
      depart: matchedOffre ? matchedOffre.depart : "Alger",
      arrivee: matchedOffre ? matchedOffre.arrivee : "Oran",
      poids: matchedOffre ? matchedOffre.poids : 24,
      prixHT: prop.prixPropose,
      tva: Math.round(prop.prixPropose * 0.19),
      prixTTC: Math.round(prop.prixPropose * 1.19),
      delaiTransport: 2, // 2 days typical
      dateEmission: new Date().toISOString().split('T')[0],
      dateValidite: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "En attente signature",
    };

    const updatedDevis = [...devis, newDevis];
    incrementCounter("devis");
    
    // Update proposition status so that it marks it as "En attente"
    const updatedProps = propositions.map(p => p.id === prop.id ? { ...p, status: "En attente" as any } : p);

    saveState(undefined, undefined, undefined, updatedProps, undefined, updatedDevis);
    triggerSystemLog(`Devis officiel ${devisId} créé ! Le transporteur ${prop.transporteurRaisonSociale} a été alerté pour signature électronique.`, "success");
    
    // Auto redirect to devis subtab
    setActiveSubTab("devis");
  };

  // Handler for proposal accept
  const handleAcceptProposal = async (prop: any) => {
    const offerIdNum = Number(prop.offreId);
    const proposalIdNum = Number(prop.id);
    if (!Number.isFinite(offerIdNum) || !Number.isFinite(proposalIdNum)) {
      triggerSystemLog("IDs offre/proposition invalides (non numériques).", "danger");
      return;
    }

    try {
      await acceptProposal({ offerId: offerIdNum, proposalId: proposalIdNum });
    } catch (err: any) {
      triggerSystemLog(`Échec acceptation : ${err?.message ?? "erreur"}`, "danger");
      return;
    }

    const updatedProps = propositions.map(p => {
      if (p.id === prop.id) return { ...p, status: "Accepté" as const };
      if (p.offreId === prop.offreId) return { ...p, status: "Rejeté" as const };
      return p;
    });

    const updatedOffres = offres.map(o => {
      if (o.id === prop.offreId) {
        return {
          ...o,
          status: OffreStatus.Attribue,
          transporteurId: prop.transporteurId,
          transporteurRaisonSociale: prop.transporteurRaisonSociale,
          prixConvenu: prop.prixPropose
        };
      }
      return o;
    });

    const newInvoice = {
      id: `FAC-${2025}-${Math.floor(100 + Math.random() * 900)}`,
      offreId: prop.offreId,
      donneurId: currentUser?.id,
      transporteurId: prop.transporteurId,
      montant: prop.prixPropose,
      status: "Facture Transmise",
      dateEmission: new Date().toISOString().split("T")[0],
    };

    saveState(undefined, undefined, updatedOffres, updatedProps, [...(factures || []), newInvoice]);
    triggerSystemLog(
      lang === "ar"
        ? "تم قبول العرض بنجاح وجاري إعداد عقد النقل"
        : `Offre attribuée à ${prop.transporteurRaisonSociale} · Tarif convenu: ${prop.prixPropose.toLocaleString()} DA`,
      "success"
    );
    setSelectedOffreForProps(null);
  };

  // Handler for declaring shipment load
  const handleConfirmLoading = (offre: any) => {
    const updatedOffres = offres.map(o => {
      if (o.id === offre.id) return { ...o, status: OffreStatus.Charge };
      return o;
    });
    saveState(undefined, undefined, updatedOffres);
    triggerSystemLog(`Cargaison confirmée chargée à bord pour le trajet vers ${offre.arrivee}!`, "success");
  };

  // Helper code validation 
  const handleValidateDeliveryFinal = () => {
    if (!activeMissionToValidate) return;

    const updatedOffres = offres.map(o => {
      if (o.id === activeMissionToValidate.id) {
        return { 
          ...o, 
          status: OffreStatus.Valide,
          reserves: valideConformite !== "conforme" ? `[${valideReservesType}] ${valideReservesDesc}` : undefined,
          evaluation: {
            stars: valideRating,
            comment: valideComment
          }
        };
      }
      return o;
    });

    let updatedUsers = users;
    const assignedChauffeurId = activeMissionToValidate.chauffeurId;
    if (assignedChauffeurId) {
      updatedUsers = users.map(u => {
        if (u.id === assignedChauffeurId) {
          return {
            ...u,
            disponibiliteChauffeur: "Disponible"
          };
        }
        return u;
      });
    }

    // Auto-generate invoice (FAC)
    const correspondingProp = propositions.find(p => p.offreId === activeMissionToValidate.id && p.status === "Accepté");
    const amount = correspondingProp ? correspondingProp.prixPropose : (activeMissionToValidate.prixFixe || 150000);
    const transporteurId = correspondingProp ? correspondingProp.transporteurId : "user-trans-1";

    const currentYear = new Date().getFullYear();
    const invoiceSeqNum = String(factures.length + 1).padStart(4, "0");
    const invoiceId = `FAC-${currentYear}-${invoiceSeqNum}`;

    const newInvoice: Facture = {
      id: invoiceId,
      offreId: activeMissionToValidate.id,
      donneurId: currentUser.id,
      transporteurId: transporteurId,
      montant: amount,
      status: "Facture Transmise" as any, // Adhering to the table check text literal
      prestation: `Acheminement Fret (Axe : ${activeMissionToValidate.depart} ➔ ${activeMissionToValidate.arrivee})`,
      dateEmission: new Date().toISOString().split("T")[0],
    };

    const updatedFactures = [newInvoice, ...(factures || [])];

    saveState(updatedUsers, undefined, updatedOffres, undefined, updatedFactures);
    triggerSystemLog(`Livraison confirmée pour la mission ${activeMissionToValidate.id}. Facture automatique ${invoiceId} et Lettre de Voiture associées générées.`, "success");
    setShowValideModal(false);
    setActiveMissionToValidate(null);
  };

  // Monthly consolidated invoicing ("Arrêter la période de facturation")
  const handleGenerateMonthlyInvoice = () => {
    // Find all completed/unbilled offers (OffreStatus.Valide) for this shipper that do not have an invoice yet
    const unbilledOffres = offres.filter(o => 
      o.donneurId === currentUser.id && 
      (o.status === OffreStatus.Valide || o.status === OffreStatus.Decharge) && 
      !(factures || []).some(f => f.offreId === o.id || (f as any).offreIds?.includes(o.id))
    );

    if (unbilledOffres.length === 0) {
      triggerSystemLog("Aucune prestation en déchargement ou validée non-facturée disponible pour arrêter la période ce mois-ci !", "warning");
      return;
    }

    const currentYear = new Date().getFullYear();
    const totalAmountHT = unbilledOffres.reduce((sum, o) => {
      const correspondingProp = propositions.find(p => p.offreId === o.id && p.status === "Accepté");
      return sum + (correspondingProp ? correspondingProp.prixPropose : (o.prixFixe || 80000));
    }, 0);

    const invoiceId = `FAC-${currentYear}-M-${Math.floor(100 + Math.random() * 900)}`;

    const consolidatedInvoice: Facture = {
      id: invoiceId,
      donneurId: currentUser.id,
      montant: totalAmountHT, // HT
      status: "Facture Transmise" as any, // Transmise status
      prestation: `Facture Mensuelle Groupée Consolidée (${unbilledOffres.length} Prestations de transport)`,
      dateEmission: new Date().toISOString().split("T")[0],
      isMensuelleGroupee: true,
      offreIds: unbilledOffres.map(o => o.id),
      modeReglement: "Virement"
    } as any;

    const updatedFactures = [consolidatedInvoice, ...(factures || [])];
    
    // We can also mark those offers as billed if we want or just let them query in factures
    saveState(undefined, undefined, undefined, undefined, updatedFactures);
    triggerSystemLog(`La période de facturation mensuelle a été arrêtée avec succès. Facture Groupée Consolidée ${invoiceId} émise pour ${unbilledOffres.length} prestations (${totalAmountHT.toLocaleString()} DA HT).`, "success");
  };

  const handleCancelOffre = (id: string) => {
    const updatedOffres = offres.map(o => {
      if (o.id === id) return { ...o, status: "Annulée" as any };
      return o;
    });
    saveState(undefined, undefined, updatedOffres);
    triggerSystemLog("Offre de fret annulée.", "info");
  };

  const handleDeclarePayment = () => {
    if (!selectedFactureToPay) return;
    triggerSystemLog(`Paiement déclaré pour la facture ${selectedFactureToPay.id}. En attente de vérification BVF.`, "success");
    setShowReglementModal(false);
    setSelectedFactureToPay(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* HEADER SECTION WITH USER GREETING & CURRENT DATE */}
      <div style={{ backgroundColor: '#085041' }} className="bg-[#085041] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-emerald-800/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#1D9E75]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/10 text-white text-[10px] font-bold tracking-widest px-3 py-1 rounded-full border border-white/20">
                {lang === "ar" ? "الحساب المهني للمرسل" : "ESPACE PERSONNEL DONNEUR D'ORDRE"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight !text-white mb-2 flex items-center gap-2">
              Bonjour {currentUser?.raisonSociale || "SARL BATIMEX"} 🏭
            </h1>
            <p className="text-emerald-100 text-xs sm:text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-300" />
              {new Date().toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-DZ", { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} · <Clock className="w-4 h-4 text-emerald-300 inline ml-1" /> 09:43 Alger
            </p>
          </div>
          <div>
            <button 
              onClick={() => {
                setEditingOffreId(null);
                setShowCreateModal(true);
                setSuccessPublishMsg("");
              }}
              className="btn-primary px-6 py-3.5 hover:bg-[#063f33] text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer w-full md:w-auto border border-emerald-500/20"
            >
              <Plus className="w-4 h-4 text-white" /> 
              {lang === "ar" ? "نشر عرض شحن جديد" : "Nouvelle offre de fret"}
            </button>
          </div>
        </div>
      </div>

      {/* ALERTS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {countNewProps > 0 && (
          <div 
            onClick={() => setActiveSubTab("propositions")}
            className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100/80 shadow-xs cursor-pointer hover:bg-indigo-100/50 transition duration-150 animate-pulse"
          >
            <div className="p-3 bg-indigo-500 text-white rounded-xl">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-indigo-950">🔔 7 nouvelles propositions sur vos offres — Consultez-les</p>
              <p className="text-[10px] text-indigo-600 font-semibold">{lang === "ar" ? "اضغط هنا لمقارنة الأسعار واختيار الناقل" : "Cliquez pour comparer les offres et allouer les frets"}</p>
            </div>
          </div>
        )}

        <div 
          onClick={() => setActiveSubTab("factures")}
          className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-100/80 shadow-xs cursor-pointer hover:bg-amber-100/50 transition duration-150"
        >
          <div className="p-3 bg-amber-500 text-white rounded-xl">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-amber-950">⚠️ Facture FAC-2025-008 en retard de 5 jours (45 000 DA)</p>
            <p className="text-[10px] text-amber-600 font-semibold">{lang === "ar" ? "اضغط هنا لتسجيل الدفع عبر CCP أو البنك" : "Cliquez pour régler immédiatement par BaridiMob / Versement"}</p>
          </div>
        </div>
      </div>

      {/* 5 INDICATORS METRICS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div 
          onClick={() => {
            setActiveSubTab("offres");
            setOffreFilterStatus("actifs");
          }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-[#1D9E75]/40 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour afficher les détails des offres"
          id="kpi-do-offres"
        >
          <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider group-hover:text-[#1D9E75] transition-colors">📋 Offres Actives</span>
          <span className="text-2xl font-black text-slate-800 block mt-2">
            {activeOffersCount || 3}
          </span>
          <span className="text-[10px] text-[#1D9E75] font-bold mt-1 underline group-hover:no-underline">Sur la Bourse →</span>
        </div>

        <div 
          onClick={() => {
            setActiveSubTab("propositions");
            setSelectedOffreForProps(null);
          }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour étudier les propositions reçues"
          id="kpi-do-props"
        >
          <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider group-hover:text-blue-600 transition-colors">📬 Propositions</span>
          <span className="text-2xl font-black text-blue-600 block mt-2">
            {countNewProps || 7}
          </span>
          <span className="text-[10px] text-blue-500 font-bold mt-1 underline group-hover:no-underline">À étudier →</span>
        </div>

        <div 
          onClick={() => {
            setActiveSubTab("missions");
            setMissionFilterStatus("en_cours");
          }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour suivre vos acheminements en cours"
          id="kpi-do-missions"
        >
          <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider group-hover:text-emerald-600 transition-colors">🚚 Missions en cours</span>
          <span className="text-2xl font-black text-emerald-600 block mt-2">
            {countMissions || 2}
          </span>
          <span className="text-[10px] text-emerald-500 font-bold mt-1 underline group-hover:no-underline">Acheminements actifs →</span>
        </div>

        <div 
          onClick={() => {
            setActiveSubTab("missions");
            setMissionFilterStatus("livrees");
          }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour voir les livraisons validées"
          id="kpi-do-delivs"
        >
          <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider group-hover:text-slate-900 transition-colors">✅ Livraisons ce mois</span>
          <span className="text-2xl font-black text-slate-900 block mt-2">
            {countLivreesCeMois || 8}
          </span>
          <span className="text-[10px] text-gray-400 font-bold mt-1 underline group-hover:no-underline">Suivi des livraisons →</span>
        </div>

        <div 
          onClick={() => {
            setActiveSubTab("factures");
            setFactureFilter("toutes");
          }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1 cursor-pointer hover:shadow-md hover:border-[#1D9E75]/40 hover:-translate-y-0.5 transition-all duration-200 group"
          title="Cliquez pour voir le détail financier et les factures"
          id="kpi-do-expenses"
        >
          <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider group-hover:text-[#1D9E75] transition-colors">💰 Dépenses ce mois</span>
          <span className="text-xl font-black text-[#1D9E75] block mt-2">
            {totalExpenses.toLocaleString()} DA
          </span>
          <span className="text-[10px] text-slate-400 font-bold mt-1 underline group-hover:no-underline">Total facturé →</span>
        </div>
      </div>

      {/* 5 SUB-TABS INTERFACE */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <button 
            onClick={() => setActiveSubTab("offres")}
            className={`px-4 py-3 flex items-center gap-1.5 border-b-2 transition duration-150 cursor-pointer ${activeSubTab === "offres" ? "border-[#1D9E75] text-[#1D9E75]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            📋 {lang === "ar" ? "عروضي للطلب" : "Mes offres"}
          </button>
          
          <button 
            onClick={() => setActiveSubTab("missions")}
            className={`px-4 py-3 flex items-center gap-1.5 border-b-2 transition duration-150 cursor-pointer ${activeSubTab === "missions" ? "border-[#1D9E75] text-[#1D9E75]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            🚚 {lang === "ar" ? "عمليات الشحن" : "Missions"}
          </button>

          <button 
            onClick={() => setActiveSubTab("propositions")}
            className={`px-4 py-3 flex items-center gap-1.5 border-b-2 transition duration-150 cursor-pointer ${activeSubTab === "propositions" ? "border-[#1D9E75] text-[#1D9E75]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            📬 {lang === "ar" ? "تسعيرات الناقلين" : "Propositions"}
            {countNewProps > 0 && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{countNewProps}</span>}
          </button>

          <button 
            onClick={() => setActiveSubTab("factures")}
            className={`px-4 py-3 flex items-center gap-1.5 border-b-2 transition duration-150 cursor-pointer ${activeSubTab === "factures" ? "border-[#1D9E75] text-[#1D9E75]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            💳 {lang === "ar" ? "الفواتير والمالية" : "Factures"}
          </button>

          <button 
            onClick={() => setActiveSubTab("devis")}
            className={`px-4 py-3 flex items-center gap-1.5 border-b-2 transition duration-150 cursor-pointer ${activeSubTab === "devis" ? "border-[#1D9E75] text-[#1D9E75]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            ✒️ {lang === "ar" ? "المقايسات واللجان" : "Devis & Comparatifs"}
            {devis.filter(d => d.donneurId === currentUser.id && d.status === "Signé").length > 0 && (
              <span className="bg-[#D85A30] text-white text-[9px] px-1.5 py-0.5 rounded-full">
                {devis.filter(d => d.donneurId === currentUser.id && d.status === "Signé").length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveSubTab("compte")}
            className={`px-4 py-3 flex items-center gap-1.5 border-b-2 transition duration-150 cursor-pointer ${activeSubTab === "compte" ? "border-[#1D9E75] text-[#1D9E75]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            ⚙️ {lang === "ar" ? "بيانات شركتي" : "Mon compte"}
          </button>
        </div>
      </div>

      {/* SUB-TAB CONTENTS */}

      {/* 1. OFFRES SUB-TAB */}
      {activeSubTab === "offres" && (
        <div className="space-y-4">
          
          <button 
            onClick={() => {
              setEditingOffreId(null);
              setSuccessPublishMsg("");
              setShowCreateModal(true);
            }}
            className="w-full py-4 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-xl text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-600/30"
          >
            <Plus className="w-5 h-5 text-white animate-bounce" /> {lang === "ar" ? "نشر عرض شحن جديد" : "Nouvelle offre de fret"}
          </button>

          {/* BARRE DE FILTRAGE DES OFFRES */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 font-bold">
              <span className="text-slate-500 mr-1">{lang === "ar" ? "تصفية حسب:" : "Filtrer par :"}</span>
              <button 
                onClick={() => setOffreFilterStatus("tous")}
                className={`px-3 py-1.5 rounded-lg border transition ${offreFilterStatus === "tous" ? "bg-slate-900 border-slate-900 text-white font-black" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                {lang === "ar" ? "الكل" : "Tous"} ({doOffres.length})
              </button>
              <button 
                onClick={() => setOffreFilterStatus("actifs")}
                className={`px-3 py-1.5 rounded-lg border transition ${offreFilterStatus === "actifs" ? "bg-amber-600 border-amber-600 text-white font-black shadow-xs" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                {lang === "ar" ? "العروض النشطة" : "Offres Actives"} ({doOffres.filter(o => o.status === OffreStatus.Publie).length})
              </button>
              <button 
                onClick={() => setOffreFilterStatus("propositions")}
                className={`px-3 py-1.5 rounded-lg border transition ${offreFilterStatus === "propositions" ? "bg-blue-600 border-blue-600 text-white font-black shadow-xs" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                {lang === "ar" ? "مع عروض ناقلين" : "Avec Propositions"} ({doOffres.filter(o => propositions.some(p => p.offreId === o.id)).length})
              </button>
              <button 
                onClick={() => setOffreFilterStatus("en_cours")}
                className={`px-3 py-1.5 rounded-lg border transition ${offreFilterStatus === "en_cours" ? "bg-emerald-600 border-emerald-600 text-white font-black shadow-xs" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                {lang === "ar" ? "في الطريق" : "En cours"} ({doOffres.filter(o => o.status === OffreStatus.Attribue || o.status === OffreStatus.Charge).length})
              </button>
              <button 
                onClick={() => setOffreFilterStatus("livrees")}
                className={`px-3 py-1.5 rounded-lg border transition ${offreFilterStatus === "livrees" ? "bg-emerald-950 border-emerald-950 text-white font-black shadow-xs" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                {lang === "ar" ? "تم تسليمها" : "Livrées"} ({doOffres.filter(o => o.status === OffreStatus.Decharge || o.status === OffreStatus.Valide).length})
              </button>
            </div>
            {offreFilterStatus !== "tous" && (
              <button 
                onClick={() => setOffreFilterStatus("tous")}
                className="text-red-600 hover:text-red-800 font-extrabold flex items-center gap-1 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                {lang === "ar" ? "إلغاء التصفية ×" : "Réinitialiser ×"}
              </button>
            )}
          </div>

          {/* LISTE DES OFFRES */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase">
                  <th className="p-4">{lang === "ar" ? "المرجع" : "Référence"}</th>
                  <th className="p-4">{lang === "ar" ? "خط السير" : "Trajet"}</th>
                  <th className="p-4">{lang === "ar" ? "البضاعة" : "Marchandise"}</th>
                  <th className="p-4">{lang === "ar" ? "تاريخ الشحن" : "Date"}</th>
                  <th className="p-4 text-center">{lang === "ar" ? "الوضعية" : "Statut"}</th>
                  <th className="p-4 text-center">{lang === "ar" ? "العروض" : "Propositions"}</th>
                  <th className="p-4 text-center">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredDoOffres = doOffres.filter(offre => {
                    if (offreFilterStatus === "actifs") {
                      return offre.status === OffreStatus.Publie;
                    }
                    if (offreFilterStatus === "annulees") {
                      return offre.status === "Annulée";
                    }
                    if (offreFilterStatus === "en_cours") {
                      return offre.status === OffreStatus.Attribue || offre.status === OffreStatus.Charge;
                    }
                    if (offreFilterStatus === "livrees") {
                      return offre.status === OffreStatus.Decharge || offre.status === OffreStatus.Valide;
                    }
                    if (offreFilterStatus === "propositions") {
                      const offerProps = propositions.filter(p => p.offreId === offre.id);
                      return offerProps.length > 0;
                    }
                    return true;
                  });

                  if (filteredDoOffres.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400 italic">
                          {lang === "ar" 
                            ? "لا توجد عروض مطابقة للتصفية الحالية." 
                            : "Aucune offre de fret ne correspond à ce filtre actuellement."}
                        </td>
                      </tr>
                    );
                  }

                  return filteredDoOffres.map(offre => {
                    // Count proposals for this offer
                    const offerProps = propositions.filter(p => p.offreId === offre.id);
                    const proposalCount = offerProps.length;

                    // Compute dynamic status matching prompt rules:
                    // 🟡 En attente: publiée et 0 propositions
                    // 🔵 Propositions reçues: publiée et >= 1 propositions
                    // 🟢 Mission confirmée: "Attribué"
                    // 🔄 En cours: "Chargé / En cours"
                    // ✅ Livrée: "Déchargé" ou "Validé / Clôturé"
                    // ❌ Annulée: "Annulée"
                    let statusLabel = "En attente";
                    let statusColorStyle = "bg-amber-50 text-amber-700 border border-amber-200";
                    
                    if (offre.status === "Annulée") {
                      statusLabel = "Annulée";
                      statusColorStyle = "bg-rose-50 text-rose-700 border border-rose-200";
                    } else if (offre.status === OffreStatus.Valide || offre.status === OffreStatus.Decharge) {
                      statusLabel = "Livrée";
                      statusColorStyle = "bg-emerald-50 text-emerald-950 border border-emerald-300 font-extrabold";
                    } else if (offre.status === OffreStatus.Charge) {
                      statusLabel = "En cours";
                      statusColorStyle = "bg-emerald-100 text-emerald-950 border border-emerald-300 animate-pulse font-extrabold";
                    } else if (offre.status === OffreStatus.Attribue) {
                      statusLabel = "Mission confirmée";
                      statusColorStyle = "bg-teal-50 text-teal-950 border border-teal-300 font-extrabold";
                    } else if (proposalCount > 0) {
                      statusLabel = "Propositions reçues";
                      statusColorStyle = "bg-blue-50 text-blue-700 border border-blue-200";
                    }

                    return (
                      <tr key={offre.id} className="border-b border-slate-50 last:border-none hover:bg-slate-50/50 transition">
                        <td className="p-4 font-black text-slate-950 font-mono text-[11px]">{offre.id}</td>
                        <td className="p-4">
                          <p className="font-bold text-slate-800 flex items-center gap-1">
                            <span>{translateCity(offre.depart, lang)}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 inline" />
                            <span>{translateCity(offre.arrivee, lang)}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{offre.departDetails} ➔ {offre.arriveeDetails}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-slate-700">{translateMarchandise(offre.marchandise, lang)}</p>
                          <p className="text-[10px] text-slate-400">{offre.poids} Tonnes · {offre.volume ? `${offre.volume} m³` : `${offre.moyenExige}`}</p>
                        </td>
                        <td className="p-4 font-medium text-slate-500 font-mono">{offre.dateChargement}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-lg ${statusColorStyle}`}>
                            {statusLabel === "En cours" ? "🔄 " : statusLabel === "En attente" ? "🟡 " : statusLabel === "Propositions reçues" ? "🔵 " : statusLabel === "Mission confirmée" ? "🟢 " : statusLabel === "Livrée" ? "✅ " : "❌ "}
                            {statusLabel}
                          </span>
                        </td>
                        <td className="p-4 text-center font-bold">
                          {proposalCount > 0 ? (
                            <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-black">
                              {proposalCount} props
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">0 prop</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1.5 justify-center">
                            
                            {/* Actions according to status */}
                            {(statusLabel === "En attente" || statusLabel === "Propositions reçues") ? (
                              <>
                                <button 
                                  onClick={() => {
                                    setSelectedOffreForDetails(offre);
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300/60 text-slate-800 rounded-lg font-extrabold text-[10px] cursor-pointer transition active:scale-95 flex items-center gap-1"
                                >
                                  👁️ {proposalCount > 0 ? `Voir (${proposalCount})` : "Voir"}
                                </button>
                                <button
                                  onClick={() => {
                                    // Prepopulate form fields for edit
                                    setEditingOffreId(offre.id);
                                    setFormDepartWilaya(offre.depart);
                                    setFormDepartDetails(offre.departDetails || "");
                                    setFormArriveeWilaya(offre.arrivee);
                                    setFormArriveeDetails(offre.arriveeDetails || "");
                                    setFormNature(offre.marchandise);
                                    setFormPoids(offre.poids || "");
                                    setFormVolume(offre.volume || "");
                                    setFormConditionsPaiement(offre.conditionsPaiement || "Paiement à la livraison");
                                    setFormDateEnlevement(offre.dateChargement || "");
                                    setFormMontantFixe(offre.prixFixe || "");
                                    setFormCamionType(offre.moyenExige || MoyenType.Tautliner);
                                    setFormNombreVoyages(offre.nombreVoyages || 1);
                                    setShowCreateModal(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-[#378ADD] hover:bg-[#0C447C] text-white border border-[#378ADD]/30 rounded-lg font-extrabold text-[10px] cursor-pointer transition active:scale-95 flex items-center gap-1"
                                >
                                  ✏️ Modif
                                </button>
                                <button
                                  onClick={() => handleCancelOffre(offre.id)}
                                  className="px-2.5 py-1.5 bg-[#D85A30] hover:bg-[#bf4d26] text-white border border-[#D85A30]/30 rounded-lg font-extrabold text-[10px] cursor-pointer transition active:scale-95 flex items-center gap-1"
                                >
                                  ❌ Suppr
                                </button>
                              </>
                            ) : null}

                            {statusLabel === "Mission confirmée" && (
                              <div className="flex gap-1.5 items-center">
                                <span className="text-[10px] text-gray-400 italic font-mono mr-1">Alloué</span>
                                <button
                                  onClick={() => {
                                    setActiveSubTab("missions");
                                    triggerSystemLog(`Axe ${offre.depart} → ${offre.arrivee} alloué. En attente de chargement d'usine.`, "info");
                                  }}
                                  className="px-2.5 py-1.5 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-lg font-extrabold text-[10px] cursor-pointer transition active:scale-95 flex items-center gap-1"
                                >
                                  📍 Suivre
                                </button>
                              </div>
                            )}

                            {statusLabel === "En cours" && (
                              <div className="flex gap-1.5 items-center">
                                <button
                                  onClick={() => {
                                    setActiveSubTab("missions");
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-extrabold text-[10px] cursor-pointer transition active:scale-95 flex items-center gap-1"
                                >
                                  📍 Suivre
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMissionToValidate(offre);
                                    setValideConformite("conforme");
                                    setValideRating(5);
                                    setValideComment("");
                                    setValideReservesDesc("");
                                    setShowValideModal(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-lg font-extrabold text-[10px] cursor-pointer transition active:scale-95 flex items-center gap-1"
                                >
                                  ✅ Valider livraison
                                </button>
                              </div>
                            )}

                            {statusLabel === "Livrée" && (
                              <div className="flex gap-1.5 items-center">
                                <button
                                  onClick={() => {
                                    setActiveSubTab("factures");
                                  }}
                                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg font-extrabold text-[10px] cursor-pointer transition active:scale-95 flex items-center gap-1"
                                >
                                  📄 Facture
                                </button>
                                <button
                                  onClick={() => triggerSystemLog("Merci pour votre évaluation ! Les transporteurs sont notés sur 5⭐ pour réguler la bourse.", "success")}
                                  className="px-2.5 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg font-extrabold text-[10px] cursor-pointer transition active:scale-95 flex items-center gap-1"
                                >
                                  ⭐ Note
                                </button>
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. MISSIONS SUB-TAB */}
      {activeSubTab === "missions" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              🚚 {lang === "ar" ? "متابعة النقل والمسار اللوجيستي للمهام" : "Suivi Cartographique et Logistique des missions"}
            </h3>
            <span className="text-[11px] text-[#1D9E75] font-bold">
              {doOffres.filter(o => o.status === OffreStatus.Attribue || o.status === OffreStatus.Charge || o.status === OffreStatus.Decharge).length} {lang === "ar" ? "مهمة إجمالاً" : "missions au total"}
            </span>
          </div>

          {/* BARRE DE FILTRAGE DES MISSIONS */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 font-bold">
              <span className="text-slate-500 mr-1">{lang === "ar" ? "حالة المهمة:" : "État de la mission :"}</span>
              <button 
                onClick={() => setMissionFilterStatus("toutes")}
                className={`px-3 py-1.5 rounded-lg border transition ${missionFilterStatus === "toutes" ? "bg-slate-900 border-slate-900 text-white font-black" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                {lang === "ar" ? "الكل" : "Toutes les missions"}
              </button>
              <button 
                onClick={() => setMissionFilterStatus("en_cours")}
                className={`px-3 py-1.5 rounded-lg border transition ${missionFilterStatus === "en_cours" ? "bg-emerald-600 border-emerald-600 text-white font-black shadow-xs" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                📦 {lang === "ar" ? "قيد الشحن / الترانسيت" : "En cours de route"} ({doOffres.filter(o => o.status === OffreStatus.Attribue || o.status === OffreStatus.Charge).length})
              </button>
              <button 
                onClick={() => setMissionFilterStatus("livrees")}
                className={`px-3 py-1.5 rounded-lg border transition ${missionFilterStatus === "livrees" ? "bg-blue-600 border-blue-600 text-white font-black shadow-xs" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                ✅ {lang === "ar" ? "تم التسليم" : "Livrées ce mois"} ({doOffres.filter(o => o.status === OffreStatus.Decharge || o.status === OffreStatus.Valide).length})
              </button>
            </div>
            {missionFilterStatus !== "toutes" && (
              <button 
                onClick={() => setMissionFilterStatus("toutes")}
                className="text-red-600 hover:text-red-800 font-extrabold flex items-center gap-1 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                {lang === "ar" ? "إلغاء التصفية ×" : "Réinitialiser ×"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(() => {
              const filteredMissions = doOffres.filter(o => {
                const isMission = o.status === OffreStatus.Attribue || o.status === OffreStatus.Charge || o.status === OffreStatus.Decharge || o.status === OffreStatus.Valide;
                if (!isMission) return false;
                if (missionFilterStatus === "en_cours") {
                  return o.status === OffreStatus.Attribue || o.status === OffreStatus.Charge;
                }
                if (missionFilterStatus === "livrees") {
                  return o.status === OffreStatus.Decharge || o.status === OffreStatus.Valide;
                }
                return true;
              });

              if (filteredMissions.length === 0) {
                return (
                  <div className="md:col-span-2 p-12 bg-white rounded-3xl border border-slate-100 text-center text-slate-400 font-semibold italic w-full">
                    {lang === "ar" 
                      ? "لا توجد مهام مطابقة للتصفية الحالية." 
                      : "Aucune mission ne correspond à ce filtre actuellement."}
                  </div>
                );
              }

              return filteredMissions.map(mission => {
              
              // Determine current carrier for this offer or generate robust mock
              const carrierName = mission.transporteurRaisonSociale || "EURL Ahmed Benzekri Transports";
              const carrierTel = "0550 42 18 90";
              const vehiclePlate = "123456-116";
              const vehicleType = translateMoyenType(mission.moyenExige || MoyenType.Tautliner, lang) + " 30T";
              const amountDa = mission.prixConvenu || (mission.prixFixe || 80000);

              // Progress state:
              // 1. Attribue = attente_chargement
              // 2. Charge = en_route
              // 3. Decharge = livre / attente_validation
              let progressStep = 1;
              let progressPercentage = "25%";
              if (mission.status === OffreStatus.Charge) {
                progressStep = 2;
                progressPercentage = "65%";
              } else if (mission.status === OffreStatus.Decharge) {
                progressStep = 3;
                progressPercentage = "90%";
              }

              return (
                <div key={mission.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
                  <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                    <div>
                      <p className="text-[10px] font-black text-[#1D9E75] uppercase tracking-wide">MISSION LOGISTIQUE ACTIVE</p>
                      <h4 className="text-xs font-mono font-extrabold text-slate-800 mt-0.5">
                        {mission.id} ➔ MSS-2025-{mission.id.slice(-4)}
                      </h4>
                    </div>
                    <span className="font-mono text-xs font-black text-slate-900 border border-slate-100 bg-slate-50 px-2.5 py-1 rounded-full">
                      {amountDa.toLocaleString()} DA
                    </span>
                  </div>

                  {/* Visual Route */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-slate-900 px-1">
                      <span>{translateCity(mission.depart, lang)}</span>
                      <span className="text-[10px] text-emerald-600 font-extrabold font-mono uppercase bg-emerald-50 px-2 py-0.5 rounded-md animate-pulse">
                        {progressStep === 1 ? "Attente Chargement" : progressStep === 2 ? "En transit" : "Déchargé"}
                      </span>
                      <span>{translateCity(mission.arrivee, lang)}</span>
                    </div>

                    <div className="relative pt-1">
                      <div className="overflow-hidden h-2 text-xs flex rounded-full bg-slate-100">
                        <div 
                          style={{ width: progressPercentage }} 
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#1D9E75]"
                        ></div>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 font-bold px-1 mt-1.5">
                        <span className={progressStep >= 1 ? "text-slate-900 font-black" : ""}>📦 Enlèvement</span>
                        <span className={progressStep >= 2 ? "text-slate-900 font-black" : ""}>🚚 Sur la route</span>
                        <span className={progressStep >= 3 ? "text-slate-900 font-black" : ""}>🏢 Portée d'arrivée</span>
                      </div>
                    </div>
                  </div>

                  {/* CARRIER INFO PANEL */}
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-2 border border-slate-100/60">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-semibold">Transporteur :</span>
                      <strong className="text-slate-800 font-extrabold">🚛 {carrierName}</strong>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-semibold">Téléphone mobile :</span>
                      <a href={`tel:${carrierTel}`} className="text-indigo-600 hover:underline font-extrabold flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 inline text-indigo-500" /> {carrierTel}
                      </a>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-semibold">Véhicule & Matérielle :</span>
                      <strong className="text-slate-800 font-mono text-[11px]">{vehicleType} · Plaque : {vehiclePlate}</strong>
                    </div>
                  </div>

                  {/* BUTTON OPERATIONS */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (setActiveContractDoc) {
                          setActiveContractDoc({
                            type: "LETTRE-VOITURE",
                            offre: mission,
                            prop: propositions.find(p => p.offreId === mission.id && p.status === "Accepté")
                          });
                        }
                      }}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      📄 Lettre de voiture (LDV)
                    </button>

                    {mission.status === OffreStatus.Attribue && (
                      <button
                        onClick={() => handleConfirmLoading(mission)}
                        className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold transition cursor-pointer text-center"
                      >
                        📦 Confirmer chargement fait
                      </button>
                    )}

                    {mission.status === OffreStatus.Charge && (
                      <>
                        <button
                          onClick={() => {
                            setActiveMissionToValidate(mission);
                            setValideConformite("conforme");
                            setValideRating(5);
                            setValideComment("");
                            setValideReservesDesc("");
                            setShowValideModal(true);
                          }}
                          className="flex-1 py-3 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer text-center"
                        >
                          ✅ Valider la livraison
                        </button>
                        <button
                          onClick={() => {
                            triggerSystemLog(`Alerte Logistique transmise. Le commercial NETLOG prend contact sous 15 minutes avec le chauffeur ${carrierName}.`, "warning");
                          }}
                          className="px-3 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                        >
                          ⚠️ Signaler incident
                        </button>
                      </>
                    )}

                    {mission.status === OffreStatus.Valide && (
                      <div className="w-full flex items-center justify-between p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-[11px] font-bold">
                        <span>✅ Livraison clôturée. Dossier légal archive OK.</span>
                        <span className="font-mono text-[10px] font-black underline cursor-pointer" onClick={() => setActiveSubTab("factures")}>Consulter facture ➔</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            });
          })()}
          </div>
        </div>
      )}

      {/* 3. PROPOSITIONS SUB-TAB */}
      {activeSubTab === "propositions" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              📬 Propositions d'affrètement reçues par les transporteurs
            </h3>
            <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-full">{countNewProps} en attente de décision</span>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            {/* Filter by offer if selected */}
            {selectedOffreForProps && (
              <div className="bg-blue-50 p-4 rounded-2xl flex justify-between items-center text-xs font-bold text-blue-900 mb-2 border border-blue-100">
                <p>
                  📍 Filtré sur : {selectedOffreForProps.id} ({translateCity(selectedOffreForProps.depart, lang)} ➔ {translateCity(selectedOffreForProps.arrivee, lang)})
                </p>
                <button 
                  onClick={() => setSelectedOffreForProps(null)}
                  className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200"
                >
                  Effacer filtre ×
                </button>
              </div>
            )}

            {/* Propositions loop */}
            {(() => {
              const pendingProps = propositions.filter(p => {
                if (p.status !== "En attente") return false;
                if (selectedOffreForProps) return p.offreId === selectedOffreForProps.id;
                // Only show proposals belonging to DO's offers
                return doOffres.some(o => o.id === p.offreId);
              });

              if (pendingProps.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-400 italic">
                    Aucune proposition tarifaire reçue en attente actuellement. Vos offres publiées à prix libre apparaîtront ici dès qu'un chauffeur soumettra une cotation.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingProps.map(prop => {
                    const matchedOffre = offres.find(o => o.id === prop.offreId);
                    return (
                      <div key={prop.id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:border-blue-100 hover:bg-white transition duration-200 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                              COTE DU TRANSPORTEUR
                            </span>
                            <h4 className="text-xs font-extrabold text-slate-900 mt-1">{prop.transporteurRaisonSociale}</h4>
                            {matchedOffre && (
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                Pour : {matchedOffre.id} ({translateCity(matchedOffre.depart, lang)} ➔ {translateCity(matchedOffre.arrivee, lang)})
                              </p>
                            )}
                          </div>
                          <span className="font-mono text-xs font-black text-blue-700">
                            {prop.prixPropose.toLocaleString()} DA
                          </span>
                        </div>

                        {prop.commentaire && (
                          <div className="p-3 bg-white border border-slate-100 rounded-xl text-[11px] text-slate-600 italic">
                            💬 "{prop.commentaire}"
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 text-xs pt-1">
                          {(() => {
                            const alreadyRequested = (devis || []).some(
                              d => d.offreId === prop.offreId && d.transporteurId === prop.transporteurId
                            );
                            return (
                              <button
                                disabled={alreadyRequested}
                                onClick={() => !alreadyRequested && setDevisPropToConfirm(prop)}
                                className={`flex-1 py-2 font-extrabold rounded-lg text-[10.5px] flex items-center justify-center gap-1 transition select-none ${
                                  alreadyRequested 
                                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" 
                                    : "bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 cursor-pointer"
                                }`}
                              >
                                {alreadyRequested ? "✓ Devis demandé" : "📄 Demander un devis officiel"}
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => handleAcceptProposal(prop)}
                            className="flex-1 py-1 px-2 bg-[#1D9E75] hover:bg-[#085041] text-white font-extrabold rounded-lg text-[10.5px] cursor-pointer"
                          >
                            ✅ Accepter le prix
                          </button>
                          <button
                            onClick={() => {
                              const updatedProps = propositions.map(p => p.id === prop.id ? { ...p, status: "Rejeté" as const } : p);
                              saveState(undefined, undefined, undefined, updatedProps);
                              triggerSystemLog("Proposition déclinée.", "info");
                            }}
                            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[10.5px] cursor-pointer"
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. FACTURES SUB-TAB (ESPACE FACTURATION COMMERCIALE & CONSOLIDATION) */}
      {activeSubTab === "factures" && (() => {
        const todayDateStr = new Date().toISOString().split("T")[0];
        // Resolve all invoices belonging to this Shipper / DO
        const baseFactures = (factures && factures.length > 0) 
          ? factures.filter(f => f.donneurId === currentUser?.id)
          : [
              { id: "FAC-2026-004", dateEmission: todayDateStr, prestation: "Alger ➔ Bejaïa (Bois de charpente)", montant: 120000, status: "Facture Transmise", modeReglement: "Virement", transporteurId: "user-trans-1" },
              { id: "FAC-2026-003", dateEmission: "2026-05-18", prestation: "Oran ➔ Sétif (Ciment en vrac)", montant: 80000, status: "Facture Réglée", modeReglement: "Virement", dateReglement: "2026-05-20", transporteurId: "user-trans-2" },
              { id: "FAC-2026-002", dateEmission: "2026-05-12", prestation: "Alger ➔ Ghardaïa (Électroménager)", montant: 210000, status: "Facture Réglée", modeReglement: "BaridiMob", dateReglement: "2026-05-13", transporteurId: "user-trans-1" },
              { id: "FAC-2026-001", dateEmission: "2026-05-02", prestation: "Blida ➔ Annaba (Bobines d'Acier)", montant: 310000, status: "Retard", modeReglement: "Virement", transporteurId: "user-trans-3" }
            ];

        // Apply filters
        const filteredFactures = baseFactures.filter(f => {
          // Status Filter
          if (factureFilter === "attente" && f.status !== "Facture Transmise" && f.status !== "En attente") return false;
          if (factureFilter === "payees" && f.status !== "Facture Réglée" && f.status !== "Payée") return false;
          if (factureFilter === "retard" && f.status !== "Retard" && f.status !== "En retard") return false;

          // Period Filter
          if (facturePeriod === "mois") {
            const dateVal = new Date(f.dateEmission);
            const limit = new Date();
            limit.setDate(limit.getDate() - 30);
            if (dateVal < limit) return false;
          } else if (facturePeriod === "trimestre") {
            const dateVal = new Date(f.dateEmission);
            const limit = new Date();
            limit.setDate(limit.getDate() - 90);
            if (dateVal < limit) return false;
          }

          // Carrier Filter
          if (factureCarrier !== "tous" && f.transporteurId !== factureCarrier) return false;

          return true;
        });

        // Compute Financial Metrics (TTC)
        const computedCA = filteredFactures.reduce((acc, f) => acc + (f.montant * 1.19), 0);
        const computedEncaisse = filteredFactures
          .filter(f => f.status === "Facture Réglée" || f.status === "Payée")
          .reduce((acc, f) => acc + (f.montant * 1.19), 0);
        const computedCreances = computedCA - computedEncaisse;

        // Collect available carriers registered in local data
        const uniqueCarriersWithInvoices = Array.from(new Set(baseFactures.map(f => f.transporteurId).filter(Boolean)));

        const handleViewFactureDoc = (fact: any) => {
          if (!setActiveContractDoc) return;
          
          const isGrouped = !fact.offreId && fact.isMensuelleGroupee;
          const groupedOffres = isGrouped && fact.offreIds 
            ? offres.filter(o => fact.offreIds.includes(o.id))
            : [];
          
          const referenceOffre = isGrouped 
            ? {
                id: fact.id,
                depart: "Multi-départs (Bilan consolidé)",
                arrivee: "Multi-arrivées (Bilan consolidé)",
                marchandise: `Consolidation de ${groupedOffres.length} transports`,
                poids: groupedOffres.reduce((sum: number, o: any) => sum + (o.poids || 0), 0),
                nombreVoyages: groupedOffres.length,
                status: OffreStatus.Valide,
                dateLivraison: fact.dateEmission
              } as any
            : (offres.find(o => o.id === fact.offreId) || {
                id: fact.offreId || "OFFRE-101",
                depart: "Alger",
                arrivee: "Oran",
                marchandise: "Acheminements",
                poids: 22,
                nombreVoyages: 1,
                status: OffreStatus.Valide,
                dateLivraison: fact.dateEmission
              });

          const propInstance = propositions.find(p => p.offreId === referenceOffre.id && p.status === "Accepté");

          setActiveContractDoc({
            type: "FACTURE",
            offre: referenceOffre,
            prop: propInstance,
            fac: fact,
            groupedMissions: groupedOffres
          });
        };

        return (
          <div className="space-y-6 animate-fadeIn">
            
            {/* ESPACE DE FACTURATION METRICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              
              <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }} className="p-6 text-white rounded-3xl border border-slate-800 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#1D9E75] font-black uppercase tracking-wider block">
                    📊 Chiffre d'Affaires Transport (TTC)
                  </span>
                  <span className="text-xl font-black block font-mono">
                    {Math.round(computedCA).toLocaleString()} DA
                  </span>
                  <p className="text-[9.5px] text-slate-400">Base d'imposition fret de la période : {Math.round(computedCA / 1.19).toLocaleString()} DA HT</p>
                </div>
                <div className="w-11 h-11 bg-slate-800 rounded-2xl flex items-center justify-center text-xl">
                  💰
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-teal-700 font-extrabold uppercase tracking-wider block">
                    🟢 Prestations Encaissées / Acquittées
                  </span>
                  <span className="text-xl font-black block font-mono text-emerald-800">
                    {Math.round(computedEncaisse).toLocaleString()} DA
                  </span>
                  <span className="text-[9px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-black uppercase">
                    Libéré aux chauffeurs
                  </span>
                </div>
                <div className="w-11 h-11 bg-emerald-50 text-[#1D9E75] rounded-2xl flex items-center justify-center text-xl shrink-0">
                  ✓
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-red-600 font-extrabold uppercase tracking-wider block">
                    🔴 Créances Restantes / En sillage (TTC)
                  </span>
                  <span className="text-xl font-black block font-mono text-red-700">
                    {Math.round(computedCreances).toLocaleString()} DA
                  </span>
                  <span className="text-[9px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-black uppercase">
                    Virements en attente
                  </span>
                </div>
                <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-xl shrink-0">
                  ⏳
                </div>
              </div>

            </div>

            {/* BILLING SPACE ACTIONS PANEL */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    💳 ESPACE DE FACTURATION CENTRALISÉ (D'ORDRES)
                  </h3>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    Consolidez les charges de transport ou libérez les décomptes bancaires des missions régulières.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                  
                  {/* BUTTON ACTION: Arrêter la période de facturation */}
                  <button
                    onClick={handleGenerateMonthlyInvoice}
                    className="bg-slate-950 hover:bg-slate-800 text-white text-[11px] font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer w-full sm:w-auto justify-center"
                    title="Arrêter la période et regrouper toutes les prestations non facturées"
                  >
                    <FileText className="w-4 h-4 text-[#1D9E75]" />
                    Arrêter la période de facturation (Mensuelle)
                  </button>

                  {/* Period select */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border p-1 rounded-xl text-xs font-bold w-full sm:w-auto">
                    <span className="text-[10px] text-slate-400 font-black uppercase px-1.5">PÉRIODE :</span>
                    <select
                      value={facturePeriod}
                      onChange={(e) => setFacturePeriod(e.target.value as any)}
                      className="bg-white border text-xs rounded-lg px-2 py-1 font-bold cursor-pointer"
                    >
                      <option value="tous">Toutes périodes</option>
                      <option value="mois">Les 30 derniers jours</option>
                      <option value="trimestre">Trimestre en cours</option>
                    </select>
                  </div>

                  {/* Status filters */}
                  <div className="flex gap-1 bg-slate-50 p-1 rounded-xl text-[11px] font-bold border border-slate-100 w-full sm:w-auto justify-between">
                    {(["toutes", "attente", "payees", "retard"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setFactureFilter(tab)}
                        className={`px-3 py-1.5 rounded-lg capitalize cursor-pointer transition flex-1 sm:flex-initial text-center ${factureFilter === tab ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        {tab === "attente" ? "En attente" : tab === "payees" ? "Payées" : tab === "retard" ? "En retard" : "Toutes"}
                      </button>
                    ))}
                  </div>

                </div>
              </div>

              {/* TABLE LISTING */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-100 uppercase text-[9.5px] tracking-wider font-mono">
                      <th className="p-3">Numéro Facture</th>
                      <th className="p-3">Date d'émission</th>
                      <th className="p-3">Bénéficiaire / Émetteur</th>
                      <th className="p-3">Prestation Affrétée</th>
                      <th className="p-3 text-right">Montant HT</th>
                      <th className="p-3 text-right">TOTAL TTC (19%)</th>
                      <th className="p-3 text-center">Status administratif</th>
                      <th className="p-3 text-right">Lancer l'action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                    {filteredFactures.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center bg-slate-50 rounded-2xl text-slate-400 font-medium">
                          🍃 Aucune facture ne correspond à ces critères de filtrage de portefeuille.
                        </td>
                      </tr>
                    ) : (
                      filteredFactures.map(fact => {
                        const amount = fact.montant || 80000;
                        const ttc = Math.round(amount * 1.19);
                        const isGrp = !!fact.isMensuelleGroupee;
                        
                        // Resolve actual emitter or carrier label
                        const associatedCarrier = users.find(u => u.id === fact.transporteurId);
                        const displayCarrierName = isGrp 
                          ? "NETLOG PLATFORME CONSOLIDÉE" 
                          : associatedCarrier?.raisonSociale || "NETLOG Sarl (DO Conventionné)";

                        return (
                          <tr key={fact.id} className="hover:bg-slate-50/50 transition duration-150">
                            <td className="p-3 font-extrabold text-[#1D9E75] font-mono flex items-center gap-1.5">
                              <span>📄</span>
                              <span>{fact.id}</span>
                              {isGrp && (
                                <span className="bg-slate-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full" title="Contient plusieurs prestations groupées de la période">
                                  GROUPÉ
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-semibold text-slate-500 font-mono">{fact.dateEmission}</td>
                            <td className="p-3 font-black text-xs text-slate-900 truncate max-w-[160px]">{displayCarrierName}</td>
                            <td className="p-3 text-slate-600 truncate max-w-[200px]">{fact.prestation || "Acheminement logistique"}</td>
                            <td className="p-3 font-bold text-slate-500 text-right font-mono">{amount.toLocaleString()} DA</td>
                            <td className="p-3 font-black text-slate-900 text-right font-mono text-[12px] bg-[#1D9E75]/5">{ttc.toLocaleString()} DA</td>
                            <td className="p-3 text-center">
                              <span className={`inline-block border px-2.5 py-0.5 text-[9px] font-black rounded-full uppercase ${
                                fact.status === "Facture Réglée" || fact.status === "Payée" ? "bg-emerald-50 text-emerald-800 border-emerald-150" :
                                fact.status === "Retard" || fact.status === "En retard" ? "bg-rose-50 text-rose-800 border-rose-150 animate-pulse" :
                                "bg-slate-100 text-slate-700 border-slate-250"
                              }`}>
                                {fact.status === "Facture Réglée" || fact.status === "Payée" ? "Acquittée" : fact.status === "Retard" || fact.status === "En retard" ? "⚠️ Retard" : "En cours"}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex gap-1.5 justify-end">
                                <button 
                                  onClick={() => handleViewFactureDoc(fact)}
                                  className="px-2.5 py-1 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 text-[10.5px] flex items-center gap-1 cursor-pointer transition active:scale-95"
                                >
                                  👁 Ouvrir PDF
                                </button>
                                
                                {fact.status !== "Facture Réglée" && fact.status !== "Payée" && (
                                  <button 
                                    onClick={() => {
                                      setSelectedFactureToPay(fact);
                                      setShowReglementModal(true);
                                    }}
                                    className="px-2.5 py-1 bg-[#1D9E75] text-white hover:bg-[#0d4f3a] font-black rounded-lg text-[10.5px] cursor-pointer transition active:scale-95"
                                  >
                                    💳 Régler
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        );
      })()}

      {/* DEVIS & COMPARATIFS SUB-TAB */}
      {activeSubTab === "devis" && (
        <DevisModule 
          role="donneur"
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

      {/* 5. MON COMPTE SUB-TAB */}
      {activeSubTab === "compte" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              ⚙️ Fiche administrative du Donneur d'Ordre
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              Consultez vos justificatifs vérifiés par la commission administrative BVF de NETLOG Algérie.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="bg-slate-50 p-5 rounded-2xl space-y-3.5 border border-slate-100">
              <h4 className="font-extrabold text-slate-800 uppercase tracking-wider">📦 Identification légale</h4>
              
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-semibold">Raison Sociale:</span>
                  <strong className="text-slate-800 font-extrabold">{currentUser?.raisonSociale || "SARL BATIMEX"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Représentant officiel:</span>
                  <strong className="text-slate-800 font-extrabold">{currentUser?.nom || "Kamel"} {currentUser?.prenom || "Babassi"}</strong>
                </div>
                <div className="mt-1">
                  <span className="text-slate-400 block font-semibold">Registre de Commerce (RC):</span>
                  <strong className="text-slate-800 font-mono text-[10px]">{currentUser?.nrc || "16/00-482012B26"}</strong>
                </div>
                <div className="mt-1">
                  <span className="text-slate-400 block font-semibold">Numéro d'Identifiant Fiscal (NIF):</span>
                  <strong className="text-slate-800 font-mono text-[10px]">002016482103982</strong>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl space-y-3 border border-slate-100">
              <h4 className="font-extrabold text-slate-800 uppercase tracking-wider">🛡️ Sécurité & Contact</h4>
              
              <div className="text-[11px] space-y-2">
                <div>
                  <span className="text-slate-400 block font-semibold">Adresse Email d'affaires:</span>
                  <strong className="text-slate-800 font-bold">{currentUser?.email || "Kam.babassi@gmail.com"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Téléphone mobile direct:</span>
                  <strong className="text-slate-800 font-bold">{currentUser?.tel || "+213 (0) 550 12 34 56"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Statut KYC de l'entreprise:</span>
                  <span className="inline-block mt-0.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-black rounded-lg">
                    🛡️ Compte d'acteur validé KYC
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: NOUVELLE OFFRE DE FRET (Scrollable Modal) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  {editingOffreId ? "Modifier l'offre de fret" : "Créer et publier une cargaison nette"}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Remplissez avec soin les caractéristiques techniques requises pour recevoir des cotations directes de transporteurs agréés.
                </p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Success View */}
            {successPublishMsg ? (
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-[#1D9E75]/10 text-[#1D9E75] rounded-full flex items-center justify-center mx-auto text-3xl">
                  ✓
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">{lang === "ar" ? "تم النشر بنجاح" : "Fret publié avec succès !"}</h4>
                  <p className="text-xs text-slate-600">{successPublishMsg}</p>
                </div>

                <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-left space-y-2 w-full">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-[10px] text-amber-950 uppercase tracking-wide flex items-center gap-1">
                        🚀 BOOSTER CETTE OFFRE
                      </span>
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                        Bientôt disponible
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-900 font-semibold">
                      Augmentez la visibilité de votre annonce pour recevoir 3 fois plus de propositions d'affrètement sous 10 minutes.
                    </p>
                  </div>

                  <button 
                    onClick={() => {
                      setShowCreateModal(false);
                      setSuccessPublishMsg("");
                    }}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition cursor-pointer"
                  >
                    Fermer et retourner aux offres
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePublishOffre} className="p-6 md:p-8 space-y-6 text-xs text-slate-700">
                
                {/* SECTION 1 - TRAJET */}
                <div className="space-y-3.5">
                  <h4 className="font-black text-[11px] text-[#1D9E75] uppercase tracking-wider border-b border-slate-100 pb-1.5">
                    Section 1 — Trajet & Itinéraire
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Wilaya de départ *</label>
                      <select 
                        value={formDepartWilaya}
                        onChange={(e) => setFormDepartWilaya(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:ring-1 focus:ring-[#1D9E75] focus:outline-none"
                      >
                        {ALGERIAN_WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Commune / Adresse de départ *</label>
                      <input 
                        type="text" 
                        required
                        value={formDepartDetails}
                        onChange={(e) => setFormDepartDetails(e.target.value)}
                        placeholder="Ex: Port d'Alger, Usine Ciment, etc."
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#1D9E75] focus:outline-none placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Wilaya de destination *</label>
                      <select 
                        value={formArriveeWilaya}
                        onChange={(e) => setFormArriveeWilaya(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:ring-1 focus:ring-[#1D9E75] focus:outline-none"
                      >
                        {ALGERIAN_WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Commune / Adresse de destination *</label>
                      <input 
                        type="text" 
                        required
                        value={formArriveeDetails}
                        onChange={(e) => setFormArriveeDetails(e.target.value)}
                        placeholder="Ex: Zone Industrielle, Sétif"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#1D9E75] focus:outline-none placeholder-slate-400"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={formAllerRetour}
                        onChange={(e) => setFormAllerRetour(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-slate-700">Transport aller-retour réglementaire</span>
                    </label>

                    {formAllerRetour && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Wilaya de retour</label>
                          <select 
                            value={formRetourWilaya}
                            onChange={(e) => setFormRetourWilaya(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          >
                            <option value="">Sélectionner la wilaya...</option>
                            {ALGERIAN_WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Adresse de retour / Dépôt de retour</label>
                          <input 
                            type="text" 
                            value={formRetourDetails}
                            onChange={(e) => setFormRetourDetails(e.target.value)}
                            placeholder="Ex: Dépôt principal Bab Ezzouar"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 2 - MARCHANDISE */}
                <div className="space-y-3.5">
                  <h4 className="font-black text-[11px] text-[#1D9E75] uppercase tracking-wider border-b border-slate-100 pb-1.5">
                    Section 2 — Détail & Descriptif de la marchandise
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Nature de la marchandise *</label>
                      <input 
                        type="text" 
                        required
                        value={formNature}
                        onChange={(e) => setFormNature(e.target.value)}
                        placeholder="Ex: Ciment en sacs, farine de blé, bouteilles de gaz"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#1D9E75] focus:outline-none placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Catégorie logistique *</label>
                      <select
                        value={formCategorie}
                        onChange={(e) => setFormCategorie(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-1 focus:ring-emerald-500"
                      >
                        {["Matériaux BTP", "Agroalimentaire", "Produits chimiques", "Équipements", "Marchandises générales", "Produits dangereux", "Matières premières", "Autre"].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Poids total (Tonnes) *</label>
                      <input 
                        type="number" 
                        step="any"
                        required
                        value={formPoids}
                        onChange={(e) => setFormPoids(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Ex: 25.5"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Volume total (m³)</label>
                      <input 
                        type="number" 
                        step="any"
                        value={formVolume}
                        onChange={(e) => setFormVolume(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Ex: 86"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Nombre de palettes</label>
                      <input 
                        type="number"
                        value={formPalettes}
                        onChange={(e) => setFormPalettes(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Ex: 33"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Type de conditionnement</label>
                      <select
                        value={formConditionnement}
                        onChange={(e) => setFormConditionnement(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50"
                      >
                        {["Vrac", "Palettes", "Caisses", "Containers", "Fûts", "Autre"].map(con => (
                          <option key={con} value={con}>{con}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Marchandise fragile ?</label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={formFragile} onChange={() => setFormFragile(true)} className="text-emerald-600 focus:ring-emerald-500" />
                          <span>Oui</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={!formFragile} onChange={() => setFormFragile(false)} className="text-emerald-600 focus:ring-emerald-500" />
                          <span>Non</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Marchandise dangereuse (ADR)</label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={formDangereuse} onChange={() => setFormDangereuse(true)} className="text-[#1D9E75] focus:ring-emerald-500" />
                          <span>Oui</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={!formDangereuse} onChange={() => setFormDangereuse(false)} className="text-[#1D9E75] focus:ring-emerald-500" />
                          <span>Non</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {formDangereuse && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-extrabold text-orange-950 uppercase mb-1">Classe de danger de la matière (ADR)*</label>
                        <input 
                          type="text"
                          required
                          value={formDangerClasse}
                          onChange={(e) => setFormDangerClasse(e.target.value)}
                          placeholder="Ex: Classe 3 - Liquides inflammables"
                          className="w-full px-3 py-2 border border-orange-300 rounded-xl focus:ring-1 focus:ring-orange-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center text-[10px] text-orange-850 font-bold max-w-md">
                        ⚠️ Les transporteurs répondant à cette offre devront obligatoirement disposer de la plaque orange ADR et d'un certificat APTH chauffeur valide.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Température requise</label>
                      <select 
                        value={formTemperatureVal}
                        onChange={(e) => setFormTemperatureVal(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50"
                      >
                        {["Ambiante", "Frais 0-4°C (Frigo)", "Congelé -18°C (Frigo)"].map(tem => (
                          <option key={tem} value={tem}>{tem}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 3 - TRANSPORT */}
                <div className="space-y-3.5">
                  <h4 className="font-black text-[11px] text-[#1D9E75] uppercase tracking-wider border-b border-slate-100 pb-1.5">
                    Section 3 — Besoins logistiques et véhicules requis
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Type de matériel camion requis *</label>
                      <select 
                        value={formCamionType}
                        onChange={(e) => setFormCamionType(e.target.value as MoyenType)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:ring-[#1D9E75]"
                      >
                        {Object.values(MoyenType).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Tonnage requis minimum (T)</label>
                      <input 
                        type="number"
                        value={formTonnageRequis}
                        onChange={(e) => setFormTonnageRequis(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Ex: 30"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Nombre de voyages requis *</label>
                      <input 
                        type="number"
                        required
                        min={1}
                        value={formNombreVoyages}
                        onChange={(e) => setFormNombreVoyages(Number(e.target.value))}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Fréquence logistique</label>
                      <select 
                        value={formFrequence}
                        onChange={(e) => setFormFrequence(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50"
                      >
                        {["Unique", "Hebdomadaire", "Mensuel", "Sur demande"].map(fr => (
                          <option key={fr} value={fr}>{fr}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Date d'enlèvement souhaitée *</label>
                      <input 
                        type="date"
                        required
                        value={formDateEnlevement}
                        onChange={(e) => setFormDateEnlevement(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Date limite d'enlèvement (optionnel)</label>
                      <input 
                        type="date"
                        value={formDateLimiteEnlevement}
                        onChange={(e) => setFormDateLimiteEnlevement(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Heure d'enlèvement souhaitée</label>
                      <input 
                        type="time"
                        value={formHeureSouhaitee}
                        onChange={(e) => setFormHeureSouhaitee(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Instructions de manutention / chargement</label>
                      <textarea 
                        rows={2}
                        value={formInstructionsChargement}
                        onChange={(e) => setFormInstructionsChargement(e.target.value)}
                        placeholder="Ex: Prévoir sangles d'arrimage solides de 5T, accès possible aux camions articulés par le quai arrière."
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:outline-none"
                      ></textarea>
                    </div>
                  </div>
                </div>

                {/* SECTION 4 - TARIFICATION */}
                <div className="space-y-3.5">
                  <h4 className="font-black text-[11px] text-[#1D9E75] uppercase tracking-wider border-b border-slate-100 pb-1.5">
                    Section 4 — Tarification & Conditions de paiement
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Mode de Tarification proposé</label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={formTarifMode === "fixe"} onChange={() => setFormTarifMode("fixe")} className="text-[#1D9E75]" />
                          <span className="font-semibold text-slate-700">Prix fixe (Je décide du prix)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={formTarifMode === "libre"} onChange={() => setFormTarifMode("libre")} className="text-[#1D9E75]" />
                          <span className="font-semibold text-slate-700">Prix libre (Cotations libres)</span>
                        </label>
                      </div>
                    </div>

                    {formTarifMode === "fixe" ? (
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Montant en DA proposé *</label>
                        <input 
                          type="number" 
                          required
                          value={formMontantFixe}
                          onChange={(e) => setFormMontantFixe(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="Ex: 85000"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold"
                        />
                        <p className="text-[10px] text-emerald-600 font-medium mt-1">
                          📌 "Les transporteurs devront accepter ce prix" pour réserver la cargaison d'office.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Budget maximum estimé en DA (Optionnel)</label>
                        <input 
                          type="number" 
                          value={formBudgetMaxLibre}
                          onChange={(e) => setFormBudgetMaxLibre(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="Ex: 95000"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
                        />
                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                          🔒 Ce budget est crypté en interne et non visible par les transporteurs soumissionnaires de la Bourse.
                        </p>
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Conditions de règlement</label>
                      <select 
                        value={formConditionsPaiement}
                        onChange={(e) => setFormConditionsPaiement(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50"
                      >
                        {["Paiement à la livraison", "Sous 30 jours (Virement)", "Sous 60 jours (BNA/Cheque)", "Prépayé"].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 5 - OPTIONS */}
                <div className="space-y-3.5">
                  <h4 className="font-black text-[11px] text-[#1D9E75] uppercase tracking-wider border-b border-slate-100 pb-1.5">
                    Section 5 — Options & Administration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Assurance marchandise souhaitée (BVF Secure)</label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={formAssuranceSouhaitee} onChange={() => setFormAssuranceSouhaitee(true)} className="text-[#1D9E75]" />
                          <span>Oui (Couverture à hauteur de 10MC DA)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={!formAssuranceSouhaitee} onChange={() => setFormAssuranceSouhaitee(false)} className="text-[#1D9E75]" />
                          <span>Non (Assurance transporteur standard)</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Réf / Code Bon de Commande (Référence Interne)</label>
                      <input 
                        type="text"
                        value={formBonCommande}
                        onChange={(e) => setFormBonCommande(e.target.value)}
                        placeholder="Ex: BC-2025-X821"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Remarques doctrinales / Instructions spéciales</label>
                      <textarea 
                        rows={2}
                        value={formRemarques}
                        onChange={(e) => setFormRemarques(e.target.value)}
                        placeholder="Ex: Chauffeur avec gilet de sécurité et chaussures de sécurité obligatoires à l'usine."
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:outline-none"
                      ></textarea>
                    </div>
                  </div>
                </div>

                {/* Modal actions */}
                <div className="p-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50 rounded-b-3xl">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold bg-white hover:bg-slate-50 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    className="px-6 py-3 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-xl font-extrabold shadow-sm transition cursor-pointer"
                  >
                    {editingOffreId ? "Enregistrer les modifications" : "✓ Publier l'offre de fret"}
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CONFIRMATION DEMANDE DE DEVIS OFFICIEL */}
      {devisPropToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="space-y-1 text-center font-sans">
              <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">Demande de Devis Officiel</span>
              <h3 className="text-sm font-black text-slate-950 uppercase mt-2">Dossier de Consultation</h3>
            </div>
            
            <div className="p-4 bg-slate-50 border rounded-2xl text-xs text-slate-700 leading-relaxed font-semibold font-sans">
              Vous allez demander un devis officiel à <span className="text-slate-950 font-black">{devisPropToConfirm.transporteurRaisonSociale}</span>.
              <br /><br />
              Le transporteur devra confirmer et signer ce devis sous <span className="text-[#D85A30] font-black">48h</span>.
              <br /><br />
              <span className="text-slate-500 italic font-medium">⚠️ Remarque : Cette demande ne constitue pas une confirmation de mission définitive, elle sert à consolider votre dossier comparatif.</span>
            </div>

            <div className="flex gap-2 pt-1 font-sans">
              <button
                type="button"
                onClick={() => setDevisPropToConfirm(null)}
                style={{ backgroundColor: '#e2e8f0', color: '#1e293b' }}
                className="flex-1 py-2.5 hover:bg-slate-300 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const prop = devisPropToConfirm;
                  setDevisPropToConfirm(null);
                  handleRequestDevis(prop);
                }}
                style={{ backgroundColor: '#1C8c68', color: '#ffffff' }}
                className="flex-1 py-2.5 text-xs font-black uppercase rounded-xl shadow-xs transition cursor-pointer hover:bg-emerald-800"
              >
                ✅ Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: VALIDATION DE LA LIVRAISON (Écran 3 étoiles / réserves) */}
      {showValideModal && activeMissionToValidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6">
            
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  Validation de la livraison — {activeMissionToValidate.id}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Saisissez les informations de réception de marchandises pour libérer la retenue de garantie.
                </p>
              </div>
              <button 
                onClick={() => setShowValideModal(false)}
                className="p-1 bg-slate-100 rounded-full hover:bg-slate-200"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Questions list */}
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase">
                  La livraison s'est-elle déroulée correctement ?
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setValideConformite("conforme")}
                    className={`p-3 rounded-xl border text-center font-bold flex flex-col items-center justify-center transition ${
                      valideConformite === "conforme" 
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800" 
                        : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-xl">✅</span>
                    <span className="mt-1 text-[11px]">Conforme</span>
                    <span className="text-[8px] text-emerald-600/60 font-medium">Tout s'est bien passé</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValideConformite("reserves")}
                    className={`p-3 rounded-xl border text-center font-bold flex flex-col items-center justify-center transition ${
                      valideConformite === "reserves" 
                        ? "border-amber-500 bg-amber-50 text-amber-800" 
                        : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-xl">⚠️</span>
                    <span className="mt-1 text-[11px]">Avec réserves</span>
                    <span className="text-[8px] text-amber-600/60 font-medium">Problème mineur</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValideConformite("litige")}
                    className={`p-3 rounded-xl border text-center font-bold flex flex-col items-center justify-center transition ${
                      valideConformite === "litige" 
                        ? "border-rose-500 bg-rose-50 text-rose-800" 
                        : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-xl">❌</span>
                    <span className="mt-1 text-[11px]">Litige majeur</span>
                    <span className="text-[8px] text-rose-600/60 font-medium">Problème à signaler</span>
                  </button>
                </div>
              </div>

              {/* Reserves form details */}
              {valideConformite !== "conforme" && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Type de problème constaté</label>
                      <select 
                        value={valideReservesType}
                        onChange={(e) => setValideReservesType(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                      >
                        {["Retard d'acheminement", "Marchandise endommagée / avarie", "Quantité incorrecte", "Autre"].map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Preuve photo (Preuve justificative)</label>
                      <div className="relative">
                        <button type="button" className="w-full px-3 py-2 bg-white border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 text-[10px] font-bold text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5 text-slate-400" /> Joindre une photo
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Description détaillée du problème constaté *</label>
                    <textarea 
                      rows={2}
                      required
                      value={valideReservesDesc}
                      onChange={(e) => setValideReservesDesc(e.target.value)}
                      placeholder="Indiquez précisément l'état de la cargaison et le constat d'huissier de justice..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    ></textarea>
                  </div>
                </div>
              )}

              {/* Carrier Rating */}
              <div className="space-y-1.5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase">
                  Note attribuée au transporteur (Ahmed Benzekri)
                </label>
                <div className="flex gap-1.5 text-amber-400 text-lg py-1.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button 
                      key={star} 
                      type="button"
                      onClick={() => setValideRating(star)}
                      className="cursor-pointer font-black text-2xl transition hover:scale-115"
                    >
                      {star <= valideRating ? "★" : "☆"}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase mb-1">Commentaire sur le chauffeur ou la ponctualité (Optionnel)</label>
                  <input 
                    type="text"
                    value={valideComment}
                    onChange={(e) => setValideComment(e.target.value)}
                    placeholder="Chauffeur courtois, matériel un peu ancien mais propre."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

            </div>

            {/* Modal actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowValideModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-center text-xs font-bold"
              >
                Annuler
              </button>
              <button 
                onClick={handleValidateDeliveryFinal}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#1D9E75] hover:bg-[#085041] text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                ✓ Confirmer la validation de livraison
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: DETAIL COMPLET D'UNE OFFRE DE FRET */}
      {selectedOffreForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col my-8 max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl shrink-0">
              <div>
                <span className="text-[9px] font-black bg-[#378ADD]/10 text-[#378ADD] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Fiche Detaillee Fret
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mt-1.5">
                  <FileText className="w-4 h-4 text-[#1D9E75]" />
                  Référence {selectedOffreForDetails.id}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedOffreForDetails(null)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              
              {/* Statut Badge Banner */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-2xl">
                <span className="font-extrabold text-slate-600 uppercase tracking-widest text-[10px]">Statut de la cargaison</span>
                <span className={`px-3 py-1 text-[9.5px] font-black rounded-full uppercase tracking-wider ${
                  selectedOffreForDetails.status === "en_attente" || selectedOffreForDetails.status === "En attente"
                    ? "bg-blue-50 text-blue-750 border border-blue-200"
                    : selectedOffreForDetails.status === "Propositions reçues"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30"
                }`}>
                  {selectedOffreForDetails.status || "En attente"}
                </span>
              </div>

              {/* Trajet section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  Itinéraire & Adresses exactes
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                    <span className="font-bold text-slate-400 uppercase text-[9px] block">Départ (Chargement)</span>
                    <p className="font-black text-[13px] text-slate-900">
                      {translateCity(selectedOffreForDetails.depart, lang)}
                    </p>
                    {selectedOffreForDetails.departDetails && (
                      <p className="text-slate-500 font-medium text-[11px] italic bg-white p-2 rounded-lg border border-slate-100">
                        {selectedOffreForDetails.departDetails}
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                    <span className="font-bold text-slate-400 uppercase text-[9px] block">Arrivée (Déchargement)</span>
                    <p className="font-black text-[13px] text-slate-900">
                      {translateCity(selectedOffreForDetails.arrivee, lang)}
                    </p>
                    {selectedOffreForDetails.arriveeDetails && (
                      <p className="text-slate-500 font-medium text-[11px] italic bg-white p-2 rounded-lg border border-slate-100">
                        {selectedOffreForDetails.arriveeDetails}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Specifications section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#1D9E75]" />
                  Caractéristiques physiques de la cargaison
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="font-semibold text-slate-400 text-[9px] block uppercase">Marchandise</span>
                    <span className="font-extrabold text-[11px] text-slate-800 break-words">
                      {translateMarchandise(selectedOffreForDetails.marchandise, lang)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="font-semibold text-slate-400 text-[9px] block uppercase">Tonnage exigé</span>
                    <span className="font-extrabold text-[11px] text-slate-800">
                      {selectedOffreForDetails.poids || 20} Tonnes
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="font-semibold text-slate-400 text-[9px] block uppercase">Véhicule requis</span>
                    <span className="font-extrabold text-[11px] text-slate-800">
                      {translateMoyenType(selectedOffreForDetails.moyenExige, lang)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="font-semibold text-slate-400 text-[9px] block uppercase">Fréquence trajet</span>
                    <span className="font-extrabold text-[11px] text-slate-800">
                      {selectedOffreForDetails.nombreVoyages || 1} voyage(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Economic conditions section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Tarification & Conditions réglementaires
                </h4>
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-400 uppercase text-[9px] block">Offre financière proposée</span>
                    {selectedOffreForDetails.prixFixe ? (
                      <p className="font-black text-sm text-[#1D9E75]">
                        {selectedOffreForDetails.prixFixe.toLocaleString()} DA <span className="text-[10px] text-slate-400 font-bold">Fixe</span>
                      </p>
                    ) : (
                      <p className="font-black text-xs text-blue-700 uppercase">
                        Tarif libre (Soumissions de cotations)
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-slate-400 uppercase text-[9px] block">Conditions de paiement</span>
                    <p className="font-extrabold text-[11.5px] text-slate-800">
                      {selectedOffreForDetails.conditionsPaiement || "Paiement à la livraison"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Date section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#378ADD]" />
                  Calendrier d'exécution
                </h4>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[9px] block">Date de chargement (Enlèvement)</span>
                    <p className="font-black text-[11.5px] text-slate-800 flex items-center gap-1 mt-0.5">
                      📅 {selectedOffreForDetails.dateChargement || "Non spécifiée"}
                    </p>
                  </div>
                  {selectedOffreForDetails.dateLivraison && (
                    <div>
                      <span className="font-bold text-slate-400 uppercase text-[9px] block">Date finale de livraison</span>
                      <p className="font-black text-[11.5px] text-slate-800 flex items-center gap-1 mt-0.5">
                        🏁 {selectedOffreForDetails.dateLivraison}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Commentaire section */}
              {selectedOffreForDetails.commentaire && (
                <div className="p-4 bg-amber-50/40 border border-amber-100/70 rounded-2xl space-y-1.5">
                  <span className="font-black text-amber-800 uppercase text-[9px] block block">Note complémentaire du donneur d'ordre :</span>
                  <p className="text-slate-600 font-semibold italic text-[11px]">
                    "{selectedOffreForDetails.commentaire}"
                  </p>
                </div>
              )}

              {/* Proposals section inside details */}
              {(() => {
                const associatedProps = (propositions || []).filter(
                  p => p.offreId === selectedOffreForDetails.id && p.status === "En attente"
                );
                return (
                  <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/30 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-800 uppercase text-[9.5px]">Cotations reçues pour ce fret</span>
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                        {associatedProps.length} proposition(s)
                      </span>
                    </div>

                    {associatedProps.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-500 font-medium">
                          Des transporteurs agréés ont soumis des cotations tarifaires pour votre cargaison.
                        </p>
                        <button
                          onClick={() => {
                            setSelectedOffreForProps(selectedOffreForDetails);
                            setActiveSubTab("propositions");
                            setSelectedOffreForDetails(null);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                        >
                          👁️ Voir et comparer les {associatedProps.length} cotations
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic font-medium">
                        ⌛ En attente de cotations par les transporteurs agréés sur la bourse de fret.
                      </p>
                    )}
                  </div>
                );
              })()}

            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 sm:p-6 border-t border-slate-100 flex flex-col sm:flex-row gap-2 justify-between bg-slate-50 rounded-b-3xl shrink-0">
              
              {/* Left action: Modifier/Supprimer directly from modal if status is editable */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const o = selectedOffreForDetails;
                    setEditingOffreId(o.id);
                    setFormDepartWilaya(o.depart);
                    setFormDepartDetails(o.departDetails || "");
                    setFormArriveeWilaya(o.arrivee);
                    setFormArriveeDetails(o.arriveeDetails || "");
                    setFormNature(o.marchandise);
                    setFormPoids(o.poids || "");
                    setFormVolume(o.volume || "");
                    setFormConditionsPaiement(o.conditionsPaiement || "Paiement à la livraison");
                    setFormDateEnlevement(o.dateChargement || "");
                    setFormMontantFixe(o.prixFixe || "");
                    setShowCreateModal(true);
                    setSelectedOffreForDetails(null);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-[#378ADD] hover:bg-[#0C447C] text-white rounded-lg font-extrabold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette offre de fret ?")) {
                      handleCancelOffre(selectedOffreForDetails.id);
                      setSelectedOffreForDetails(null);
                    }
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-[#D85A30] hover:bg-[#bf4d26] text-white rounded-lg font-extrabold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                >
                  ❌ Supprimer
                </button>
              </div>

              {/* Right action: Fermer */}
              <button 
                onClick={() => setSelectedOffreForDetails(null)} 
                className="w-full sm:w-auto px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg cursor-pointer text-center text-xs"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: RÈGLEMENT D'UNE FACTURE */}
      {showReglementModal && selectedFactureToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <CreditCard className="w-4.5 h-4.5 text-emerald-500" />
                  Règlement de la Facture {selectedFactureToPay.id}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Effectuez le paiement direct pour libérer la lettre de transport et décharger legalement l'affréteur.
                </p>
              </div>
              <button onClick={() => setShowReglementModal(false)} className="p-1.5 bg-slate-200 rounded-full hover:bg-slate-300 cursor-pointer">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              
              {/* Facture Info Row */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">Montant total dû TTC :</span>
                  <p className="text-xl font-black text-[#1D9E75] font-mono mt-1">{(selectedFactureToPay.montant || 80000).toLocaleString()} DA</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase mb-1 block">Axe / Prestation logistique :</span>
                  <p className="font-bold text-slate-800">{selectedFactureToPay.prestation || "Alger ➔ Sétif (Ciment)"}</p>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-4">
                <h4 className="font-black text-[11px] text-[#1D9E75] uppercase tracking-wider">
                  Sélectionnez votre Mode de paiement
                </h4>
                
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-rose-100 text-rose-800 rounded-lg text-lg">💳</div>
                      <div>
                        <strong className="text-slate-800 font-extrabold">BaridiMob / CCP Algérie Poste</strong>
                        <p className="text-[10px] text-slate-400 font-semibold">Virement direct instantané sur CCP 1234567 H 89 · Clé 42</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-rose-700 font-black bg-white border border-rose-100 px-3 py-1 rounded">
                      Réf: {selectedFactureToPay.id}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-100 text-indigo-800 rounded-lg text-lg">🏦</div>
                      <div>
                        <strong className="text-slate-800 font-extrabold">Virement Bancaire Direct BNA</strong>
                        <p className="text-[10px] text-slate-400 font-semibold">RIB de l'intermédiaire BVF : 00200 05100 0000001092 56</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-2.5">
                    <div className="p-2 bg-yellow-100 text-yellow-800 rounded-lg text-lg">💵</div>
                    <div>
                      <strong className="text-slate-800 font-extrabold">Espèces (via Commercial BVF)</strong>
                      <p className="text-[10px] text-slate-400 font-semibold">Collecte par mandat en agence ou bureau local de NETLOG.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Justificatif Upload */}
              <div className="p-5 bg-indigo-50/50 border border-indigo-100/60 rounded-2xl space-y-3">
                <label className="block text-[10px] font-black text-indigo-950 uppercase">
                  Pièce comptable justificative d'exécution de paiement *
                </label>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <button 
                    type="button" 
                    onClick={() => {
                      setUploadedJustifName("RECU_PAIEMENT_NETLOG.pdf");
                      triggerSystemLog("Justificatif de virement joint correctement !", "success");
                    }}
                    className="w-full sm:w-auto px-4 py-3 bg-white border border-dashed border-indigo-200 rounded-xl hover:bg-slate-50/50 transition font-bold text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-indigo-500" /> 
                    📎 Joindre le justificatif de paiement
                  </button>
                  {uploadedJustifName ? (
                    <span className="text-[10px] text-emerald-700 font-black">
                      ✓ Fichier joint : {uploadedJustifName}
                    </span>
                  ) : (
                    <span className="text-[10px] text-indigo-400 italic">
                      Aucun bordereau attaché pour le moment.
                    </span>
                  )}
                </div>
              </div>

            </div>

            <div className="p-4 sm:p-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2.5 justify-end bg-slate-50 rounded-b-3xl">
              <button 
                onClick={() => setShowReglementModal(false)} 
                className="w-full sm:w-auto px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg cursor-pointer text-center text-xs"
              >
                Fermer
              </button>
              <button 
                onClick={handleDeclarePayment}
                className="w-full sm:w-auto px-5 py-3 bg-[#1D9E75] hover:bg-[#085041] text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                ✅ Déclarer le paiement effectué
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
