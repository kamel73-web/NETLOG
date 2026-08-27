import { ProfileType } from '../types';
import type { UserProfile } from '../types';

const ROLE_TO_PROFILE_TYPE: Record<string, ProfileType> = {
  donneur_ordre: ProfileType.DonneurOrdre,
  transporteur: ProfileType.Transporteur,
  chauffeur: ProfileType.Chauffeur,
  commercial: ProfileType.Commercial,
  admin: ProfileType.Admin,
  commissionnaire: ProfileType.Commissionnaire,
  manutentionnaire: ProfileType.Manutentionnaire,
  stockage: ProfileType.Stockage,
};

export interface SupabaseProfileRow {
  id: string;
  phone: string;
  full_name: string;
  role: string;
  wilaya_code: number | null;
  entreprise: string | null;
  nif: string | null;
  transporteur_id: string | null;
  is_active: boolean;
  status?: 'en_attente' | 'valide' | 'suspendu';
  created_at: string;
  updated_at: string;
  prenom: string | null;
  nrc: string | null;
  adresse: string | null;
  metadata: Record<string, unknown>;
}

export function adaptSupabaseProfile(row: SupabaseProfileRow): UserProfile {
  const meta = row.metadata ?? {};

  return {
    id: row.id,
    nom: row.full_name,
    prenom: row.prenom ?? '',
    raisonSociale: row.entreprise ?? row.full_name,
    nrc: row.nrc ?? '',
    adresse: row.adresse ?? '',
    email: '',
    tel: row.phone,
    profil: ROLE_TO_PROFILE_TYPE[row.role] ?? ProfileType.DonneurOrdre,
    password: undefined,
    // ⚠️ Correction : la colonne `status` (en_attente/valide/suspendu,
    // migration 0005) est la vraie source de vérité du workflow de
    // validation par l'Admin. `is_active` (DEFAULT true) ne doit plus
    // servir à ça : sinon tout nouvel inscrit apparaît "valide" avant
    // toute validation, et un compte suspendu reste "valide" tant que
    // is_active n'est pas explicitement modifié.
    status: row.status ?? (row.is_active ? 'valide' : 'suspendu'),
    wilaya: row.wilaya_code != null ? String(row.wilaya_code) : undefined,
    typeEntite: (meta.typeEntite as string) ?? undefined,
    nif: row.nif ?? undefined,
    secteur: (meta.secteur as string) ?? undefined,
    volumeFret: (meta.volumeFret as string) ?? undefined,
    autorisationTransport: (meta.autorisationTransport as string) ?? undefined,
    nbCamions: (meta.nbCamions as string) ?? undefined,
    wilayaActivite: (meta.wilayaActivite as string) ?? undefined,
    diplome: (meta.diplome as string) ?? undefined,
    experienceTransport: (meta.experienceTransport as string) ?? undefined,
    wilayaIntervention: (meta.wilayaIntervention as string) ?? undefined,
    sourceDecouverte: (meta.sourceDecouverte as string) ?? undefined,
    dateInscription: row.created_at,
    hasAbonnement: (meta.hasAbonnement as boolean) ?? undefined,
    typeAbonnement: (meta.typeAbonnement as string) ?? undefined,
    dateAbonnement: (meta.dateAbonnement as string) ?? undefined,
    conventionSignee: (meta.conventionSignee as boolean) ?? undefined,
    dateConvention: (meta.dateConvention as string) ?? undefined,
    transporteurParentId: row.transporteur_id ?? undefined,
    disponibiliteChauffeur:
      (meta.disponibiliteChauffeur as UserProfile['disponibiliteChauffeur']) ?? 'Disponible',
    positionChauffeur: (meta.positionChauffeur as string) ?? undefined,
    // Objet brut transmis en plus des champs déjà extraits ci-dessus :
    // certains composants (ex. StockageDashboard) lisent des clés qui
    // n'ont pas encore de champ dédié dans UserProfile.
    metadata: meta as Record<string, any>,
  };
}
