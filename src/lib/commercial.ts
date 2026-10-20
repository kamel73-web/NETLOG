import { supabase } from "./supabase";

export interface NetworkMember {
  member_id: string;
  nom: string;
  role: string;
  statut_compte: string;
  inscrit_le: string;
  abonnement_actif: boolean;
  abonnement_fin: string | null;
}
export interface EarningRow {
  id: number;
  created_at: string;
  source: string;
  scenario: string | null;
  membre: string;
  base_ht: number;
  taux_pct: number;
  fixe_ht: number;
  montant_ht: number;
  plafonne: boolean;
  special: boolean;
  statut: string;
  payout_id: number | null;
}
export interface Payout {
  id: number;
  montant_ht: number;
  periode_fin: string;
  reference: string | null;
  nb_lignes: number;
  created_at: string;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

export async function loadMyNetwork(): Promise<NetworkMember[]> {
  const { data, error } = await supabase.rpc("my_network");
  fail(error);
  return ((data as any[]) ?? []).map((r) => ({
    member_id: r.member_id,
    nom: r.nom,
    role: r.role,
    statut_compte: r.statut_compte,
    inscrit_le: r.inscrit_le,
    abonnement_actif: Boolean(r.abonnement_actif),
    abonnement_fin: r.abonnement_fin ?? null,
  }));
}

export async function loadMyEarnings(): Promise<EarningRow[]> {
  const { data, error } = await supabase.rpc("my_earnings", { p_limit: 500 });
  fail(error);
  return ((data as any[]) ?? []).map((r) => ({
    id: Number(r.id),
    created_at: r.created_at,
    source: r.source,
    scenario: r.scenario ?? null,
    membre: r.membre,
    base_ht: n(r.base_ht),
    taux_pct: n(r.taux_pct),
    fixe_ht: n(r.fixe_ht),
    montant_ht: n(r.montant_ht),
    plafonne: Boolean(r.plafonne),
    special: Boolean(r.special),
    statut: r.statut,
    payout_id: r.payout_id == null ? null : Number(r.payout_id),
  }));
}

export async function loadMyPayouts(): Promise<Payout[]> {
  const { data, error } = await supabase
    .from("commercial_payouts")
    .select("id, montant_ht, periode_fin, reference, nb_lignes, created_at")
    .order("id", { ascending: false })
    .limit(100);
  fail(error);
  return ((data as any[]) ?? []).map((r) => ({
    id: Number(r.id),
    montant_ht: n(r.montant_ht),
    periode_fin: r.periode_fin,
    reference: r.reference ?? null,
    nb_lignes: n(r.nb_lignes),
    created_at: r.created_at,
  }));
}

export async function loadMyReferral(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data } = await supabase.from("profiles").select("referral_code").eq("id", auth.user.id).maybeSingle();
  return (data as any)?.referral_code ?? null;
}

export async function payCommercial(commercialId: string, until: string, reference?: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_pay_commercial", {
    p_commercial: commercialId,
    p_until: until,
    p_reference: reference ?? null,
    p_note: note ?? null,
  });
  fail(error);
}
