import { supabase } from './supabase';

export async function createMissionFromProposal(params: {
  offerId: number;
  transporteurId: string;
  vehicleId?: number | null;
  chauffeurId?: string | null;
  codeConfirmation?: string | null;
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
      code_confirmation: params.codeConfirmation ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Création mission échouée: ${error.message}`);
  return data;
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

  if (data?.offer_id) {
    const { error: offerErr } = await supabase
      .from('freight_offers')
      .update({ status: 'livree' })
      .eq('id', data.offer_id);
    if (offerErr) {
      console.warn('[NETLOG] sync freight_offers livree:', offerErr.message);
    }
  }
  return data;
}
