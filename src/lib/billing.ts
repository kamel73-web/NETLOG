import { supabase } from "./supabase";
import { loadParties } from "./dataLoader";

export type PaymentMode = "especes" | "cheque" | "virement" | "traite";

export interface BillingProfile {
  transporteur_id: string;
  nis: string | null;
  article_imposition: string | null;
  rib: string | null;
  regime: "tva" | "ifu";
  taux_tva: number | null;
  delai_paiement_defaut: number;
  mentions_legales: string | null;
}

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  mission_id: number;
  offer_id: number;
  designation: string;
  date_prestation: string | null;
  quantite: number;
  prix_unitaire_ht: number;
  montant_ht: number;
  active: boolean;
}

export interface Invoice {
  id: number;
  numero: string;
  transporteur_id: string;
  donneur_ordre_id: string;
  date_emission: string;
  date_echeance: string | null;
  delai_paiement: number;
  mode_reglement_prevu: PaymentMode;
  emetteur: Record<string, any>;
  client: Record<string, any>;
  montant_ht: number;
  taux_tva: number;
  montant_tva: number;
  timbre_fiscal: number;
  montant_ttc: number;
  status: "brouillon" | "emise" | "payee" | "annulee";
  paid_at: string | null;
  mode_reglement_effectif: PaymentMode | null;
  reference_reglement: string | null;
  notes: string | null;
  motif_annulation: string | null;
  created_at: string;
  lines: InvoiceLine[];
}

export interface BillableMission {
  missionId: number;
  offerId: number;
  donneurId: string;
  donneurNom: string;
  trajet: string;
  marchandise: string;
  poidsT: number;
  datePrestation: string | null;
  prixHT: number | null;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

function normalizeInvoice(raw: any): Invoice {
  const lines = ((raw.lines ?? raw.invoice_lines ?? []) as any[])
    .map((l) => ({
      id: Number(l.id),
      invoice_id: Number(l.invoice_id),
      mission_id: Number(l.mission_id),
      offer_id: Number(l.offer_id),
      designation: String(l.designation ?? ""),
      date_prestation: l.date_prestation ?? null,
      quantite: num(l.quantite),
      prix_unitaire_ht: num(l.prix_unitaire_ht),
      montant_ht: num(l.montant_ht),
      active: Boolean(l.active),
    }))
    .sort((a, b) => a.id - b.id);
  return {
    id: Number(raw.id),
    numero: String(raw.numero),
    transporteur_id: raw.transporteur_id,
    donneur_ordre_id: raw.donneur_ordre_id,
    date_emission: raw.date_emission,
    date_echeance: raw.date_echeance ?? null,
    delai_paiement: num(raw.delai_paiement),
    mode_reglement_prevu: raw.mode_reglement_prevu,
    emetteur: raw.emetteur ?? {},
    client: raw.client ?? {},
    montant_ht: num(raw.montant_ht),
    taux_tva: num(raw.taux_tva),
    montant_tva: num(raw.montant_tva),
    timbre_fiscal: num(raw.timbre_fiscal),
    montant_ttc: num(raw.montant_ttc),
    status: raw.status,
    paid_at: raw.paid_at ?? null,
    mode_reglement_effectif: raw.mode_reglement_effectif ?? null,
    reference_reglement: raw.reference_reglement ?? null,
    notes: raw.notes ?? null,
    motif_annulation: raw.motif_annulation ?? null,
    created_at: raw.created_at,
    lines,
  };
}

/** Factures visibles par l'utilisateur connecté (émetteur, destinataire ou admin : la base filtre). */
export async function loadMyInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_lines(*)")
    .order("id", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data as any[]) ?? []).map(normalizeInvoice);
}

export interface CompletedMission extends BillableMission {
  invoiceNumero: string | null;
  invoiceStatus: string | null;
}

/** Missions clôturées du transporteur connecté, avec le numéro de la facture éventuelle. */
export async function loadCompletedMissions(): Promise<CompletedMission[]> {
  const { data: ms, error: mErr } = await supabase
    .from("missions")
    .select("id, offer_id, dechargement_at, livraison_confirmee_at")
    .eq("status", "cloturee")
    .order("id", { ascending: false });
  if (mErr) throw new Error(mErr.message);
  const missions = (ms as any[]) ?? [];
  if (missions.length === 0) return [];

  const offerIds = Array.from(new Set(missions.map((m) => Number(m.offer_id))));
  const [offers, props, lines, wil, parties] = await Promise.all([
    supabase
      .from("freight_offers")
      .select("id, donneur_ordre_id, wilaya_depart, wilaya_arrivee, type_marchandise, description, poids_kg")
      .in("id", offerIds),
    supabase.from("proposals").select("offer_id, prix_propose").eq("status", "acceptee").in("offer_id", offerIds),
    supabase.from("invoice_lines").select("mission_id, invoices(numero, status)").eq("active", true),
    supabase.from("wilayas").select("code, name"),
    loadParties(),
  ]);
  for (const r of [offers, props, lines, wil]) {
    if (r.error) throw new Error(r.error.message);
  }

  const offerById = new Map<number, any>(((offers.data as any[]) ?? []).map((o) => [Number(o.id), o]));
  const priceByOffer = new Map<number, number>(
    ((props.data as any[]) ?? []).map((p) => [Number(p.offer_id), Number(p.prix_propose)]),
  );
  const invoiceByMission = new Map<number, { numero: string; status: string }>();
  for (const l of (lines.data as any[]) ?? []) {
    const inv = Array.isArray(l.invoices) ? l.invoices[0] : l.invoices;
    if (inv) invoiceByMission.set(Number(l.mission_id), { numero: String(inv.numero), status: String(inv.status) });
  }
  const wilayaName = new Map<number, string>(((wil.data as any[]) ?? []).map((w) => [Number(w.code), String(w.name)]));

  return missions
    .filter((m) => offerById.has(Number(m.offer_id)))
    .map((m) => {
      const o = offerById.get(Number(m.offer_id));
      const dep = wilayaName.get(Number(o.wilaya_depart)) ?? String(o.wilaya_depart);
      const arr = wilayaName.get(Number(o.wilaya_arrivee)) ?? String(o.wilaya_arrivee);
      const inv = invoiceByMission.get(Number(m.id));
      return {
        missionId: Number(m.id),
        offerId: Number(m.offer_id),
        donneurId: o.donneur_ordre_id,
        donneurNom: parties[o.donneur_ordre_id]?.name || "Donneur d'ordre",
        trajet: `${dep} → ${arr}`,
        marchandise: String(o.type_marchandise || o.description || "Marchandise"),
        poidsT: o.poids_kg ? Number(o.poids_kg) / 1000 : 0,
        datePrestation: String(m.dechargement_at ?? m.livraison_confirmee_at ?? "").slice(0, 10) || null,
        prixHT: priceByOffer.has(Number(m.offer_id)) ? priceByOffer.get(Number(m.offer_id))! : null,
        invoiceNumero: inv?.numero ?? null,
        invoiceStatus: inv?.status ?? null,
      };
    });
}

/** Missions clôturées du transporteur connecté, pas encore facturées. */
export async function loadBillableMissions(): Promise<BillableMission[]> {
  return (await loadCompletedMissions()).filter((m) => !m.invoiceNumero);
}

export async function createInvoice(params: {
  missionIds: number[];
  delaiPaiement: number;
  modeReglement: PaymentMode;
  timbre: number;
  notes?: string;
}): Promise<Invoice> {
  const { data, error } = await supabase.rpc("create_invoice", {
    p_mission_ids: params.missionIds,
    p_delai_paiement: params.delaiPaiement,
    p_mode_reglement: params.modeReglement,
    p_timbre: params.timbre,
    p_notes: params.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return normalizeInvoice(data);
}

export async function markInvoicePaid(params: {
  invoiceId: number;
  mode: PaymentMode;
  reference?: string;
  paidOn?: string;
}): Promise<Invoice> {
  const { data, error } = await supabase.rpc("mark_invoice_paid", {
    p_invoice_id: params.invoiceId,
    p_mode: params.mode,
    p_reference: params.reference ?? null,
    p_paid_on: params.paidOn ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return normalizeInvoice(data);
}

export async function loadBillingProfile(): Promise<BillingProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from("billing_profiles").select("*").eq("transporteur_id", uid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const d: any = data;
  return {
    transporteur_id: d.transporteur_id,
    nis: d.nis ?? null,
    article_imposition: d.article_imposition ?? null,
    rib: d.rib ?? null,
    regime: d.regime,
    taux_tva: d.taux_tva == null ? null : Number(d.taux_tva),
    delai_paiement_defaut: num(d.delai_paiement_defaut),
    mentions_legales: d.mentions_legales ?? null,
  };
}

export async function saveBillingProfile(p: Omit<BillingProfile, "transporteur_id">): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Session absente.");
  const { error } = await supabase
    .from("billing_profiles")
    .upsert({ transporteur_id: uid, ...p, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Statut affiché : « Comptant » (délai 0), « En attente de paiement », « En retard » (échéance dépassée), « Payée », « Annulée ». */
export function invoiceDisplayStatus(inv: Invoice): { label: string; tone: "paid" | "pending" | "late" | "cancelled" } {
  if (inv.status === "annulee") return { label: "Annulée", tone: "cancelled" };
  if (inv.status === "payee") return { label: "Payée", tone: "paid" };
  if (!inv.date_echeance) return { label: "Comptant", tone: "pending" };
  const today = new Date().toISOString().slice(0, 10);
  return inv.date_echeance < today
    ? { label: "En retard", tone: "late" }
    : { label: "En attente de paiement", tone: "pending" };
}
