import { supabase } from "./supabase";

export interface FleetAccess {
  autorise: boolean;
  limite: number;
  actifs: number;
  total: number;
}
export interface FleetVehicle {
  id: number;
  type: string;
  immatriculation: string;
  capaciteKg: number;
  marque: string;
  modele: string;
  disponible: boolean;
  desactive: boolean;
}
export interface FleetDriver {
  id: string;
  nom: string;
  prenom: string;
  phone: string;
  actif: boolean;
}

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};
const num = (v: unknown): number => (v == null ? 0 : Number(v));

export async function loadFleetAccess(): Promise<FleetAccess> {
  const { data, error } = await supabase.rpc("my_fleet_access");
  fail(error);
  const r: any = Array.isArray(data) ? data[0] : data;
  return { autorise: Boolean(r?.autorise), limite: num(r?.limite), actifs: num(r?.actifs), total: num(r?.total) };
}

export async function loadFleetVehicles(ownerId: string): Promise<FleetVehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, type, immatriculation, capacite_kg, marque, modele, is_available, suspendu_abonnement, created_at")
    .eq("transporteur_id", ownerId)
    .order("created_at", { ascending: true });
  fail(error);
  return ((data as any[]) ?? []).map((v) => ({
    id: Number(v.id),
    type: String(v.type ?? ""),
    immatriculation: String(v.immatriculation ?? ""),
    capaciteKg: num(v.capacite_kg),
    marque: String(v.marque ?? ""),
    modele: String(v.modele ?? ""),
    disponible: Boolean(v.is_available),
    desactive: Boolean(v.suspendu_abonnement),
  }));
}

export async function loadFleetDrivers(ownerId: string): Promise<FleetDriver[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, prenom, phone, is_active, created_at")
    .eq("transporteur_id", ownerId)
    .eq("role", "chauffeur")
    .order("created_at", { ascending: true });
  fail(error);
  return ((data as any[]) ?? []).map((d) => ({
    id: d.id,
    nom: String(d.full_name ?? ""),
    prenom: String(d.prenom ?? ""),
    phone: String(d.phone ?? ""),
    actif: Boolean(d.is_active),
  }));
}

export async function deleteFleetVehicle(id: number): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  fail(error);
}
