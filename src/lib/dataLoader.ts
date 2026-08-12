import { supabase, getCurrentProfile } from './supabase';
import { adaptSupabaseProfile, type SupabaseProfileRow } from './profileAdapter';
import type { UserProfile, MoyenTransport, OffreFret, PropositionPrix, Facture } from '../types';
import { MoyenType, OffreStatus, FactureStatus } from '../types';

export async function loadProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) { console.error('loadProfiles:', error.message); return []; }
  return (data as SupabaseProfileRow[]).map(adaptSupabaseProfile);
}

export async function loadVehicles(): Promise<MoyenTransport[]> {
  const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) { console.error('loadVehicles:', error.message); return []; }
  return (data as any[]).map(v => ({
    id: String(v.id),
    transporteurId: v.transporteur_id,
    type: (v.type as MoyenType) ?? MoyenType.CamionPorteur,
    marque: v.type ?? '',
    immatriculation: v.immatriculation ?? '',
    poidsUtileMax: v.capacite_kg ? v.capacite_kg / 1000 : 0,
    longueurMax: 0,
    wilaya: v.wilaya_base ? String(v.wilaya_base) : undefined,
    disponibilite: v.is_available ? 'Disponible' : 'Occupé',
  }));
}

export async function loadFreightOffers(): Promise<OffreFret[]> {
  const { data, error } = await supabase
    .from('freight_offers')
    .select('*, wilaya_depart_data:wilayas!freight_offers_wilaya_depart_fkey(name), wilaya_arrivee_data:wilayas!freight_offers_wilaya_arrivee_fkey(name)')
    .order('created_at', { ascending: false }).limit(200);
  if (error) { console.error('loadFreightOffers:', error.message); return []; }
  return (data as any[]).map(o => ({
    id: String(o.id),
    donneurId: o.donneur_ordre_id,
    donneurRaisonSociale: '',
    depart: o.wilaya_depart_data?.name ?? String(o.wilaya_depart),
    arrivee: o.wilaya_arrivee_data?.name ?? String(o.wilaya_arrivee),
    departDetails: o.point_repere_depart ?? '',
    arriveeDetails: o.point_repere_arrivee ?? '',
    dateChargement: o.date_enlevement_souhaitee ?? o.created_at?.slice(0,10) ?? '',
    dateLivraison: o.date_enlevement_souhaitee ?? o.created_at?.slice(0,10) ?? '',
    poids: o.poids_kg ? o.poids_kg / 1000 : 0,
    longueurExigee: o.longueur_exigee_m ?? undefined,
    marchandise: o.type_marchandise ?? o.description ?? '',
    moyenExige: (o.type_moyen_exige as MoyenType) ?? MoyenType.CamionPorteur,
    nombreVoyages: o.nombre_voyages ?? 1,
    prixFixe: o.prix_propose ?? undefined,
    commentaire: o.description ?? '',
    status: ({ ouverte: OffreStatus.Publie, attribuee: OffreStatus.Attribue, en_cours: OffreStatus.Charge, livree: OffreStatus.Decharge, annulee: OffreStatus.Valide } as any)[o.status] ?? OffreStatus.Publie,
    codeConfirmation: o.code_confirmation ?? '0000',
    contratLogistiquePath: o.contrat_logistique_path ?? undefined,
    reserves: o.reserves ?? undefined,
    reservesChargement: o.reserves_chargement ?? undefined,
    reservesLivraison: o.reserves_livraison ?? undefined,
    chauffeurId: o.chauffeur_id ?? undefined,
    chauffeurSignaleProbleme: o.chauffeur_signale_probleme ?? undefined,
    dateCreation: o.created_at?.slice(0,10) ?? '',
  }));
}

export async function loadProposals(): Promise<PropositionPrix[]> {
  const { data, error } = await supabase.from('proposals').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) { console.error('loadProposals:', error.message); return []; }
  return (data as any[]).map(p => ({
    id: String(p.id),
    offreId: String(p.offer_id),
    transporteurId: p.transporteur_id,
    transporteurRaisonSociale: '',
    moyenId: p.vehicle_id ? String(p.vehicle_id) : '',
    prixPropose: p.prix_propose ?? 0,
    commentaire: p.message ?? '',
    status: ({ en_attente: 'En attente', acceptee: 'Accepté', refusee: 'Rejeté', retiree: 'Rejeté' } as any)[p.status] ?? 'En attente',
    motifRejet: undefined,
  }));
}

export async function loadInvoices(): Promise<Facture[]> {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) { console.error('loadInvoices:', error.message); return []; }
  return (data as any[]).map(inv => ({
    id: inv.numero ?? String(inv.id),
    offreId: String(inv.offer_id),
    donneurId: inv.donneur_ordre_id,
    transporteurId: inv.transporteur_id,
    montant: inv.montant_ttc ?? 0,
    status: ({ brouillon: FactureStatus.NonFacture, emise: FactureStatus.Transmise, payee: FactureStatus.Reglee, annulee: FactureStatus.NonFacture } as any)[inv.status] ?? FactureStatus.NonFacture,
    dateEmission: inv.created_at?.slice(0,10) ?? '',
    dateReglement: inv.paid_at?.slice(0,10) ?? undefined,
  }));
}

export interface CommuneRow {
  id: number;
  wilaya_code: number;
  name: string;
  name_ar: string | null;
}

export async function loadCommunes(): Promise<CommuneRow[]> {
  const { data, error } = await supabase
    .from('communes')
    .select('id, wilaya_code, name, name_ar')
    .order('wilaya_code', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('loadCommunes:', error.message);
    return [];
  }
  return data as CommuneRow[];
}

export interface AppData {
  profiles: UserProfile[];
  vehicles: MoyenTransport[];
  offers: OffreFret[];
  proposals: PropositionPrix[];
  invoices: Facture[];
  communes: CommuneRow[];
  currentUser: UserProfile | null;
}

export async function loadAppData(): Promise<AppData> {
  const [profiles, vehicles, offers, proposals, invoices, communes, profileRow] = await Promise.all([
    loadProfiles(), loadVehicles(), loadFreightOffers(), loadProposals(), loadInvoices(), loadCommunes(), getCurrentProfile(),
  ]);
  const currentUser = profileRow ? adaptSupabaseProfile(profileRow as SupabaseProfileRow) : null;
  return { profiles, vehicles, offers, proposals, invoices, communes, currentUser };
}
