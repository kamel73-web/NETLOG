-- À placer dans supabase/migrations/20261116_fix_acces_lettre_de_voiture.sql
-- Appliquée et testée sur le STAGING le 16/11/2026. NON appliquée en production.

-- Faille : quand la mission n'a pas encore de chauffeur (chauffeur_id NULL), la condition de refus de
-- get_ldv_payload valait NULL au lieu de vrai, donc la garde ne se déclenchait pas : tout utilisateur connecté
-- pouvait lire la lettre de voiture de n'importe quelle mission. Comparaisons rendues NULL-safe.
create or replace function public.get_ldv_payload(p_mission_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid    uuid := auth.uid();
  m        public.missions%rowtype;
  o        public.freight_offers%rowtype;
  v_snap   jsonb;
  v_closed boolean;
  v_payload jsonb;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '42501';
  end if;

  select * into m from public.missions where id = p_mission_id;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;
  select * into o from public.freight_offers where id = m.offer_id;

  if not (o.donneur_ordre_id is not distinct from v_uid
          or m.transporteur_id is not distinct from v_uid
          or m.chauffeur_id is not distinct from v_uid
          or coalesce(public.is_admin(), false)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  v_closed := m.livraison_confirmee_at is not null or m.cloturee_at is not null;

  if v_closed then
    select s.payload into v_snap from public.ldv_snapshots s where s.mission_id = m.id;
    if found then
      return v_snap || jsonb_build_object('frozen', true);
    end if;
  end if;

  v_payload := public._build_ldv_payload(m.id);

  if v_closed then
    insert into public.ldv_snapshots (mission_id, payload)
    values (m.id, v_payload) on conflict (mission_id) do nothing;
    v_payload := v_payload || jsonb_build_object('frozen', true);
  end if;
  return v_payload;
end;
$function$;

-- Le constructeur interne n'a aucune vérification d'identité : il ne doit être appelé que par
-- get_ldv_payload et trg_missions_freeze_ldv (fonctions SECURITY DEFINER propriétaires).
revoke all on function public._build_ldv_payload(bigint) from public, anon, authenticated;
