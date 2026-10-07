// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// IDENTIQUE à normalizeDzMobile() de src/lib/drivers.ts : les deux doivent rester synchronisées
function normalizeDzMobile(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00213")) d = d.slice(2);
  if (d.startsWith("0")) d = "213" + d.slice(1);
  return /^213[567]\d{8}$/.test(d) ? d : null;
}

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Qui appelle ?
  const caller = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await caller.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: "Non connecté." }, 401);

  const admin = createClient(url, service);
  const { data: me } = await admin.from("profiles").select("role,status").eq("id", user.id).single();
  if (!me || me.role !== "transporteur" || me.status !== "valide") {
    return json({ error: "Réservé aux transporteurs validés." }, 403);
  }

  // 2. Données saisies
  const body = await req.json().catch(() => ({}));
  const nom = String(body.nom ?? "").trim();
  const prenom = String(body.prenom ?? "").trim();
  const phone = normalizeDzMobile(String(body.phone ?? ""));
  if (!nom || !prenom) return json({ error: "Nom et prénom obligatoires." }, 400);
  if (!phone) return json({ error: "Numéro invalide : un mobile algérien commence par 05, 06 ou 07." }, 400);

  // Code d'accès à 6 chiffres (6 caractères = minimum imposé par Supabase).
  const password = String(body.password ?? "").trim();
  if (!/^\d{6}$/.test(password)) return json({ error: "Le code d'accès doit comporter exactement 6 chiffres." }, 400);
  const tooSimple = /^(\d)\1{5}$/.test(password) ||
    "012345 123456 234567 345678 456789 567890 654321 543210 987654 876543 765432 123123 121212 112233".split(" ").includes(password);
  if (tooSimple) return json({ error: "Code trop simple (111111, 123456…). Choisissez-en un autre." }, 400);

  // 3. Limite de sécurité
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true })
    .eq("transporteur_id", user.id).eq("role", "chauffeur");
  if ((count ?? 0) >= 50) return json({ error: "Limite de 50 chauffeurs atteinte." }, 400);

  // 4. Création du compte
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: `${phone}@chauffeur.netlog.dz`,
    password,
    email_confirm: true,
    user_metadata: { full_name: nom, role: "chauffeur", phone: `+${phone}` },
  });
  if (cErr || !created?.user) {
    const msg = /already|registered|exists/i.test(cErr?.message ?? "")
      ? "Ce numéro est déjà utilisé par un autre compte."
      : (cErr?.message ?? "Création impossible.");
    return json({ error: msg }, 400);
  }

  // 5. Rattachement au transporteur
  const { error: pErr } = await admin.from("profiles")
    .update({ prenom, status: "valide", transporteur_id: user.id })
    .eq("id", created.user.id);
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: `Profil chauffeur incomplet : ${pErr.message}` }, 500);
  }

  return json({ id: created.user.id, phone });
});
