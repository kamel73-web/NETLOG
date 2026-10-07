import { supabase } from "./supabase";

// IDENTIQUE à normalizeDzMobile() de supabase/functions/create-driver/index.ts
export function normalizeDzMobile(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00213")) d = d.slice(2);
  if (d.startsWith("0")) d = "213" + d.slice(1);
  return /^213[567]\d{8}$/.test(d) ? d : null;
}

/** E-mail → inchangé. Numéro mobile algérien → alias interne du chauffeur. */
export function toLoginEmail(identifier: string): string {
  const v = identifier.trim();
  if (v.includes("@")) return v.toLowerCase();
  const phone = normalizeDzMobile(v);
  return phone ? `${phone}@chauffeur.netlog.dz` : v;
}

export async function createDriver(input: {
  nom: string;
  prenom: string;
  phone: string;
  password?: string;
  position?: string;
  availability?: string;
}): Promise<{ id: string; phone: string; password?: string }> {
  const { data, error } = await supabase.functions.invoke("create-driver", { body: input });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignoré */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
