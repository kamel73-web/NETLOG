import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Configuration Supabase manquante : vérifie VITE_SUPABASE_URL et ' +
    'VITE_SUPABASE_ANON_KEY dans ton fichier .env.local'
  );
}

// Client unique partagé dans toute l'application.
// La clé "anon" est publique par design : c'est la RLS côté base
// (migrations 0002_rls.sql) qui protège réellement les données,
// pas le secret de cette clé.
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// ---------- Authentification par téléphone + OTP SMS ----------
// Priorité imposée par le cahier des charges : les chauffeurs n'utilisent
// pas l'email. Le numéro de téléphone est l'identifiant principal.

export type UserRole = 'donneur_ordre' | 'transporteur' | 'chauffeur' | 'commercial' | 'admin';

/**
 * Normalise un numéro algérien saisi localement (ex: 0551234567)
 * vers le format international requis par Supabase Auth (+213...).
 */
export function normalizeAlgerianPhone(rawPhone: string): string {
  const digitsOnly = rawPhone.replace(/[^\d]/g, '');
  if (digitsOnly.startsWith('213')) return `+${digitsOnly}`;
  if (digitsOnly.startsWith('0')) return `+213${digitsOnly.slice(1)}`;
  return `+213${digitsOnly}`;
}

/**
 * Étape 1 : envoie le code OTP par SMS au numéro donné.
 * Ne crée pas encore de compte — Supabase gère ça à la vérification.
 */
export async function sendPhoneOtp(rawPhone: string): Promise<{ error: string | null }> {
  const phone = normalizeAlgerianPhone(rawPhone);
  const { error } = await supabase.auth.signInWithOtp({ phone });
  return { error: error?.message ?? null };
}

/**
 * Étape 2 : vérifie le code reçu par SMS.
 * fullName et role ne sont utilisés que lors de la toute première
 * inscription (le trigger handle_new_user() les récupère depuis les
 * metadata pour créer la ligne `profiles`).
 */
export async function verifyPhoneOtp(params: {
  rawPhone: string;
  token: string;
  fullName?: string;
  role?: UserRole;
}): Promise<{ error: string | null }> {
  const phone = normalizeAlgerianPhone(params.rawPhone);
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: params.token,
    type: 'sms',
  });

  if (error) return { error: error.message };

  // Si c'est une première inscription, on complète les metadata utilisateur
  // (le trigger handle_new_user en base lit raw_user_meta_data à la création
  // du compte auth.users ; s'il s'agit d'une connexion existante, cet appel
  // est sans effet destructeur, il met juste à jour les metadata).
  if (params.fullName || params.role) {
    await supabase.auth.updateUser({
      data: { full_name: params.fullName, role: params.role },
    });
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Récupère le profil métier (table `profiles`) de l'utilisateur connecté.
 * Retourne null si personne n'est authentifié.
 */
export async function getCurrentProfile() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Erreur récupération profil:', error.message);
    return null;
  }
  return data;
}
