-- Appliquée sur les projets Supabase le 18/11/2026.
-- confirm_delivery enregistrait la réserve du donneur d'ordre seulement dans les anciennes colonnes.
-- La lettre de voiture ne lit que mission_reserves : on y écrit maintenant la réserve AVANT la clôture.
create or replace function public.confirm_delivery(p_mission_id bigint, p_reserves text default null::text)
 returns missions
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_mission missions;
  v_offer freight_offers;
  v_caller uuid := auth.uid();
  v_res text := nullif(btrim(regexp_replace(coalesce(p_reserves, ''), '\s+', ' ', 'g')), '');
begin
  select * into v_mission from missions where id = p_mission_id for update;
  if not found then raise exception 'Mission introuvable.'; end if;

  select * into v_offer from freight_offers where id = v_mission.offer_id for update;
  if not found then raise exception 'Offre associée introuvable.'; end if;

  if not (v_offer.donneur_ordre_id = v_caller or is_admin()) then
    raise exception 'Non autorisé à confirmer cette livraison.';
  end if;
  if v_mission.status <> 'livree' then
    raise exception 'Transition invalide depuis le statut: %', v_mission.status;
  end if;

  if v_res is not null then
    if char_length(v_res) > 160 then
      raise exception 'Réserve trop longue (160 caractères maximum, % saisis)', char_length(v_res)
        using errcode = '22001';
    end if;
    insert into mission_reserves (mission_id, phase, auteur_role, auteur_id, texte)
    values (p_mission_id, 'dechargement', 'donneur_ordre', v_caller, v_res)
    on conflict (mission_id, phase, auteur_role)
    do update set texte = excluded.texte, auteur_id = excluded.auteur_id, updated_at = now();
  end if;

  perform set_config('netlog.bypass_status_guard', 'on', true);

  update missions
  set status = 'cloturee', livraison_confirmee_at = now(),
      reserves_livraison = coalesce(v_res, reserves_livraison)
  where id = p_mission_id returning * into v_mission;

  update freight_offers
  set status = 'livree', reserves_livraison = coalesce(v_res, reserves_livraison)
  where id = v_mission.offer_id;

  perform record_commission(v_mission.id);

  return v_mission;
end;
$function$;

revoke all on function public.confirm_delivery(bigint, text) from public, anon;
grant execute on function public.confirm_delivery(bigint, text) to authenticated, service_role;
