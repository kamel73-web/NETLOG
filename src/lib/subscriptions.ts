import { supabase } from "./supabase";

export interface Plan {
  id: number;
  code: string;
  nom: string;
  description: string | null;
  roles: string[];
  prix_mensuel_ht: number;
  max_chauffeurs: number | null;
  actif: boolean;
  ordre: number;
  commission_pct: number | null;
  commission_fixe: number | null;
}
export type PayMode = "virement" | "ccp" | "baridimob" | "cib" | "versement_especes";
export interface SubPayment {
  id: number;
  user_id: string;
  plan_id: number;
  mois: number;
  montant_ht: number;
  taux_tva: number;
  montant_ttc: number;
  mode: PayMode;
  reference: string | null;
  preuve_path: string | null;
  declare_par: string;
  statut: "en_attente" | "validee" | "refusee";
  periode_debut: string | null;
  periode_fin: string | null;
  decision_note: string | null;
  created_at: string;
  membre?: string;
  membre_role?: string;
  plan_nom?: string;
}
export interface PaymentInstructions {
  beneficiaire: string;
  rib: string;
  instructions: string;
  tva_pct: number;
}
export interface Topup {
  id: number;
  user_id: string;
  amount_ht: number;
  mode: string;
  reference: string | null;
  status: string;
  created_at: string;
  membre?: string;
}
export interface Setting {
  key: string;
  value: any;
  description: string | null;
}
export interface Account {
  id: string;
  role: string;
  nom: string;
  email: string;
  status: string;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};
const personName = (p: any): string =>
  (p?.entreprise && String(p.entreprise).trim()) ||
  [p?.prenom, p?.full_name].filter(Boolean).join(" ") ||
  "Membre";

const normPlan = (p: any): Plan => ({
  id: Number(p.id),
  code: String(p.code),
  nom: String(p.nom),
  description: p.description ?? null,
  roles: p.roles ?? [],
  prix_mensuel_ht: n(p.prix_mensuel_ht),
  max_chauffeurs: p.max_chauffeurs == null ? null : Number(p.max_chauffeurs),
  actif: Boolean(p.actif),
  ordre: n(p.ordre),
  commission_pct: p.commission_pct == null ? null : Number(p.commission_pct),
  commission_fixe: p.commission_fixe == null ? null : Number(p.commission_fixe),
});
const normPayment = (p: any): SubPayment => ({
  id: Number(p.id),
  user_id: p.user_id,
  plan_id: Number(p.plan_id),
  mois: n(p.mois),
  montant_ht: n(p.montant_ht),
  taux_tva: n(p.taux_tva),
  montant_ttc: n(p.montant_ttc),
  mode: p.mode,
  reference: p.reference ?? null,
  preuve_path: p.preuve_path ?? null,
  declare_par: p.declare_par,
  statut: p.statut,
  periode_debut: p.periode_debut ?? null,
  periode_fin: p.periode_fin ?? null,
  decision_note: p.decision_note ?? null,
  created_at: p.created_at,
  membre: p.membre ? personName(p.membre) : undefined,
  membre_role: p.membre?.role,
  plan_nom: p.plan?.nom,
});

export async function loadMyRole(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  return (data as any)?.role ?? null;
}

export async function loadPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from("subscription_plans").select("*").order("ordre").order("id");
  fail(error);
  return ((data as any[]) ?? []).map(normPlan);
}

export async function savePlan(p: {
  id?: number;
  code: string;
  nom: string;
  description?: string | null;
  roles: string[];
  prix_mensuel_ht: number;
  max_chauffeurs: number | null;
  actif: boolean;
  ordre: number;
  commission_pct: number | null;
  commission_fixe: number | null;
}): Promise<void> {
  const row = {
    code: p.code,
    nom: p.nom,
    description: p.description ?? null,
    roles: p.roles,
    prix_mensuel_ht: p.prix_mensuel_ht,
    max_chauffeurs: p.max_chauffeurs,
    actif: p.actif,
    ordre: p.ordre,
    commission_pct: p.commission_pct,
    commission_fixe: p.commission_fixe,
  };
  const { error } = p.id
    ? await supabase.from("subscription_plans").update(row).eq("id", p.id)
    : await supabase.from("subscription_plans").insert(row);
  fail(error);
}

export async function loadPaymentInstructions(): Promise<PaymentInstructions | null> {
  const { data, error } = await supabase.rpc("get_payment_instructions");
  fail(error);
  const r: any = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    beneficiaire: r.beneficiaire ?? "",
    rib: r.rib ?? "",
    instructions: r.instructions ?? "",
    tva_pct: n(r.tva_pct),
  };
}

export async function loadMyPayments(): Promise<SubPayment[]> {
  const { data, error } = await supabase
    .from("subscription_payments")
    .select("*, plan:subscription_plans(nom)")
    .order("id", { ascending: false })
    .limit(50);
  fail(error);
  return ((data as any[]) ?? []).map(normPayment);
}

export async function uploadProof(file: File): Promise<string> {
  const okType = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!okType) throw new Error("La preuve doit être une image ou un PDF.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Fichier trop volumineux (5 Mo maximum).");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error("Session absente.");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${auth.user.id}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: false });
  fail(error);
  return path;
}

export async function requestPayment(p: {
  userId: string;
  planId: number;
  mois: number;
  mode: PayMode;
  reference?: string;
  preuvePath?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("request_subscription_payment", {
    p_user: p.userId,
    p_plan_id: p.planId,
    p_mois: p.mois,
    p_mode: p.mode,
    p_reference: p.reference ?? null,
    p_preuve_path: p.preuvePath ?? null,
  });
  fail(error);
}

// ---------- Administration ----------
export async function loadAdminPayments(): Promise<SubPayment[]> {
  const { data, error } = await supabase
    .from("subscription_payments")
    .select(
      "*, membre:profiles!subscription_payments_user_id_fkey(entreprise, full_name, prenom, role), plan:subscription_plans(nom)",
    )
    .order("id", { ascending: false })
    .limit(100);
  fail(error);
  return ((data as any[]) ?? []).map(normPayment);
}

export async function decidePayment(id: number, accept: boolean, note?: string): Promise<void> {
  const { error } = await supabase.rpc("decide_subscription_payment", {
    p_payment_id: id,
    p_accept: accept,
    p_note: note ?? null,
  });
  fail(error);
}

export async function proofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 300);
  fail(error);
  return String(data?.signedUrl ?? "");
}

export async function loadAdminTopups(): Promise<Topup[]> {
  const { data, error } = await supabase
    .from("wallet_topups")
    .select("*, membre:profiles!wallet_topups_user_id_fkey(entreprise, full_name, prenom)")
    .order("id", { ascending: false })
    .limit(100);
  fail(error);
  return ((data as any[]) ?? []).map((t) => ({
    id: Number(t.id),
    user_id: t.user_id,
    amount_ht: n(t.amount_ht),
    mode: t.mode,
    reference: t.reference ?? null,
    status: t.status,
    created_at: t.created_at,
    membre: t.membre ? personName(t.membre) : undefined,
  }));
}

export async function decideTopup(id: number, accept: boolean, note?: string): Promise<void> {
  const { error } = await supabase.rpc("decide_topup", {
    p_topup_id: id,
    p_accept: accept,
    p_note: note ?? null,
  });
  fail(error);
}

export async function loadSettings(): Promise<Setting[]> {
  const { data, error } = await supabase.from("platform_settings").select("*").order("key");
  fail(error);
  return ((data as any[]) ?? []).map((s) => ({ key: s.key, value: s.value, description: s.description ?? null }));
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("platform_settings")
    .update({ value, updated_at: new Date().toISOString(), updated_by: auth?.user?.id ?? null })
    .eq("key", key);
  fail(error);
}

export async function findAccounts(query: string): Promise<Account[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, entreprise, full_name, prenom, email, status")
    .or(`email.ilike.%${q}%,entreprise.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(10);
  fail(error);
  return ((data as any[]) ?? []).map((p) => ({
    id: p.id,
    role: p.role,
    nom: personName(p),
    email: p.email ?? "",
    status: p.status,
  }));
}

export async function grantFree(p: {
  userId: string;
  planId: number;
  mois: number | null;
  validate: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("grant_free_subscription", {
    p_user: p.userId,
    p_plan_id: p.planId,
    p_mois: p.mois,
    p_validate: p.validate,
  });
  fail(error);
}

export async function adjustWallet(userId: string, amount: number, note: string): Promise<void> {
  const { error } = await supabase.rpc("admin_wallet_adjust", { p_user: userId, p_amount: amount, p_note: note });
  fail(error);
}
