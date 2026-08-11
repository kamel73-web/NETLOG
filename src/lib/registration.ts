import { supabase, signUpWithPassword, normalizeAlgerianPhone, type UserRole } from './supabase';
import { adaptSupabaseProfile, type SupabaseProfileRow } from './profileAdapter';
import { ProfileType } from '../types';
import type { UserProfile } from '../types';

const PROFILE_TYPE_TO_ROLE: Partial<Record<ProfileType, UserRole>> = {
  [ProfileType.DonneurOrdre]: 'donneur_ordre',
  [ProfileType.Transporteur]: 'transporteur',
  [ProfileType.Chauffeur]: 'chauffeur',
  [ProfileType.Commercial]: 'commercial',
  [ProfileType.Commissionnaire]: 'commissionnaire' as UserRole,
  [ProfileType.Manutentionnaire]: 'manutentionnaire' as UserRole,
  [ProfileType.Stockage]: 'stockage' as UserRole,
};

export interface RegistrationInput {
  nom: string;
  prenom: string;
  email: string;
  password: string;
  tel: string;
  adresse: string;
  profil: ProfileType;
  wilaya?: string;
  raisonSociale?: string;
  nrc?: string;
  nif?: string;
  typeEntite?: string;
  secteur?: string;
  volumeFret?: string;
  autorisationTransport?: string;
  nbCamions?: string;
  wilayaActivite?: string;
  diplome?: string;
  experienceTransport?: string;
  wilayaIntervention?: string;
  sourceDecouverte?: string;
}

export async function submitRegistration(
  input: RegistrationInput
): Promise<{ profile: UserProfile | null; error: string | null }> {
  if (input.profil === ProfileType.Admin) {
    return { profile: null, error: "Impossible de créer un compte administrateur par inscription publique." };
  }
  const role = PROFILE_TYPE_TO_ROLE[input.profil];
  if (!role) return { profile: null, error: 'Type de profil non reconnu.' };

  const { error: signUpError } = await signUpWithPassword({
    email: input.email,
    password: input.password,
    fullName: `${input.prenom} ${input.nom}`.trim(),
    role,
    phone: input.tel ? normalizeAlgerianPhone(input.tel) : undefined,
  });
  if (signUpError) return { profile: null, error: signUpError };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return {
      profile: null,
      error: "Compte créé mais session absente — vérifie que la confirmation email est désactivée dans Supabase.",
    };
  }

  const metadata: Record<string, unknown> = {
    typeEntite: input.typeEntite,
    secteur: input.secteur,
    volumeFret: input.volumeFret,
    autorisationTransport: input.autorisationTransport,
    nbCamions: input.nbCamions,
    wilayaActivite: input.wilayaActivite,
    diplome: input.diplome,
    experienceTransport: input.experienceTransport,
    wilayaIntervention: input.wilayaIntervention,
    sourceDecouverte: input.sourceDecouverte,
  };

  const wilayaCode = input.wilaya ? Number(input.wilaya) : null;

  const { data, error } = await supabase
    .from('profiles')
    .update({
      prenom: input.prenom,
      adresse: input.adresse,
      entreprise: input.raisonSociale,
      nrc: input.nrc,
      nif: input.nif,
      wilaya_code: Number.isFinite(wilayaCode) ? wilayaCode : null,
      metadata,
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) return { profile: null, error: `Profil créé mais incomplet: ${error.message}` };

  return { profile: adaptSupabaseProfile(data as SupabaseProfileRow), error: null };
}
