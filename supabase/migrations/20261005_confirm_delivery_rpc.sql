create or replace function public._confirm_delivery_impl(
  p_mission_id bigint,
  p_reserves text,
  p_code text
)
returns public.missions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mission public.missions;
  v_offer public.freight_offers;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise pour confirmer la livraison.'
      using errcode = '42501';
  end if;

  select m.*
    into v_mission
    from public.missions as m
   where m.id = p_mission_id
   for update;

  if not found then
    raise exception 'Mission introuvable.'
      using errcode = 'P0002';
  end if;

  select o.*
    into v_offer
    from public.freight_offers as o
   where o.id = v_mission.offer_id
   for update;

  if not found then
    raise exception 'Offre associée à la mission introuvable.'
      using errcode = 'P0002';
  end if;

  if v_offer.donneur_ordre_id is distinct from auth.uid() then
    raise exception 'Seul le donneur d''ordre de cette offre peut confirmer la livraison.'
      using errcode = '42501';
  end if;

  if p_code is not null
     and btrim(p_code) is distinct from btrim(coalesce(v_offer.code_confirmation::text, ''))
  then
    raise exception 'Code de confirmation invalide.'
      using errcode = '22023';
  end if;

  if v_mission.status = 'cloturee' then
    return v_mission;
  end if;

  if v_mission.status is distinct from 'livree' then
    raise exception 'La livraison doit être déclarée avant sa confirmation.'
      using errcode = '22023';
  end if;

  perform set_config('netlog.bypass_status_guard', 'on', true);

  update public.missions
     set status = 'cloturee',
         livraison_confirmee_at = coalesce(livraison_confirmee_at, now())
   where id = p_mission_id
   returning * into v_mission;

  update public.freight_offers
     set status = 'annulee',
         reserves_livraison = coalesce(
           nullif(btrim(p_reserves), ''),
           reserves_livraison
         )
   where id = v_mission.offer_id;

  return v_mission;
end;
$$;

revoke all on function public._confirm_delivery_impl(bigint, text, text) from public;
revoke all on function public._confirm_delivery_impl(bigint, text, text) from anon;
revoke all on function public._confirm_delivery_impl(bigint, text, text) from authenticated;

create or replace function public.confirm_delivery(
  p_mission_id bigint,
  p_reserves text
)
returns public.missions
language sql
security definer
set search_path = public, pg_temp
as $$
  select public._confirm_delivery_impl(p_mission_id, p_reserves, null);
$$;

create or replace function public.confirm_delivery(
  p_mission_id bigint,
  p_code text,
  p_reserves text default null
)
returns public.missions
language sql
security definer
set search_path = public, pg_temp
as $$
  select public._confirm_delivery_impl(p_mission_id, p_reserves, p_code);
$$;

revoke all on function public.confirm_delivery(bigint, text) from public;
revoke all on function public.confirm_delivery(bigint, text) from anon;
grant execute on function public.confirm_delivery(bigint, text) to authenticated;

revoke all on function public.confirm_delivery(bigint, text, text) from public;
revoke all on function public.confirm_delivery(bigint, text, text) from anon;
grant execute on function public.confirm_delivery(bigint, text, text) to authenticated;

notify pgrst, 'reload schema';
