import { supabase } from "./supabase";

export type AffiliationStatus = "en_attente" | "accepte" | "refuse";
export interface Affiliate {
  member_id: number;
  carrier_id: string;
  nom: string;
  wilaya: string | null;
  statut: AffiliationStatus;
  depuis: string;
}
export interface Invitation {
  member_id: number;
  owner_id: string;
  owner_nom: string;
  owner_role: string;
  statut: AffiliationStatus;
  depuis: string;
}
export interface CarrierHit {
  carrier_id: string;
  nom: string;
  wilaya: string | null;
  deja: boolean;
}
export interface AffiliateQuota {
  autorise: boolean;
  limite: number;
  utilises: number;
}

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};
const num = (v: unknown): number => (v == null ? 0 : Number(v));

export async function loadAffiliateQuota(): Promise<AffiliateQuota> {
  const { data, error } = await supabase.rpc("my_affiliate_quota");
  fail(error);
  const r: any = Array.isArray(data) ? data[0] : data;
  return { autorise: Boolean(r?.autorise), limite: num(r?.limite), utilises: num(r?.utilises) };
}

export async function loadMyAffiliates(): Promise<Affiliate[]> {
  const { data, error } = await supabase.rpc("my_affiliates");
  fail(error);
  return ((data as any[]) ?? []).map((r) => ({
    member_id: Number(r.member_id),
    carrier_id: r.carrier_id,
    nom: r.nom,
    wilaya: r.wilaya ?? null,
    statut: r.statut,
    depuis: r.depuis,
  }));
}

export async function loadMyInvitations(): Promise<Invitation[]> {
  const { data, error } = await supabase.rpc("my_affiliations");
  fail(error);
  return ((data as any[]) ?? []).map((r) => ({
    member_id: Number(r.member_id),
    owner_id: r.owner_id,
    owner_nom: r.owner_nom,
    owner_role: r.owner_role,
    statut: r.statut,
    depuis: r.depuis,
  }));
}

export async function searchCarriers(query: string): Promise<CarrierHit[]> {
  const { data, error } = await supabase.rpc("search_carriers", { p_query: query });
  fail(error);
  return ((data as any[]) ?? []).map((r) => ({
    carrier_id: r.carrier_id,
    nom: r.nom,
    wilaya: r.wilaya ?? null,
    deja: Boolean(r.deja_dans_ma_liste),
  }));
}

export async function inviteCarrier(carrierId: string): Promise<void> {
  const { error } = await supabase.rpc("invite_carrier", { p_carrier: carrierId });
  fail(error);
}

export async function respondAffiliation(memberId: number, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("respond_affiliation", { p_member_id: memberId, p_accept: accept });
  fail(error);
}

export async function removeAffiliation(memberId: number): Promise<void> {
  const { error } = await supabase.rpc("remove_affiliation", { p_member_id: memberId });
  fail(error);
}

/** Rend une offre ouverte publique, ou réservée à certains de vos transporteurs affiliés. */
export async function setOfferVisibility(
  offerId: number,
  visibility: "public" | "restricted",
  carrierIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc("set_offer_visibility", {
    p_offer_id: offerId,
    p_visibility: visibility,
    p_carrier_ids: carrierIds,
  });
  fail(error);
}
