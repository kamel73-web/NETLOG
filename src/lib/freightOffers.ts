import { supabase } from './supabase';

export interface CreateFreightOfferInput {
  wilayaDepart: number;
  communeDepartId?: number;
  pointRepereDepart?: string;
  latitudeDepart?: number;
  longitudeDepart?: number;
  wilayaArrivee: number;
  communeArriveeId?: number;
  pointRepereArrivee?: string;
  latitudeArrivee?: number;
  longitudeArrivee?: number;
  description?: string;
  poidsKg?: number;
  typeMarchandise?: string;
  prixPropose: number;
  paymentMethod: 'cash' | 'satim' | 'cib' | 'baridimob';
  dateEnlevementSouhaitee?: string;
}

export async function createFreightOffer(input: CreateFreightOfferInput) {
  console.log("[NETLOG] createFreightOffer() appelé", input);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  console.log("[NETLOG] Session Supabase", {
    hasSession: !!session,
    userId: session?.user?.id ?? null,
    sessionError: sessionError?.message ?? null,
  });

  if (sessionError) {
    throw new Error(
      `Erreur récupération session Supabase : ${sessionError.message}`
    );
  }

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié dans Supabase. La session est absente."
    );
  }

  const payload = {
    donneur_ordre_id: userId,
    wilaya_depart: input.wilayaDepart,
    commune_depart_id: input.communeDepartId,
    point_repere_depart: input.pointRepereDepart,
    latitude_depart: input.latitudeDepart,
    longitude_depart: input.longitudeDepart,
    wilaya_arrivee: input.wilayaArrivee,
    commune_arrivee_id: input.communeArriveeId,
    point_repere_arrivee: input.pointRepereArrivee,
    latitude_arrivee: input.latitudeArrivee,
    longitude_arrivee: input.longitudeArrivee,
    description: input.description,
    poids_kg: input.poidsKg,
    type_marchandise: input.typeMarchandise,
    prix_propose: input.prixPropose,
    payment_method: input.paymentMethod,
    date_enlevement_souhaitee: input.dateEnlevementSouhaitee,
  };

  console.log("[NETLOG] INSERT freight_offers", payload);

  const { data, error } = await supabase
    .from("freight_offers")
    .insert(payload)
    .select()
    .single();

  console.log("[NETLOG] Résultat INSERT freight_offers", {
    data,
    error: error
      ? {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      : null,
  });

  if (error) {
    throw new Error(
      `Création offre échouée : ${error.message}${
        error.details ? ` — ${error.details}` : ""
      }`
    );
  }

  if (!data) {
    throw new Error(
      "Création offre échouée : Supabase n'a retourné aucune donnée."
    );
  }

  return data;
}
export async function listOpenOffers(filters?: { wilayaDepart?: number }) {
  let query = supabase
    .from('freight_offers')
    .select('id, wilaya_depart, wilaya_arrivee, point_repere_depart, point_repere_arrivee, poids_kg, prix_propose, payment_method, date_enlevement_souhaitee, created_at')
    .eq('status', 'ouverte')
    .order('created_at', { ascending: false })
    .limit(50);

  if (filters?.wilayaDepart) {
    query = query.eq('wilaya_depart', filters.wilayaDepart);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Chargement des offres échoué: ${error.message}`);
  return data;
}

export async function submitProposal(params: {
  offerId: number;
  vehicleId?: number;
  chauffeurId?: string;
  prixPropose: number;
  message?: string;
}) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error('Utilisateur non authentifié');

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      offer_id: params.offerId,
      transporteur_id: userId,
      vehicle_id: params.vehicleId,
      chauffeur_id: params.chauffeurId,
      prix_propose: params.prixPropose,
      message: params.message,
    })
    .select()
    .single();

  if (error) throw new Error(`Envoi de la proposition échoué: ${error.message}`);
  return data;
}

export async function acceptProposal(params: { offerId: number; proposalId: number }) {
  const { error: offerError } = await supabase
    .from('freight_offers')
    .update({ status: 'attribuee' })
    .eq('id', params.offerId);
  if (offerError) throw new Error(`Mise à jour de l'offre échouée: ${offerError.message}`);

  const { error: proposalError } = await supabase
    .from('proposals')
    .update({ status: 'acceptee' })
    .eq('id', params.proposalId);
  if (proposalError) throw new Error(`Mise à jour de la proposition échouée: ${proposalError.message}`);
}
