import { supabase } from './supabase';
import { createMissionFromProposal } from './missions';

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
  typeMoyenExige?: string;
  nombreVoyages?: number;
}

export async function createFreightOffer(input: CreateFreightOfferInput) {
  console.log('[NETLOG] createFreightOffer() appelé', input);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  console.log('[NETLOG] Session Supabase', {
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
      'Utilisateur non authentifié dans Supabase. La session est absente.'
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
    type_moyen_exige: input.typeMoyenExige,
    nombre_voyages: input.nombreVoyages,
  };

  console.log('[NETLOG] INSERT freight_offers', payload);

  const { data, error } = await supabase
    .from('freight_offers')
    .insert(payload)
    .select()
    .single();

  console.log('[NETLOG] Résultat INSERT freight_offers', {
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
        error.details ? ` — ${error.details}` : ''
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

export async function listOpenOffers(filters?: {
  wilayaDepart?: number;
}) {
  let query = supabase
    .from('freight_offers')
    .select(
      'id, wilaya_depart, wilaya_arrivee, point_repere_depart, point_repere_arrivee, poids_kg, prix_propose, payment_method, date_enlevement_souhaitee, created_at'
    )
    .eq('status', 'ouverte')
    .order('created_at', { ascending: false })
    .limit(50);

  if (filters?.wilayaDepart) {
    query = query.eq('wilaya_depart', filters.wilayaDepart);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Chargement des offres échoué: ${error.message}`
    );
  }

  return data;
}

export interface CreateVehicleInput {
  type: string;
  immatriculation: string;
  capaciteKg?: number;
  wilayaBase?: number;
  isAvailable?: boolean;
}

export async function createVehicle(input: CreateVehicleInput) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`Session: ${sessionError.message}`);
  }

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error(
      'Utilisateur non authentifié dans Supabase. La session est absente.'
    );
  }

  const payload = {
    transporteur_id: userId,
    type: input.type,
    immatriculation: input.immatriculation,
    capacite_kg: input.capaciteKg,
    wilaya_base: input.wilayaBase,
    is_available: input.isAvailable ?? true,
  };

  console.log('[NETLOG] INSERT vehicles', payload);

  const { data, error } = await supabase
    .from('vehicles')
    .insert(payload)
    .select()
    .single();

  console.log('[NETLOG] Résultat INSERT vehicles', {
    data,
    error,
  });

  if (error) {
    throw new Error(
      `Création véhicule échouée: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      'Véhicule: aucune donnée retournée'
    );
  }

  return data;
}

export async function submitProposal(params: {
  offerId: number;
  vehicleId?: number;
  chauffeurId?: string;
  prixPropose: number;
  message?: string;
}) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`Session: ${sessionError.message}`);
  }

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error(
      'Utilisateur non authentifié dans Supabase. La session est absente.'
    );
  }

  const payload = {
    offer_id: params.offerId,
    transporteur_id: userId,
    vehicle_id: params.vehicleId,
    chauffeur_id: params.chauffeurId,
    prix_propose: params.prixPropose,
    message: params.message,
  };

  console.log('[NETLOG] INSERT proposals', payload);

  const { data, error } = await supabase
    .from('proposals')
    .insert(payload)
    .select()
    .single();

  console.log('[NETLOG] Résultat INSERT proposals', {
    data,
    error,
  });

  if (error) {
    throw new Error(
      `Envoi de la proposition échoué: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      'Proposition: aucune donnée retournée'
    );
  }

  return data;
}

/**
 * Accepte une proposition pour une offre de fret.
 *
 * IMPORTANT :
 * - freight_offers reçoit uniquement les colonnes qui lui appartiennent.
 * - vehicle_id et chauffeur_id restent rattachés à la proposition.
 * - la proposition sélectionnée passe à "acceptee".
 * - les autres propositions de la même offre passent à "refusee".
 */
export async function acceptProposal(params: {
  offerId: number;
  proposalId: number;
}) {
  console.log('[NETLOG] acceptProposal', params);

  // ============================================================
  // 1. Charger la proposition sélectionnée
  // ============================================================

  const { data: prop, error: propLoadError } = await supabase
    .from('proposals')
    .select(
      'id, offer_id, transporteur_id, vehicle_id, chauffeur_id'
    )
    .eq('id', params.proposalId)
    .eq('offer_id', params.offerId)
    .single();

  if (propLoadError || !prop) {
    throw new Error(
      `Proposition introuvable: ${
        propLoadError?.message ?? 'sans données'
      }`
    );
  }

  console.log('[NETLOG] Proposition sélectionnée', prop);

  // ============================================================
  // 2. Vérification de cohérence
  // ============================================================

  if (Number(prop.offer_id) !== Number(params.offerId)) {
    throw new Error(
      "La proposition sélectionnée n'appartient pas à cette offre."
    );
  }

  if (!prop.transporteur_id) {
    throw new Error(
      'La proposition sélectionnée ne possède aucun transporteur.'
    );
  }

  // ============================================================
  // 3. Vérifier que l'offre existe et est encore ouverte
  // ============================================================

  const { data: currentOffer, error: offerLoadError } = await supabase
    .from('freight_offers')
    .select('id, status')
    .eq('id', params.offerId)
    .single();

  if (offerLoadError || !currentOffer) {
    throw new Error(
      `Offre introuvable: ${
        offerLoadError?.message ?? 'sans données'
      }`
    );
  }

    if (currentOffer.status !== 'ouverte') {
    throw new Error(
      `Cette offre ne peut plus être attribuée. Statut actuel: ${currentOffer.status}`
    );
  }

  // ============================================================
  // 4. Attribuer l'offre au transporteur
  //
  // IMPORTANT :
  // NE PAS envoyer vehicle_id / chauffeur_id à freight_offers.
  // Ces informations sont conservées dans proposals.
  // ============================================================

  const { data: updatedOffer, error: offerError } = await supabase
    .from('freight_offers')
    .update({
      status: 'attribuee',
      transporteur_id: prop.transporteur_id,
    })
    .eq('id', params.offerId)
    .select()
    .single();

  if (offerError) {
    throw new Error(
      `Mise à jour de l'offre échouée: ${offerError.message}`
    );
  }

  if (!updatedOffer) {
    throw new Error(
      "Mise à jour de l'offre échouée: aucune offre retournée."
    );
  }

  console.log('[NETLOG] Offre attribuée', {
    offerId: params.offerId,
    transporteurId: prop.transporteur_id,
  });

  // ============================================================
  // 5. Accepter la proposition sélectionnée
  // ============================================================

  const { error: proposalError } = await supabase
    .from('proposals')
    .update({
      status: 'acceptee',
    })
    .eq('id', params.proposalId)
    .eq('offer_id', params.offerId);

  if (proposalError) {
    throw new Error(
      `Mise à jour de la proposition échouée: ${proposalError.message}`
    );
  }

  // ============================================================
  // 6. Refuser les autres propositions
  // ============================================================

  const { error: rejectError } = await supabase
    .from('proposals')
    .update({
      status: 'refusee',
    })
    .eq('offer_id', params.offerId)
    .neq('id', params.proposalId);

  if (rejectError) {
    console.warn(
      '[NETLOG] Refus des autres propositions:',
      rejectError.message
    );
  }

  // ============================================================
  // 7. Journalisation finale
  // ============================================================


  // Créer la mission terrain (source de vérité chargement/déchargement)
  try {
    await createMissionFromProposal({
      offerId: params.offerId,
      transporteurId: prop.transporteur_id,
      vehicleId: prop.vehicle_id ?? null,
      chauffeurId: prop.chauffeur_id ?? null,
    });
  } catch (missionErr: any) {
    console.warn('[NETLOG] createMissionFromProposal:', missionErr?.message ?? missionErr);
  }

  console.log('[NETLOG] acceptProposal OK', {
    offerId: params.offerId,
    proposalId: params.proposalId,
    transporteur_id: prop.transporteur_id,
    vehicle_id: prop.vehicle_id ?? null,
    chauffeur_id: prop.chauffeur_id ?? null,
  });

  // ============================================================
  // 8. Retourner les données utiles à l'interface
  // ============================================================

  return {
    offer: updatedOffer,
    proposal: {
      id: prop.id,
      offer_id: prop.offer_id,
      transporteur_id: prop.transporteur_id,
      vehicle_id: prop.vehicle_id ?? null,
      chauffeur_id: prop.chauffeur_id ?? null,
      status: 'acceptee',
    },
  };
}
