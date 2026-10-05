import { supabase } from './supabase';

export async function createMissionFromProposal(params: {
  offerId: number;
  transporteurId: string;
  vehicleId?: number | null;
  chauffeurId?: string | null;
}) {
  // Évite les doublons si une mission existe déjà pour cette offre
  const { data: existing } = await supabase
    .from('missions')
    .select('id')
    .eq('offer_id', params.offerId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('missions')
    .insert({
      offer_id: params.offerId,
      transporteur_id: params.transporteurId,
      vehicle_id: params.vehicleId ?? null,
      chauffeur_id: params.chauffeurId ?? null,
      status: 'en_route_chargement',
    })
    .select()
    .single();

  if (error) throw new Error(`Création mission échouée: ${error.message}`);
  return data;
}


export async function getMissionIdByOfferId(offerId: number): Promise<number> {
  const { data, error } = await supabase
    .from('missions')
    .select('id')
    .eq('offer_id', offerId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Mission introuvable: ${error.message}`);
  if (!data?.id) throw new Error(`Aucune mission pour l'offre ${offerId}`);
  return Number(data.id);
}

export async function validateLoading(missionId: number, reserves?: string) {
  const payload: Record<string, unknown> = { status: 'en_route' };
  if (reserves?.trim()) payload.reserves_chargement = reserves.trim();

  const { data, error } = await supabase
    .from('missions')
    .update(payload)
    .eq('id', missionId)
    .select()
    .single();

  if (error) throw new Error(`Validation chargement échouée: ${error.message}`);

  if (data?.offer_id) {
    const { error: offerErr } = await supabase
      .from('freight_offers')
      .update({ status: 'en_cours' })
      .eq('id', data.offer_id);
    if (offerErr) {
      console.warn('[NETLOG] sync freight_offers en_cours:', offerErr.message);
    }
  }
  return data;
}

export async function validateUnload(missionId: number, reserves?: string) {
  const payload: Record<string, unknown> = { status: 'livree' };
  if (reserves?.trim()) payload.reserves_livraison = reserves.trim();

  const { data, error } = await supabase
    .from('missions')
    .update(payload)
    .eq('id', missionId)
    .select()
    .single();

  if (error) throw new Error(`Validation déchargement échouée: ${error.message}`);

  return data;
}

export async function confirmDelivery(params: {
  missionId: number;
  reserves?: string;
}) {
  console.log('[NETLOG] RPC confirm_delivery', {
    missionId: params.missionId,
    hasReserves: Boolean(params.reserves?.trim()),
  });

  const { data, error } = await supabase.rpc('confirm_delivery', {
    p_mission_id: params.missionId,
    p_reserves: params.reserves ?? null,
  });

  console.log('[NETLOG] Résultat RPC confirm_delivery', {
    success: !error,
    error: error?.message ?? null,
  });

  if (error) {
    throw new Error(`Confirmation de livraison échouée : ${error.message}`);
  }

  if (!data) {
    throw new Error("Confirmation de livraison échouée : aucune donnée retournée.");
  }

  return data;
}
