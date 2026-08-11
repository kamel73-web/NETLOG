import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Configuration Supabase manquante : vérifie VITE_SUPABASE_URL et ' +
    'VITE_SUPABASE_ANON_KEY dans ton fichier .env.local'
  );
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // nécessaire pour capter le lien de réinitialisation de mot de passe
  },
});

export type UserRole =
  | 'donneur_ordre'
  | 'transporteur'
  | 'chauffeur'
  | 'commercial'
  | 'admin'
  | 'commissionnaire'
  | 'manutentionnaire'
  | 'stockage';

export function normalizeAlgerianPhone(rawPhone: string): string {
  const digitsOnly = rawPhone.replace(/[^\d]/g, '');
  if (digitsOnly.startsWith('213')) return `+${digitsOnly}`;
  if (digitsOnly.startsWith('0')) return `+213${digitsOnly.slice(1)}`;
  return `+213${digitsOnly}`;
}

// ---------- Authentification par email + mot de passe ----------
// Le mot de passe n'est jamais manipulé en clair côté client au-delà de
// cet appel réseau chiffré (HTTPS) : Supabase Auth le hache côté serveur
// (bcrypt). Plus aucune comparaison JS côté client comme dans l'ancien code.

export async function signUpWithPassword(params: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    options: {
      data: {
        full_name: params.fullName,
        role: params.role,
        phone: params.phone,
      },
    },
  });
  return { error: error?.message ?? null };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  return { error: error?.message ?? null };
}

/**
 * Envoie un lien de réinitialisation par email. redirectTo doit pointer
 * vers une route de l'app qui affiche un formulaire "nouveau mot de passe"
 * et appelle updatePassword() ci-dessous.
 */
export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
  });
  return { error: error?.message ?? null };
}

/**
 * À appeler sur la page de réinitialisation, une fois que Supabase a
 * établi une session temporaire à partir du lien reçu par email.
 */
export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

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
