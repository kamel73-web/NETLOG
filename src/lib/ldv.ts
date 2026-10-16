/**
 * NETLOG — Lettre de voiture (LDV) : types, validation, appels Supabase.
 * Toutes les écritures passent par des RPC (rôle déduit côté serveur).
 */
import { supabase } from "./supabase";

/* ------------------------------ Limites ------------------------------ */
export const RESERVE_MAX = 160; // = contrainte SQL mission_reserves.texte
export const GOODS_LINES_MAX = 8; // = limite SQL / mise en page A4
export const DESIGNATION_MAX = 60;
export const DEST_NAME_MAX = 80;

/* ------------------------------ Unités ------------------------------- */
export const UNITS = {
  palette: ["palette", "palettes"],
  carton: ["carton", "cartons"],
  sac: ["sac", "sacs"],
  colis: ["colis", "colis"],
  caisse: ["caisse", "caisses"],
  fût: ["fût", "fûts"],
  rouleau: ["rouleau", "rouleaux"],
  pièce: ["pièce", "pièces"],
  tonne: ["tonne", "tonnes"],
  "m³": ["m³", "m³"],
  litre: ["litre", "litres"],
} as const;
export type GoodsUnit = keyof typeof UNITS;

/** Espaces ordinaires (pas d'espace insécable : rendu PDF fiable). */
export function formatNumber(n: number): string {
  const [int, dec] = String(Math.round(n * 100) / 100).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${grouped},${dec}` : grouped;
}

export function formatQuantity(q: number, unite: string): string {
  const forms = (UNITS as Record<string, readonly [string, string]>)[unite];
  const label = forms ? (q > 1 ? forms[1] : forms[0]) : unite;
  return `${formatNumber(q)} ${label}`;
}

/* --------------------------- Réserves (≤160) -------------------------- */
/** À appeler à chaque frappe : pas de retour ligne, espaces simples, 160 max. */
export function sanitizeReserveInput(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/^ /, "").slice(0, RESERVE_MAX);
}
export function finalizeReserve(raw: string): string {
  return sanitizeReserveInput(raw).trim();
}

/* ------------------------- Téléphone algérien ------------------------- */
export const DZ_PHONE_RE = /^(0|\+213)[1-9][0-9]{7,8}$/;

export function normalizeDzPhone(raw: string): string {
  let s = raw.replace(/[\s.\-()]/g, "");
  if (s.startsWith("00213")) s = "+213" + s.slice(5);
  if (s.startsWith("+2130")) s = "+213" + s.slice(5); // « +213 0550… » saisi à tort
  return s;
}
export function isValidDzPhone(raw: string): boolean {
  return DZ_PHONE_RE.test(normalizeDzPhone(raw));
}
export function formatDzPhone(raw?: string | null): string {
  if (!raw) return "";
  let s = normalizeDzPhone(raw);
  if (s.startsWith("+213")) s = "0" + s.slice(4);
  if (/^0\d{9}$/.test(s)) return `${s.slice(0, 4)} ${s.slice(4, 6)} ${s.slice(6, 8)} ${s.slice(8)}`;
  if (/^0\d{8}$/.test(s)) return `${s.slice(0, 3)} ${s.slice(3, 5)} ${s.slice(5, 7)} ${s.slice(7)}`;
  return raw;
}

/* --------------------- Détails facultatifs de l'offre ------------------ */
export interface GoodsLineInput {
  designation: string;
  unite: GoodsUnit;
  quantite: string; // saisie brute (virgule ou point)
}
export interface OfferPrivateDetailsInput {
  poidsTotalKg: string;
  destinataireNom: string;
  destinataireTel: string;
  chargementContactNom: string;
  chargementContactTel: string;
  lignes: GoodsLineInput[];
}
export const EMPTY_DETAILS: OfferPrivateDetailsInput = {
  poidsTotalKg: "",
  destinataireNom: "",
  destinataireTel: "",
  chargementContactNom: "",
  chargementContactTel: "",
  lignes: [],
};

const toNum = (s: string) => Number(s.trim().replace(",", "."));

export function hasDetails(d: OfferPrivateDetailsInput): boolean {
  return Boolean(
    d.poidsTotalKg.trim() ||
      d.destinataireNom.trim() ||
      d.destinataireTel.trim() ||
      d.chargementContactNom.trim() ||
      d.chargementContactTel.trim() ||
      d.lignes.some((l) => l.designation.trim() || l.quantite.trim()),
  );
}

/** Retourne la liste des erreurs (vide = valide). Rien n'est obligatoire. */
export function validateDetails(d: OfferPrivateDetailsInput): string[] {
  const errs: string[] = [];
  if (d.poidsTotalKg.trim()) {
    const w = toNum(d.poidsTotalKg);
    if (!Number.isFinite(w) || w <= 0 || w > 100000) errs.push("Poids total : valeur invalide (0 < poids ≤ 100 000 kg).");
  }
  if (d.destinataireNom.trim() && d.destinataireNom.trim().length < 2) errs.push("Destinataire : nom trop court.");
  if (d.destinataireTel.trim() && !isValidDzPhone(d.destinataireTel)) errs.push("Destinataire : numéro de téléphone invalide.");
  if (d.chargementContactNom.trim() && d.chargementContactNom.trim().length < 2) errs.push("Contact de chargement : nom trop court.");
  if (d.chargementContactTel.trim() && !isValidDzPhone(d.chargementContactTel)) errs.push("Contact de chargement : numéro de téléphone invalide.");
  if (d.lignes.length > GOODS_LINES_MAX) errs.push(`Marchandise : ${GOODS_LINES_MAX} lignes maximum.`);
  d.lignes.forEach((l, i) => {
    if (!l.designation.trim() && !l.quantite.trim()) return;
    if (l.designation.trim().length < 2) errs.push(`Ligne ${i + 1} : désignation manquante.`);
    const q = toNum(l.quantite || "");
    if (!Number.isFinite(q) || q <= 0) errs.push(`Ligne ${i + 1} : quantité invalide.`);
  });
  return errs;
}

export async function savePrivateDetails(offerId: number | string, d: OfferPrivateDetailsInput): Promise<void> {
  const errs = validateDetails(d);
  if (errs.length) throw new Error(errs.join(" "));
  const lignes = d.lignes
    .filter((l) => l.designation.trim() || l.quantite.trim())
    .map((l) => ({ designation: l.designation.trim(), unite: l.unite, quantite: toNum(l.quantite) }));
  const { error } = await supabase.rpc("save_offer_private_details", {
    p_offer_id: Number(offerId),
    p_poids_total_kg: d.poidsTotalKg.trim() ? toNum(d.poidsTotalKg) : null,
    p_destinataire_nom: d.destinataireNom.trim() || null,
    p_destinataire_tel: d.destinataireTel.trim() ? normalizeDzPhone(d.destinataireTel) : null,
    p_lignes: lignes,
    p_contact_nom: d.chargementContactNom.trim() || null,
    p_contact_tel: d.chargementContactTel.trim() ? normalizeDzPhone(d.chargementContactTel) : null,
  });
  if (error) throw new Error(error.message);
}

/** Pré-remplissage en édition (lisible par le donneur d'ordre propriétaire). */
export async function fetchPrivateDetails(offerId: number | string): Promise<OfferPrivateDetailsInput> {
  const id = Number(offerId);
  const [det, lines] = await Promise.all([
    supabase.from("offer_private_details").select("poids_total_kg,destinataire_nom,destinataire_tel,contact_chargement_nom,contact_chargement_tel").eq("offer_id", id).maybeSingle(),
    supabase.from("offer_goods_lines").select("designation,unite,quantite,position").eq("offer_id", id).order("position"),
  ]);
  if (det.error) throw new Error(det.error.message);
  if (lines.error) throw new Error(lines.error.message);
  return {
    poidsTotalKg: det.data?.poids_total_kg != null ? String(det.data.poids_total_kg) : "",
    destinataireNom: det.data?.destinataire_nom ?? "",
    destinataireTel: det.data?.destinataire_tel ?? "",
    chargementContactNom: det.data?.contact_chargement_nom ?? "",
    chargementContactTel: det.data?.contact_chargement_tel ?? "",
    lignes: (lines.data ?? []).map((l: any) => ({
      designation: l.designation,
      unite: l.unite as GoodsUnit,
      quantite: String(l.quantite),
    })),
  };
}

/* ------------------------------ Réserves ------------------------------ */
export type ReservePhase = "chargement" | "dechargement";

/** Texte vide = efface sa propre réserve. Le rôle est déduit côté serveur. */
export async function addMissionReserve(missionId: number, phase: ReservePhase, texte: string): Promise<void> {
  const { error } = await supabase.rpc("add_mission_reserve", {
    p_mission_id: missionId,
    p_phase: phase,
    p_texte: finalizeReserve(texte),
  });
  if (error) throw new Error(error.message);
}

/* ------------------------------- Payload ------------------------------- */
export interface LdvPayload {
  numero: string;
  mission_id: number;
  offer_id: number;
  date_emission: string;
  statut: string;
  frozen: boolean;
  transporteur: {
    raison_sociale: string | null;
    adresse: string | null;
    tel: string | null;
    email: string | null;
    logo_url: string | null;
  };
  conducteur: { nom: string | null; type_vehicule: string | null; immatriculation: string | null };
  donneur_ordre: { raison_sociale: string | null; adresse: string | null };
  marchandises: {
    nature: string | null;
    lignes: { designation: string; unite: string; quantite: number }[];
    poids_declare_kg: number | null;
    poids_estime_kg: number | null;
  };
  chargement: {
    wilaya: string | null;
    repere: string | null;
    lat: number | null;
    lng: number | null;
    at: string | null;
    contact_nom?: string | null;
    contact_tel?: string | null;
  };
  dechargement: {
    wilaya: string | null;
    repere: string | null;
    lat: number | null;
    lng: number | null;
    at: string | null;
    confirmee_at: string | null;
    destinataire_nom: string | null;
    destinataire_tel: string | null;
  };
  reserves: { phase: ReservePhase; role: "chauffeur" | "donneur_ordre" | "historique"; texte: string }[];
}

export async function fetchLdv(missionId: number): Promise<LdvPayload> {
  const { data, error } = await supabase.rpc("get_ldv_payload", { p_mission_id: missionId });
  if (error) throw new Error(error.message);
  const p = data as LdvPayload | null;
  if (!p || typeof p.numero !== "string") throw new Error("Lettre de voiture indisponible.");
  return p;
}

/* ------------------------------ Affichage ------------------------------ */
const TZ = "Africa/Algiers";
export const fmtDate = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "";
export const fmtTime = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "";

export function placeLine(p: { repere: string | null; wilaya: string | null }): string {
  return [p.repere, p.wilaya ? `Wilaya de ${p.wilaya}` : null].filter(Boolean).join(" — ");
}
