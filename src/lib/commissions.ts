import { supabase } from "./supabase";

export interface ShareRule {
  key: string;
  label: string;
  base: "abonnement" | "commission";
  pct: number;
  fixe: number;
  ordre: number;
}
export type Overrides = Record<string, { pct?: number | null; fixe?: number | null }>;
export interface Commercial {
  id: string;
  nom: string;
  email: string;
  code: string | null;
  membres: number;
  aPayer: number;
  overrides: Overrides;
}
export interface OfferBrief {
  id: number;
  status: string;
  marchandise: string;
  poidsT: number;
  publieParRole: string | null;
}
export interface SpecialCommission {
  offer_id: number;
  pct: number | null;
  fixe: number | null;
  beneficiaire: "transporteur" | "donneur" | "publieur";
  note: string | null;
}
export interface RevenueLine {
  source: "abonnements" | "commissions";
  nb: number;
  brut: number;
  parts: number;
  net: number;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};
const nameOf = (p: any): string =>
  (p?.entreprise && String(p.entreprise).trim()) || [p?.prenom, p?.full_name].filter(Boolean).join(" ") || "Commercial";

export async function loadShareRules(): Promise<ShareRule[]> {
  const { data, error } = await supabase.from("commercial_share_rules").select("*").order("ordre");
  fail(error);
  return ((data as any[]) ?? []).map((r) => ({
    key: r.key,
    label: r.label,
    base: r.base,
    pct: n(r.pct),
    fixe: n(r.fixe),
    ordre: n(r.ordre),
  }));
}

export async function saveShareRule(key: string, pct: number, fixe: number): Promise<void> {
  const { error } = await supabase.from("commercial_share_rules").update({ pct, fixe }).eq("key", key);
  fail(error);
}

export async function loadCommerciaux(): Promise<Commercial[]> {
  const [coms, mem, earn, rates] = await Promise.all([
    supabase.from("profiles").select("id, entreprise, full_name, prenom, email, referral_code").eq("role", "commercial"),
    supabase.from("profiles").select("commercial_id").not("commercial_id", "is", null).limit(5000),
    supabase.from("commercial_earnings").select("commercial_id, montant_ht").eq("statut", "a_payer").limit(10000),
    supabase.from("commercial_rates").select("commercial_id, overrides"),
  ]);
  for (const r of [coms, mem, earn, rates]) fail(r.error);
  const members = new Map<string, number>();
  for (const m of (mem.data as any[]) ?? []) members.set(m.commercial_id, (members.get(m.commercial_id) ?? 0) + 1);
  const due = new Map<string, number>();
  for (const e of (earn.data as any[]) ?? []) due.set(e.commercial_id, (due.get(e.commercial_id) ?? 0) + n(e.montant_ht));
  const ov = new Map<string, Overrides>();
  for (const r of (rates.data as any[]) ?? []) ov.set(r.commercial_id, (r.overrides ?? {}) as Overrides);
  return ((coms.data as any[]) ?? []).map((c) => ({
    id: c.id,
    nom: nameOf(c),
    email: c.email ?? "",
    code: c.referral_code ?? null,
    membres: members.get(c.id) ?? 0,
    aPayer: due.get(c.id) ?? 0,
    overrides: ov.get(c.id) ?? {},
  }));
}

export async function saveOverrides(commercialId: string, overrides: Overrides): Promise<void> {
  const clean: Overrides = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (v && (v.pct != null || v.fixe != null)) clean[k] = { pct: v.pct ?? null, fixe: v.fixe ?? null };
  }
  const { error } = await supabase
    .from("commercial_rates")
    .upsert({ commercial_id: commercialId, overrides: clean, updated_at: new Date().toISOString() });
  fail(error);
}

export async function generateReferralCode(commercialId: string): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = "NL-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    const { error } = await supabase.from("profiles").update({ referral_code: code }).eq("id", commercialId);
    if (!error) return code;
    if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  }
  throw new Error("Impossible de générer un code unique.");
}

export async function attachMember(userId: string, commercialId: string | null): Promise<void> {
  const { error } = await supabase.from("profiles").update({ commercial_id: commercialId }).eq("id", userId);
  fail(error);
}

export async function loadOfferBrief(id: number): Promise<OfferBrief | null> {
  const { data, error } = await supabase
    .from("freight_offers")
    .select("id, status, type_marchandise, description, poids_kg, publie_par_role")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  const o: any = data;
  return {
    id: Number(o.id),
    status: o.status,
    marchandise: String(o.type_marchandise || o.description || "—"),
    poidsT: o.poids_kg ? Number(o.poids_kg) / 1000 : 0,
    publieParRole: o.publie_par_role ?? null,
  };
}

export async function loadSpecial(offerId: number): Promise<SpecialCommission | null> {
  const { data, error } = await supabase.from("offer_special_commission").select("*").eq("offer_id", offerId).maybeSingle();
  fail(error);
  if (!data) return null;
  const s: any = data;
  return {
    offer_id: Number(s.offer_id),
    pct: s.pct == null ? null : Number(s.pct),
    fixe: s.fixe == null ? null : Number(s.fixe),
    beneficiaire: s.beneficiaire,
    note: s.note ?? null,
  };
}

export async function saveSpecial(s: SpecialCommission): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("offer_special_commission").upsert({
    offer_id: s.offer_id,
    pct: s.pct,
    fixe: s.fixe,
    beneficiaire: s.beneficiaire,
    note: s.note,
    updated_at: new Date().toISOString(),
    updated_by: auth?.user?.id ?? null,
  });
  fail(error);
}

export async function deleteSpecial(offerId: number): Promise<void> {
  const { error } = await supabase.from("offer_special_commission").delete().eq("offer_id", offerId);
  fail(error);
}

export async function loadRevenue(from: string | null, to: string | null): Promise<RevenueLine[]> {
  const { data, error } = await supabase.rpc("admin_revenue", { p_from: from, p_to: to });
  fail(error);
  return ((data as any[]) ?? []).map((r) => ({
    source: r.source,
    nb: n(r.nb),
    brut: n(r.brut_ht),
    parts: n(r.parts_commerciaux_ht),
    net: n(r.net_netlog_ht),
  }));
}
