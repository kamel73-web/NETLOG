/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ProfileType {
  DonneurOrdre = "Donneur d'ordre",
  Transporteur = "Transporteur",
  Commissionnaire = "Commissionnaire",
  Manutentionnaire = "Manutentionnaire",
  Stockage = "Espace de stockage",
  Commercial = "Commercial BVF",
  Admin = "Administrateur NETLOG",
  Chauffeur = "Chauffeur"
}
/**
 * Rôles métier du modèle pivot NETLOG.
 *
 * IMPORTANT :
 * ProfileType reste conservé pour assurer la compatibilité
 * avec les données et composants existants.
 */
export type NetlogRole =
  | "DO"
  | "TRANSITAIRE"
  | "TRANSPORTEUR"
  | "COMMERCIAL_FREELANCE"
  | "MANUTENTIONNAIRE"
  | "ADMIN";

/**
 * Classification métier d'un profil NETLOG.
 */
export interface NetlogProfileClassification {
  role: NetlogRole;
  /**
   * Le transitaire est fonctionnellement rattaché au domaine
   * Donneur d'Ordre dans le modèle pivot.
   */
  parentRole?: "DO";
  legacyProfileType: ProfileType;
}

/**
 * Convertit le profil historique vers le rôle métier pivot.
 *
 * Cette fonction permet de faire évoluer progressivement l'interface
 * sans casser les utilisateurs déjà enregistrés.
 */
export function classifyNetlogProfile(
  profil?: ProfileType | null
): NetlogProfileClassification | null {
  switch (profil) {
    case ProfileType.DonneurOrdre:
      return {
        role: "DO",
        legacyProfileType: ProfileType.DonneurOrdre,
      };

    case ProfileType.Commissionnaire:
      return {
        role: "TRANSITAIRE",
        parentRole: "DO",
        legacyProfileType: ProfileType.Commissionnaire,
      };

    case ProfileType.Transporteur:
      return {
        role: "TRANSPORTEUR",
        legacyProfileType: ProfileType.Transporteur,
      };

    case ProfileType.Commercial:
      return {
        role: "COMMERCIAL_FREELANCE",
        legacyProfileType: ProfileType.Commercial,
      };

    case ProfileType.Manutentionnaire:
      return {
        role: "MANUTENTIONNAIRE",
        legacyProfileType: ProfileType.Manutentionnaire,
      };

    case ProfileType.Admin:
      return {
        role: "ADMIN",
        legacyProfileType: ProfileType.Admin,
      };

    case ProfileType.Stockage:
    case ProfileType.Chauffeur:
    default:
      return null;
  }
}

/**
 * Teste le rôle métier pivot d'un profil.
 */
export function hasNetlogRole(
  profil: ProfileType | null | undefined,
  role: NetlogRole
): boolean {
  return classifyNetlogProfile(profil)?.role === role;
}
export interface UserProfile {
  id: string;
  nom: string;
  prenom: string;
  raisonSociale: string;
  nrc: string; // N° RC
  adresse: string;
  email: string;
  tel: string;
  profil: ProfileType;
  password?: string;
  status?: "valide" | "en_attente" | "suspendu";
  wilaya?: string;
  typeEntite?: string;
  nif?: string;
  secteur?: string;
  volumeFret?: string;
  autorisationTransport?: string;
  nbCamions?: string;
  wilayaActivite?: string;
  diplome?: string;
  experienceTransport?: string;
  wilayaIntervention?: string;
  sourceDecouverte?: string;
  dateInscription?: string;
  // Fields for commercial recruitment variables
  hasAbonnement?: boolean;
  typeAbonnement?: string;
  dateAbonnement?: string;
  conventionSignee?: boolean;
  dateConvention?: string;
  // Fields for driver profiles
  transporteurParentId?: string;
  disponibiliteChauffeur?: "Disponible" | "Indisponible" | "En route";
  positionChauffeur?: string;
}

export enum OffreStatus {
  Publie = "Publié",                         // En ligne sur la bourse
  Attribue = "Attribué",                     // Proposition acceptée, contrat signé
  Charge = "Chargé / En cours",              // Transporteur a validé le chargement
  Decharge = "Déchargé",                     // Transporteur a validé le déchargement
  Valide = "Validé / Clôturé",               // Destinataire/Client a validé avec ou sans réserves
}

export enum MoyenType {
  VUL = "VUL",
  Tracteur = "Tracteur",
  Tautliner = "Tautliner",
  Fourgon = "Fourgon",
  Plateau = "Plateau",
  PorteEngin = "Porte-engin",
  Citerne = "Citerne",
  CamionFrigorifique = "Camion frigorifique",
  BenneBasculante = "Benne basculante",
  CamionPorteur = "Camion porteur",
  Fardier = "Fardier",
}

export interface MoyenTransport {
  id: string;
  transporteurId: string;
  type: MoyenType;
  marque: string;
  immatriculation: string;
  poidsUtileMax: number; // en tonnes
  longueurMax: number; // en mètres
  modele?: string;
  largeur?: number;
  hauteur?: number;
  volume?: number;
  wilaya?: string;
  equipements?: {
    hayon: boolean;
    gps: boolean;
    bache: boolean;
    sangles: boolean;
    palettes: boolean;
  };
  assuranceValideDate?: string;
  techniqueValideDate?: string;
  disponibilite?: "Disponible" | "Occupé" | "En maintenance";
}

export interface OffreFret {
  id: string;
  donneurId: string;
  donneurRaisonSociale: string;
  depart: string; // Ex: Alger, Oran
  arrivee: string; // Ex: Adrar, HMD
  departDetails?: string; // wilaya, daira, commune, code postal
  arriveeDetails?: string;
  dateChargement: string;
  dateLivraison: string;
  poids: number; // en tonnes
  longueurExigee?: number; // en mètres
  marchandise: string;
  moyenExige: MoyenType;
  nombreVoyages: number;
  prixFixe?: number; // si fixé par le DO
  commentaire?: string;
  status: OffreStatus;
  contratLogistiquePath?: string;
  reserves?: string; // Mentionner des réserves si existantes
  reservesChargement?: string; // Réserves au chargement via SMS/E-mail
  reservesLivraison?: string; // Réserves à la livraison via SMS/E-mail
  transporteurRaisonSociale?: string; // Optionnel raison sociale du transporteur assigné
  chauffeurId?: string; // Chauffeur affecté par le transporteur
  chauffeurSignaleProbleme?: string; // Tout problème signalé par le chauffeur au transporteur
  codeConfirmation: string; // Code de confirmation à 4 chiffres à donner au déchargement
  dateCreation: string;
}

export interface PropositionPrix {
  id: string;
  offreId: string;
  transporteurId: string;
  transporteurRaisonSociale: string;
  moyenId: string; // Le moyen utilisé pour la soumission
  prixPropose: number;
  commentaire?: string;
  status: "En attente" | "Accepté" | "Rejeté" | "Incompatible";
  motifRejet?: string;
}

export enum FactureStatus {
  NonFacture = "Non Facturé",
  Transmise = "Facture Transmise",
  Reglee = "Facture Réglée",
}

export enum ReglementMode {
  Virement = "Virement",
  Versement = "Versement",
  Cheque = "Chèque",
  Espece = "Espèce",
}

export interface Facture {
  id: string;
  offreId: string;
  donneurId: string;
  transporteurId: string;
  montant: number;
  status: FactureStatus;
  modeReglement?: ReglementMode;
  dateEmission: string;
  dateReglement?: string;
  prestation?: string;
}

export interface DevisOfficiel {
  id: string; // Ex: DEV-AAAA-XXXX
  propositionId: string;
  offreId: string;
  transporteurId: string;
  transporteurRaisonSociale: string;
  transporteurNRC: string;
  transporteurNIF: string;
  transporteurNIS?: string;
  transporteurTel: string;
  transporteurAdresse: string;
  donneurId: string;
  donneurRaisonSociale: string;
  marchandise: string;
  depart: string;
  arrivee: string;
  poids: number;
  prixHT: number;
  tva: number; // 19%
  prixTTC: number;
  delaiTransport: number; // en jours
  dateEmission: string;
  dateValidite: string; // 15 jours de validite
  status: "Brouillon" | "En attente signature" | "Signé" | "Validé" | "demande" | "refuse" | "expire";
  signatureDessinee?: string; // base64 URL of canvas signature
  signatureTapee?: string; // Typed cursive name
  signatureType?: "drawn" | "typed" | "otp" | "cachet";
  signatureOTPCode?: string;
  signatureTime?: string;
  signatureIP?: string;
  hashSHA256?: string;
  cachetImagePath?: string; // Cachet image (can be base64 or custom graphic url)
  isLaureat?: boolean; // Surligné comme Offre la moins disante

  // New requested fields for exact localstorage schema sync
  doId?: string;
  statut?: "demande" | "en_attente_signature" | "signe" | "expire" | "refuse";
  dateCreation?: string;
  dateExpiration?: string;
  montantHT?: number;
  montantTTC?: number;
  signatureData?: string | null;
  hashDocument?: string | null;
  timestampSignature?: string | null;
  cachetsTransporteur?: string | null;
  ipSignataire?: string | null;
  methodSignature?: "dessinee" | "tapee" | "cachet" | "otp" | null;
}

