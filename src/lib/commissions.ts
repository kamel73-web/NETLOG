import { supabase } from "./supabase";

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

export async function loadOfferBrief(id: number): Promise<OfferBrief | null> {
  const { data, error } = await supabase
    .from("freight_offers")
    .select("id, status, type_marchandise, description, poids_kg, publie_par_role")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
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
  const { data, error } = await supabase
    .from("offer_special_commission")
    .select("*")
    .eq("offer_id", offerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
}

export async function deleteSpecial(offerId: number): Promise<void> {
  const { error } = await supabase.from("offer_special_commission").delete().eq("offer_id", offerId);
  if (error) throw new Error(error.message);
}
