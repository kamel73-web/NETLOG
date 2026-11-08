-- Audiences de diffusion d'une offre :
-- public, flotte propre, affiliés sélectionnés, ou les deux.
-- Les anciennes offres deviennent publiques par défaut lors de l'ajout de la colonne.
alter table public.freight_offers
  add column if not exists audience text not null default 'public';

-- Ferme par défaut les anciennes offres déjà marquées comme réservées.
-- Les offres publiques existantes gardent leur visibilité historique.
update public.freight_offers
set audience = 'affiliates'
where coalesce(visibility::text, 'public') <> 'public'
  and audience = 'public';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.freight_offers'::regclass
      and conname = 'freight_offers_audience_check'
  ) then
    alter table public.freight_offers
      add constraint freight_offers_audience_check
      check (audience in ('public', 'own_fleet', 'affiliates', 'own_fleet_and_affiliates'));
  end if;
end;
$$;

create table if not exists public.freight_offer_audience_carriers (
  offer_id bigint not null references public.freight_offers(id) on delete cascade,
  carrier_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (offer_id, carrier_id)
);

create index if not exists idx_freight_offer_audience_carriers_carrier
  on public.freight_offer_audience_carriers(carrier_id, offer_id);

alter table public.freight_offer_audience_carriers enable row level security;

-- Les destinataires sont écrits uniquement dans la publication atomique.
revoke all on table public.freight_offer_audience_carriers from anon, authenticated;

create schema if not exists private;
revoke create on schema private from public;
grant usage on schema private to anon, authenticated;

-- Le prédicat RLS reste hors du schéma API public pour éviter qu'il soit
-- appelé comme une RPC et utilisé pour sonder la visibilité d'identifiants.
create or replace function private.can_view_freight_offer(p_offer_id bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.freight_offers as o
    where o.id = p_offer_id
      and (
        o.donneur_ordre_id = auth.uid()
        or coalesce(o.audience, 'public') = 'public'
        or (
          coalesce(o.audience, '') in ('own_fleet', 'own_fleet_and_affiliates')
          and exists (
            select 1
            from public.profiles as driver
            where driver.id = auth.uid()
              and driver.transporteur_id = o.donneur_ordre_id
              and driver.role::text = 'chauffeur'
              and driver.is_active is true
          )
        )
        or (
          coalesce(o.audience, '') in ('affiliates', 'own_fleet_and_affiliates')
          and exists (
            select 1
            from public.freight_offer_audience_carriers as recipient
            where recipient.offer_id = o.id
              and recipient.carrier_id = auth.uid()
              and exists (
                select 1
                from public.my_affiliations() as affiliation
                where affiliation.owner_id::text = o.donneur_ordre_id::text
                  and affiliation.statut::text = 'accepte'
              )
          )
        )
      )
  );
$$;

revoke all on function private.can_view_freight_offer(bigint) from public;
grant execute on function private.can_view_freight_offer(bigint) to anon, authenticated;

-- Une règle restrictive combine avec les politiques historiques et empêche
-- toute ancienne politique permissive de divulguer une offre réservée.
drop policy if exists freight_offers_audience_visibility on public.freight_offers;
create policy freight_offers_audience_visibility
  on public.freight_offers
  as permissive
  for select
  to anon, authenticated
  using (private.can_view_freight_offer(id));

drop policy if exists freight_offers_audience_visibility_guard on public.freight_offers;
create policy freight_offers_audience_visibility_guard
  on public.freight_offers
  as restrictive
  for select
  to anon, authenticated
  using (private.can_view_freight_offer(id));

create or replace function public.publish_freight_offer(
  p_offer jsonb,
  p_audience text,
  p_carrier_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_allowed boolean := false;
  v_offer jsonb;
  v_offer_id text;
  v_insert_columns text;
  v_select_columns text;
  v_unknown_keys text[];
  v_distinct_ids integer;
  v_total_ids integer;
  v_accepted_ids integer;
  v_uses_fleet boolean;
  v_uses_affiliates boolean;
begin
  if v_user_id is null then
    raise exception 'Authentification requise pour publier une offre.'
      using errcode = '28000';
  end if;

  if jsonb_typeof(p_offer) is distinct from 'object' then
    raise exception 'Données de l''offre invalides.'
      using errcode = '22023';
  end if;

  if p_audience is null
    or p_audience not in ('public', 'own_fleet', 'affiliates', 'own_fleet_and_affiliates')
  then
    raise exception 'Audience de l''offre invalide.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as owner
    where owner.id = v_user_id
      and owner.role::text in ('donneur_ordre', 'commissionnaire')
      and coalesce(
        owner.status::text,
        case when owner.is_active then 'valide' else 'suspendu' end
      ) = 'valide'
  ) then
    raise exception 'Seul un donneur d''ordre actif peut publier une offre.'
      using errcode = '42501';
  end if;

  select array_agg(k.key)
  into v_unknown_keys
  from jsonb_object_keys(p_offer) as k(key)
  where k.key <> all (array[
    'donneur_ordre_id',
    'wilaya_depart',
    'commune_depart_id',
    'point_repere_depart',
    'latitude_depart',
    'longitude_depart',
    'wilaya_arrivee',
    'commune_arrivee_id',
    'point_repere_arrivee',
    'latitude_arrivee',
    'longitude_arrivee',
    'description',
    'poids_kg',
    'type_marchandise',
    'prix_propose',
    'payment_method',
    'date_enlevement_souhaitee',
    'type_moyen_exige',
    'nombre_voyages',
    'visibility',
    'audience'
  ]);

  if v_unknown_keys is not null then
    raise exception 'Champ(s) d''offre non autorisé(s) : %', array_to_string(v_unknown_keys, ', ')
      using errcode = '22023';
  end if;

  v_uses_fleet := p_audience in ('own_fleet', 'own_fleet_and_affiliates');
  v_uses_affiliates := p_audience in ('affiliates', 'own_fleet_and_affiliates');

  select count(*)::integer, count(distinct selected.carrier_id)::integer
  into v_total_ids, v_distinct_ids
  from unnest(coalesce(p_carrier_ids, '{}'::uuid[])) as selected(carrier_id);

  if v_total_ids <> v_distinct_ids then
    raise exception 'Un transporteur affilié a été sélectionné plusieurs fois.'
      using errcode = '22023';
  end if;

  if v_uses_affiliates and v_total_ids = 0 then
    raise exception 'Sélectionnez au moins un transporteur affilié accepté.'
      using errcode = '22023';
  end if;

  if not v_uses_affiliates and v_total_ids > 0 then
    raise exception 'Des destinataires affiliés ont été fournis pour une audience sans affiliés.'
      using errcode = '22023';
  end if;

  if v_uses_fleet then
    select coalesce(access.autorise, false)
    into v_allowed
    from public.my_fleet_access() as access
    limit 1;
    if not coalesce(v_allowed, false) then
      raise exception 'L''option flotte propre n''est pas autorisée pour ce compte.'
        using errcode = '42501';
    end if;
  end if;

  if v_uses_affiliates then
    v_allowed := false;
    select coalesce(quota.autorise, false)
    into v_allowed
    from public.my_affiliate_quota() as quota
    limit 1;
    if not coalesce(v_allowed, false) then
      raise exception 'L''option transporteurs affiliés n''est pas autorisée pour ce compte.'
        using errcode = '42501';
    end if;

    select count(distinct affiliate.carrier_id::text)::integer
    into v_accepted_ids
    from public.my_affiliates() as affiliate
    where affiliate.statut::text = 'accepte'
      and affiliate.carrier_id::text in (
        select selected.carrier_id::text
        from unnest(coalesce(p_carrier_ids, '{}'::uuid[])) as selected(carrier_id)
      );

    if coalesce(v_accepted_ids, 0) <> v_total_ids then
      raise exception 'Tous les destinataires doivent être des affiliés actuellement acceptés.'
        using errcode = '42501';
    end if;
  end if;

  v_offer := (p_offer - 'donneur_ordre_id' - 'visibility' - 'audience')
    || jsonb_build_object(
      'donneur_ordre_id', v_user_id,
      'visibility', case when p_audience = 'public' then 'public' else 'restricted' end,
      'audience', p_audience
    );

  select
    string_agg(format('%I', column_info.attname), ', ' order by column_info.attnum),
    string_agg(format('offer_row.%I', column_info.attname), ', ' order by column_info.attnum)
  into v_insert_columns, v_select_columns
  from pg_attribute as column_info
  where column_info.attrelid = 'public.freight_offers'::regclass
    and column_info.attnum > 0
    and not column_info.attisdropped
    and column_info.attname <> 'id'
    and v_offer ? column_info.attname;

  if v_insert_columns is null then
    raise exception 'Aucune donnée d''offre reconnue pour l''enregistrement.'
      using errcode = '22023';
  end if;

  execute format(
    'insert into public.freight_offers (%s)
     select %s
     from jsonb_populate_record(null::public.freight_offers, $1) as offer_row
     returning id::text',
    v_insert_columns,
    v_select_columns
  )
  into v_offer_id
  using v_offer;

  if v_uses_affiliates then
    insert into public.freight_offer_audience_carriers (offer_id, carrier_id)
    select v_offer_id::bigint, selected.carrier_id
    from unnest(p_carrier_ids) as selected(carrier_id);
  end if;

  return jsonb_build_object('id', v_offer_id);
end;
$$;

revoke all on function public.publish_freight_offer(jsonb, text, uuid[]) from public;
grant execute on function public.publish_freight_offer(jsonb, text, uuid[]) to authenticated;
