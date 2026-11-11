--
-- PostgreSQL database dump
--

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'brouillon',
    'emise',
    'payee',
    'annulee'
);


--
-- Name: mission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mission_status AS ENUM (
    'creee',
    'acceptee_chauffeur',
    'en_route_chargement',
    'sur_site_chargement',
    'en_transit',
    'sur_site_livraison',
    'decharge',
    'livree',
    'cloturee',
    'annulee',
    'en_route'
);


--
-- Name: offer_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.offer_status AS ENUM (
    'ouverte',
    'attribuee',
    'en_cours',
    'decharge',
    'livree',
    'annulee'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'satim',
    'cib',
    'baridimob'
);


--
-- Name: proposal_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.proposal_status AS ENUM (
    'en_attente',
    'acceptee',
    'refusee',
    'retiree'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'donneur_ordre',
    'transporteur',
    'chauffeur',
    'commercial',
    'admin',
    'commissionnaire',
    'manutentionnaire',
    'stockage',
    'operateur_quai'
);


--
-- Name: _build_ldv_payload(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._build_ldv_payload(p_mission_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  m        public.missions%rowtype;
  o        public.freight_offers%rowtype;
  d        public.offer_private_details%rowtype;
  v_do     jsonb;
  v_tr     jsonb;
  v_ch     jsonb;
  v_veh    jsonb;
  v_vid    bigint;
  v_lignes jsonb;
  v_res    jsonb;
  v_tr_email text;
  v_tr_phone text;
  v_payload jsonb;
begin
  select * into m from public.missions where id = p_mission_id;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;
  select * into o from public.freight_offers where id = m.offer_id;

  select to_jsonb(p) into v_do from public.profiles p where p.id = o.donneur_ordre_id;
  select to_jsonb(p) into v_tr from public.profiles p where p.id = m.transporteur_id;
  if m.chauffeur_id is not null then
    select to_jsonb(p) into v_ch from public.profiles p where p.id = m.chauffeur_id;
  end if;

  v_vid := coalesce(
    m.vehicle_id,
    (select pr.vehicle_id from public.proposals pr
      where pr.offer_id = o.id and pr.status::text = 'acceptee' limit 1));
  if v_vid is not null then
    select to_jsonb(v) into v_veh from public.vehicles v where v.id = v_vid;
  end if;

  select u.email, u.phone into v_tr_email, v_tr_phone
  from auth.users u where u.id = m.transporteur_id;

  select * into d from public.offer_private_details where offer_id = o.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'designation', g.designation, 'unite', g.unite, 'quantite', g.quantite)
           order by g.position), '[]'::jsonb)
    into v_lignes
  from public.offer_goods_lines g where g.offer_id = o.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'phase', r.phase, 'role', r.auteur_role, 'texte', r.texte)
           order by r.phase, r.auteur_role), '[]'::jsonb)
    into v_res
  from public.mission_reserves r where r.mission_id = m.id;

  v_payload := jsonb_build_object(
    'numero', 'LDV-' || to_char(m.created_at at time zone 'Africa/Algiers', 'YYYY')
              || '-' || lpad(m.id::text, 6, '0'),
    'mission_id', m.id,
    'offer_id', o.id,
    'date_emission', m.created_at,
    'statut', m.status::text,
    'frozen', false,

    'transporteur', jsonb_build_object(
      'raison_sociale', coalesce(public._pick(v_tr, array['entreprise']), public._person_name(v_tr)),
      'adresse', public._pick(v_tr, array['adresse']),
      'tel',     coalesce(public._pick(v_tr, array['phone']),
                      case when v_tr_phone like '213%' then '0' || substr(v_tr_phone, 4) else v_tr_phone end),
      'email',   coalesce(public._pick(v_tr, array['email']), v_tr_email),
      'logo_url', null
    ),

    'conducteur', jsonb_build_object(
      'nom', coalesce(public._person_name(v_ch), public._person_name(v_tr)),
      'type_vehicule', public._pick(v_veh, array['type']),
      'immatriculation', public._pick(v_veh, array['immatriculation'])
    ),

    'donneur_ordre', jsonb_build_object(
      'raison_sociale', coalesce(public._pick(v_do, array['entreprise']), public._person_name(v_do)),
      'adresse', public._pick(v_do, array['adresse'])
    ),

    'marchandises', jsonb_build_object(
      'nature', coalesce(nullif(btrim(o.type_marchandise), ''), nullif(left(btrim(o.description), 60), '')),
      'lignes', v_lignes,
      'poids_declare_kg', d.poids_total_kg,
      'poids_estime_kg', o.poids_kg
    ),

    'chargement', jsonb_build_object(
      'wilaya', public._wilaya_name(o.wilaya_depart),
      'repere', nullif(btrim(o.point_repere_depart), ''),
      'lat', o.latitude_depart, 'lng', o.longitude_depart,
      'at', m.chargement_at,
      'contact_nom', d.contact_chargement_nom,
      'contact_tel', d.contact_chargement_tel
    ),

    'dechargement', jsonb_build_object(
      'wilaya', public._wilaya_name(o.wilaya_arrivee),
      'repere', nullif(btrim(o.point_repere_arrivee), ''),
      'lat', o.latitude_arrivee, 'lng', o.longitude_arrivee,
      'at', m.dechargement_at,
      'confirmee_at', m.livraison_confirmee_at,
      'destinataire_nom', d.destinataire_nom,
      'destinataire_tel', d.destinataire_tel
    ),

    'reserves', v_res
  );

  return v_payload;
end;
$$;


--
-- Name: _person_name(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._person_name(j jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(btrim(
    coalesce(j->>'full_name', '') ||
    case when nullif(btrim(j->>'prenom'), '') is not null
              and position(lower(btrim(j->>'prenom')) in lower(coalesce(j->>'full_name', ''))) = 0
         then ' ' || btrim(j->>'prenom') else '' end
  ), '');
$$;


--
-- Name: _pick(jsonb, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._pick(j jsonb, keys text[]) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(btrim(j ->> k), '')
  from unnest(keys) with ordinality as t(k, ord)
  where nullif(btrim(j ->> k), '') is not null
  order by ord
  limit 1;
$$;


--
-- Name: _wilaya_name(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._wilaya_name(p_code integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select (array[
    'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar','Blida','Bouira',
    'Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger','Djelfa','Jijel','Sétif','Saïda',
    'Skikda','Sidi Bel Abbès','Annaba','Guelma','Constantine','Médéa','Mostaganem','M''Sila','Mascara','Ouargla',
    'Oran','El Bayadh','Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt','El Oued','Khenchela',
    'Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma','Aïn Témouchent','Ghardaïa','Relizane','Timimoun','Bordj Badji Mokhtar',
    'Ouled Djellal','Béni Abbès','In Salah','In Guezzam','Touggourt','Djanet','El M''Ghair','El Menia'
  ])[p_code];
$$;


--
-- Name: accept_proposal(bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_proposal(p_offer_id bigint, p_proposal_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_caller uuid := auth.uid();
  v_offer freight_offers;
  v_prop proposals;
  v_mission missions;
  v_driver uuid;
begin
  select * into v_offer from freight_offers where id = p_offer_id for update;
  if not found then raise exception 'Offre introuvable.'; end if;
  if not (v_offer.donneur_ordre_id = v_caller or is_admin()) then
    raise exception 'Seul le donneur d''ordre de l''offre peut accepter une proposition.';
  end if;
  if v_offer.status <> 'ouverte' then
    raise exception 'Cette offre ne peut plus être attribuée (statut actuel : %).', v_offer.status;
  end if;

  select * into v_prop from proposals where id = p_proposal_id and offer_id = p_offer_id for update;
  if not found then raise exception 'Proposition introuvable pour cette offre.'; end if;
  if v_prop.status <> 'en_attente' then
    raise exception 'Cette proposition n''est plus disponible (statut : %).', v_prop.status;
  end if;
  if v_prop.transporteur_id is null then raise exception 'La proposition ne désigne aucun transporteur.'; end if;
  if exists (select 1 from missions where offer_id = p_offer_id) then
    raise exception 'Une mission existe déjà pour cette offre.';
  end if;

  v_driver := v_prop.chauffeur_id;
  if v_driver is not null and not is_fleet_driver(v_driver, v_prop.transporteur_id) then
    v_driver := null;
  end if;

  perform wallet_assert_can_commit(v_prop.transporteur_id, v_prop.prix_propose);

  update freight_offers set status = 'attribuee', transporteur_id = v_prop.transporteur_id
  where id = p_offer_id returning * into v_offer;
  update proposals set status = 'acceptee' where id = p_proposal_id;
  update proposals set status = 'refusee'
  where offer_id = p_offer_id and id <> p_proposal_id and status = 'en_attente';

  insert into missions (offer_id, transporteur_id, vehicle_id, chauffeur_id, status)
  values (p_offer_id, v_prop.transporteur_id, v_prop.vehicle_id, v_driver, 'en_route_chargement')
  returning * into v_mission;

  if setting_bool('wallet_enabled') then
    insert into wallet_reservations (user_id, mission_id, amount_ht, detail)
    select v_prop.transporteur_id, v_mission.id,
           round(coalesce(v_prop.prix_propose, 0) * r.pct / 100, 2) + round(r.fixe, 2),
           jsonb_build_object('pct', r.pct, 'fixe', r.fixe, 'source', r.source)
    from commission_rates(v_prop.transporteur_id) r;
  end if;

  return jsonb_build_object(
    'offer', to_jsonb(v_offer),
    'proposal', jsonb_build_object('id', v_prop.id, 'offer_id', v_prop.offer_id,
      'transporteur_id', v_prop.transporteur_id, 'vehicle_id', v_prop.vehicle_id,
      'chauffeur_id', v_driver, 'status', 'acceptee'),
    'mission', to_jsonb(v_mission)
  );
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_payments (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    plan_id bigint NOT NULL,
    mois integer NOT NULL,
    montant_ht numeric(14,2) NOT NULL,
    taux_tva numeric(5,2) DEFAULT 0 NOT NULL,
    montant_ttc numeric(14,2) NOT NULL,
    mode text NOT NULL,
    reference text,
    preuve_path text,
    declare_par uuid NOT NULL,
    statut text DEFAULT 'en_attente'::text NOT NULL,
    periode_debut date,
    periode_fin date,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_payments_mode_check CHECK ((mode = ANY (ARRAY['virement'::text, 'ccp'::text, 'baridimob'::text, 'cib'::text, 'versement_especes'::text, 'portefeuille'::text]))),
    CONSTRAINT subscription_payments_mois_check CHECK (((mois >= 1) AND (mois <= 12))),
    CONSTRAINT subscription_payments_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'validee'::text, 'refusee'::text])))
);


--
-- Name: activate_subscription_payment(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_subscription_payment(p_payment_id bigint) RETURNS public.subscription_payments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_pay subscription_payments; v_sub subscriptions;
  v_renew boolean := false; v_start date; v_end date;
  v_cc uuid; v_pct numeric; v_fixe numeric; v_part numeric;
begin
  select * into v_pay from subscription_payments where id = p_payment_id for update;
  if not found then raise exception 'Paiement introuvable.'; end if;

  select * into v_sub from subscriptions where user_id = v_pay.user_id for update;
  v_renew := found and v_sub.statut = 'active' and v_sub.plan_id = v_pay.plan_id
             and v_sub.fin is not null and v_sub.fin >= current_date;
  v_start := case when v_renew then v_sub.fin + 1 else current_date end;
  v_end := (v_start + (v_pay.mois::text || ' months')::interval)::date - 1;

  insert into subscriptions (user_id, plan_id, statut, debut, fin, updated_by)
  values (v_pay.user_id, v_pay.plan_id, 'active', case when v_renew then v_sub.debut else v_start end, v_end, auth.uid())
  on conflict (user_id) do update
    set plan_id = excluded.plan_id, statut = 'active', debut = excluded.debut, fin = excluded.fin,
        updated_at = now(), updated_by = auth.uid();

  update profiles set status = 'valide' where id = v_pay.user_id and status = 'en_attente';

  select commercial_id into v_cc from profiles where id = v_pay.user_id;
  if v_cc is not null then
    select s.pct, s.fixe into v_pct, v_fixe from commercial_share(v_cc, 'abonnement') s;
    v_part := least(v_pay.montant_ht, round(v_pay.montant_ht * coalesce(v_pct, 0) / 100, 2) + coalesce(v_fixe, 0));
    if v_part > 0 then
      insert into commercial_earnings (commercial_id, source, payment_id, member_id, base_ht, taux_pct, fixe_ht, montant_ht, scenario)
      values (v_cc, 'abonnement', v_pay.id, v_pay.user_id, v_pay.montant_ht, coalesce(v_pct, 0), coalesce(v_fixe, 0), v_part, 'abonnement')
      on conflict do nothing;
    end if;
  end if;

  update subscription_payments set periode_debut = v_start, periode_fin = v_end
  where id = p_payment_id returning * into v_pay;
  return v_pay;
end;
$$;


--
-- Name: add_carrier_by_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_carrier_by_phone(p_phone text) RETURNS TABLE(carrier_id uuid, company_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
declare
  v_digits  text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 9);
  v_carrier uuid;
begin
  if not public.can_use_affiliated_carriers(auth.uid()) then
    raise exception 'Option non incluse dans votre forfait' using errcode = 'NL001';
  end if;

  if length(v_digits) < 9 then
    raise exception 'Numéro invalide';
  end if;

  select p.id into v_carrier
  from profiles p
  where right(regexp_replace(coalesce(p.phone,''), '\D', '', 'g'), 9) = v_digits
    and p.role::text = 'transporteur'
    and coalesce(p.is_active, true)
  limit 1;

  if v_carrier is null then
    raise exception 'Aucun transporteur NETLOG avec ce numéro' using errcode = 'P0002';
  end if;
  if v_carrier = auth.uid() then
    raise exception 'Vous ne pouvez pas vous associer vous-même';
  end if;

  insert into carrier_associations (shipper_id, carrier_id)
  values (auth.uid(), v_carrier)
  on conflict (shipper_id, carrier_id) do nothing;

  return query
    select p.id, coalesce(nullif(p.entreprise, ''), p.full_name)
    from profiles p where p.id = v_carrier;
end;
$$;


--
-- Name: add_mission_reserve(bigint, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_mission_reserve(p_mission_id bigint, p_phase text, p_texte text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_uid  uuid := auth.uid();
  m      public.missions%rowtype;
  v_role text;
  v_txt  text;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '42501';
  end if;
  if p_phase not in ('chargement', 'dechargement') then
    raise exception 'Phase invalide : %', p_phase using errcode = '22023';
  end if;

  select * into m from public.missions where id = p_mission_id;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.freight_offers o
             where o.id = m.offer_id and o.donneur_ordre_id = v_uid) then
    v_role := 'donneur_ordre';
  elsif v_uid = m.chauffeur_id or v_uid = m.transporteur_id then
    v_role := 'chauffeur';
  else
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  if m.livraison_confirmee_at is not null or m.cloturee_at is not null then
    raise exception 'Mission clôturée : les réserves ne sont plus modifiables'
      using errcode = '55000';
  end if;

  v_txt := btrim(regexp_replace(coalesce(p_texte, ''), '\s+', ' ', 'g'));

  if v_txt = '' then
    delete from public.mission_reserves
     where mission_id = p_mission_id and phase = p_phase and auteur_role = v_role;
    return jsonb_build_object('ok', true, 'role', v_role, 'texte', null);
  end if;

  if char_length(v_txt) > 160 then
    raise exception 'Réserve trop longue (160 caractères maximum, % saisis)', char_length(v_txt)
      using errcode = '22001';
  end if;

  insert into public.mission_reserves (mission_id, phase, auteur_role, auteur_id, texte)
  values (p_mission_id, p_phase, v_role, v_uid, v_txt)
  on conflict (mission_id, phase, auteur_role)
  do update set texte = excluded.texte,
                auteur_id = excluded.auteur_id,
                updated_at = now();

  return jsonb_build_object('ok', true, 'role', v_role, 'texte', v_txt);
end;
$$;


--
-- Name: commercial_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commercial_payouts (
    id bigint NOT NULL,
    commercial_id uuid NOT NULL,
    montant_ht numeric(14,2) NOT NULL,
    periode_fin date NOT NULL,
    reference text,
    note text,
    nb_lignes integer NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commercial_payouts_montant_ht_check CHECK ((montant_ht > (0)::numeric))
);


--
-- Name: admin_pay_commercial(uuid, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_pay_commercial(p_commercial uuid, p_until date, p_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text) RETURNS public.commercial_payouts
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_total numeric; v_n int; v_p commercial_payouts;
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  if p_until is null then raise exception 'La date de fin de période est obligatoire.'; end if;
  perform 1 from commercial_earnings
   where commercial_id = p_commercial and statut = 'a_payer' and created_at::date <= p_until for update;
  select coalesce(sum(montant_ht), 0), count(*) into v_total, v_n
    from commercial_earnings
   where commercial_id = p_commercial and statut = 'a_payer' and created_at::date <= p_until;
  if v_n = 0 or v_total <= 0 then raise exception 'Aucun gain à régler pour cette période.'; end if;
  insert into commercial_payouts (commercial_id, montant_ht, periode_fin, reference, note, nb_lignes, created_by)
  values (p_commercial, v_total, p_until, nullif(trim(p_reference), ''), nullif(trim(p_note), ''), v_n, auth.uid())
  returning * into v_p;
  update commercial_earnings set statut = 'paye', payout_id = v_p.id
   where commercial_id = p_commercial and statut = 'a_payer' and created_at::date <= p_until;
  return v_p;
end;
$$;


--
-- Name: admin_revenue(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_revenue(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date) RETURNS TABLE(source text, nb bigint, brut_ht numeric, parts_commerciaux_ht numeric, net_netlog_ht numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur.'; end if;

  return query
  with abo as (
    select p.id as id, p.montant_ht as montant
    from subscription_payments p
    where p.statut = 'validee'
      and (p_from is null or p.decided_at::date >= p_from)
      and (p_to is null or p.decided_at::date <= p_to)
  ),
  com as (
    select c.mission_id as mission_id, c.montant_ht as montant
    from commission_entries c
    where (p_from is null or c.created_at::date >= p_from)
      and (p_to is null or c.created_at::date <= p_to)
  ),
  tot as (
    select 'abonnements'::text as src,
           (select count(*) from abo) as n,
           coalesce((select sum(a.montant) from abo a), 0) as brut,
           coalesce((select sum(e.montant_ht) from commercial_earnings e
                     where e.source = 'abonnement' and e.payment_id in (select a.id from abo a)), 0) as parts
    union all
    select 'commissions'::text,
           (select count(*) from com),
           coalesce((select sum(k.montant) from com k), 0),
           coalesce((select sum(e.montant_ht) from commercial_earnings e
                     where e.source in ('commission_transporteur', 'commission_donneur', 'commission_publieur')
                       and e.mission_id in (select k.mission_id from com k)), 0)
  )
  select t.src, t.n, t.brut, t.parts, t.brut - t.parts from tot t;
end;
$$;


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    amount_ht numeric(14,2) NOT NULL,
    mission_id bigint,
    reference text,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_sens_check CHECK ((((type = ANY (ARRAY['credit_bienvenue'::text, 'recharge'::text])) AND (amount_ht > (0)::numeric)) OR ((type = ANY (ARRAY['debit_commission'::text, 'debit_abonnement'::text])) AND (amount_ht <= (0)::numeric)) OR (type = 'ajustement'::text))),
    CONSTRAINT wallet_transactions_type_check CHECK ((type = ANY (ARRAY['credit_bienvenue'::text, 'recharge'::text, 'debit_commission'::text, 'debit_abonnement'::text, 'ajustement'::text])))
);


--
-- Name: admin_wallet_adjust(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_wallet_adjust(p_user uuid, p_amount numeric, p_note text) RETURNS public.wallet_transactions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_t wallet_transactions;
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Montant invalide.'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'Le motif est obligatoire.'; end if;
  insert into wallet_transactions (user_id, type, amount_ht, note, created_by)
  values (p_user, 'ajustement', round(p_amount, 2), trim(p_note), auth.uid()) returning * into v_t;
  return v_t;
end;
$$;


--
-- Name: affiliate_limit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.affiliate_limit(p_uid uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case when not setting_bool('subscription_enforced') then 2147483647
    else coalesce((select coalesce(pl.max_transporteurs_affilies, 2147483647)
                   from subscriptions s join subscription_plans pl on pl.id = s.plan_id
                   where s.user_id = p_uid and has_active_subscription(p_uid) and pl.permet_transporteurs_affilies), 0) end;
$$;


--
-- Name: assert_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_subscription(p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text;
begin
  if not setting_bool('subscription_enforced') then return; end if;
  if auth.uid() is null or is_admin() then return; end if;
  select role::text into v_role from profiles where id = p_user;
  if v_role in ('chauffeur', 'commercial', 'admin', 'operateur_quai') then return; end if;
  if not has_active_subscription(p_user) then
    raise exception 'Abonnement inactif : renouvelez votre abonnement pour continuer.';
  end if;
end;
$$;


--
-- Name: missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.missions (
    id bigint NOT NULL,
    offer_id bigint NOT NULL,
    transporteur_id uuid NOT NULL,
    vehicle_id bigint,
    chauffeur_id uuid,
    status public.mission_status DEFAULT 'creee'::public.mission_status NOT NULL,
    pod_photo_path text,
    pod_signature_path text,
    pod_latitude numeric(9,6),
    pod_longitude numeric(9,6),
    pod_at timestamp with time zone,
    reserves_chargement text,
    reserves_livraison text,
    chauffeur_signale_probleme text,
    cloturee_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    dechargement_at timestamp with time zone,
    livraison_confirmee_at timestamp with time zone,
    chargement_at timestamp with time zone
);


--
-- Name: COLUMN missions.reserves_chargement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.missions.reserves_chargement IS 'DEPRECATED - utiliser mission_reserves';


--
-- Name: COLUMN missions.reserves_livraison; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.missions.reserves_livraison IS 'DEPRECATED - utiliser mission_reserves';


--
-- Name: assign_driver(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_driver(p_mission_id bigint, p_driver_id uuid) RETURNS public.missions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_mission missions;
  v_caller uuid := auth.uid();
begin
  select * into v_mission from missions where id = p_mission_id for update;
  if not found then
    raise exception 'Mission introuvable.';
  end if;
  if not (v_mission.transporteur_id = v_caller or is_admin()) then
    raise exception 'Seul le transporteur de la mission peut affecter un chauffeur.';
  end if;
  if v_mission.status in ('decharge', 'livree', 'cloturee', 'annulee') then
    raise exception 'Mission terminée : affectation impossible.';
  end if;
  if p_driver_id is not null and not exists (
    select 1 from profiles d
    where d.id = p_driver_id
      and d.role = 'chauffeur'
      and d.status = 'valide'
      and d.transporteur_id = v_mission.transporteur_id
  ) then
    raise exception 'Ce chauffeur ne fait pas partie de votre flotte.';
  end if;

  update missions set chauffeur_id = p_driver_id where id = p_mission_id returning * into v_mission;
  return v_mission;
end;
$$;


--
-- Name: can_see_vehicle(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_see_vehicle(v_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from vehicles v
    where v.id = v_id and v.transporteur_id = auth.uid()
  )
  or exists (
    select 1 from directory_members dm
    where dm.vehicle_id = v_id
      and dm.status = 'accepte'
      and (
        dm.transporteur_id = auth.uid()
        or dm.chauffeur_id = auth.uid()
      )
  );
$$;


--
-- Name: can_update_mission(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_update_mission(p_mission_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.missions m
    join public.freight_offers fo on fo.id = m.offer_id
    where m.id = p_mission_id
      and (
        is_admin()
        or m.transporteur_id = auth.uid()
        or m.chauffeur_id = auth.uid()
        or fo.donneur_ordre_id = auth.uid()
        or public.is_quai_operator_for_offer(m.offer_id)
      )
  );
$$;


--
-- Name: can_use_affiliated_carriers(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_use_affiliated_carriers(p_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles pr
    where pr.id = p_uid
      and pr.role::text in ('donneur_ordre', 'commissionnaire')
      and coalesce(pr.is_active, true)
      and (
        not setting_bool('subscription_enforced')
        or exists (
          select 1 from subscriptions s join subscription_plans pl on pl.id = s.plan_id
          where s.user_id = p_uid and has_active_subscription(p_uid) and pl.permet_transporteurs_affilies)
      )
  );
$$;


--
-- Name: can_use_own_fleet(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_use_own_fleet(p_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles pr
    where pr.id = p_uid and pr.status = 'valide' and coalesce(pr.is_active, true)
      and (pr.role::text = 'transporteur'
           or (pr.role::text in ('donneur_ordre', 'commissionnaire')
               and (not setting_bool('subscription_enforced')
                    or exists (select 1 from subscriptions s join subscription_plans pl on pl.id = s.plan_id
                               where s.user_id = p_uid and has_active_subscription(p_uid) and pl.permet_flotte_propre))))
  );
$$;


--
-- Name: can_view_offer_private(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_offer_private(p_offer_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select auth.uid() is not null and (
    exists (select 1 from public.freight_offers o
            where o.id = p_offer_id and o.donneur_ordre_id = auth.uid())
    or exists (select 1 from public.missions m
               where m.offer_id = p_offer_id
                 and (m.transporteur_id = auth.uid() or m.chauffeur_id = auth.uid()))
  );
$$;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id bigint NOT NULL,
    numero text NOT NULL,
    transporteur_id uuid NOT NULL,
    donneur_ordre_id uuid NOT NULL,
    date_emission date DEFAULT CURRENT_DATE NOT NULL,
    date_echeance date,
    delai_paiement integer DEFAULT 0 NOT NULL,
    mode_reglement_prevu text NOT NULL,
    emetteur jsonb NOT NULL,
    client jsonb NOT NULL,
    montant_ht numeric(14,2) NOT NULL,
    taux_tva numeric(5,2) DEFAULT 0 NOT NULL,
    montant_tva numeric(14,2) DEFAULT 0 NOT NULL,
    timbre_fiscal numeric(14,2) DEFAULT 0 NOT NULL,
    montant_ttc numeric(14,2) NOT NULL,
    status public.invoice_status DEFAULT 'emise'::public.invoice_status NOT NULL,
    paid_at timestamp with time zone,
    mode_reglement_effectif text,
    reference_reglement text,
    notes text,
    motif_annulation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_delai_paiement_check CHECK ((delai_paiement >= 0)),
    CONSTRAINT invoices_mode_reglement_effectif_check CHECK ((mode_reglement_effectif = ANY (ARRAY['especes'::text, 'cheque'::text, 'virement'::text, 'traite'::text]))),
    CONSTRAINT invoices_mode_reglement_prevu_check CHECK ((mode_reglement_prevu = ANY (ARRAY['especes'::text, 'cheque'::text, 'virement'::text, 'traite'::text]))),
    CONSTRAINT invoices_montant_ht_check CHECK ((montant_ht >= (0)::numeric)),
    CONSTRAINT invoices_timbre_fiscal_check CHECK ((timbre_fiscal >= (0)::numeric))
);


--
-- Name: cancel_invoice(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_invoice(p_invoice_id bigint, p_motif text) RETURNS public.invoices
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_inv invoices;
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  if nullif(trim(p_motif), '') is null then raise exception 'Le motif est obligatoire.'; end if;
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then raise exception 'Facture introuvable.'; end if;
  if v_inv.status <> 'emise' then
    raise exception 'Seule une facture en attente de règlement peut être annulée (statut : %).', v_inv.status;
  end if;
  update invoice_lines set active = false where invoice_id = p_invoice_id;
  update invoices set status = 'annulee', motif_annulation = trim(p_motif)
  where id = p_invoice_id returning * into v_inv;
  return v_inv;
end;
$$;


--
-- Name: cleanup_recipients_on_unassociate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_recipients_on_unassociate() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from freight_offer_recipients r
  using freight_offers o
  where r.offer_id = o.id
    and o.donneur_ordre_id = old.shipper_id
    and r.carrier_id = old.carrier_id;
  return old;
end;
$$;


--
-- Name: commercial_share(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commercial_share(p_commercial uuid, p_key text) RETURNS TABLE(pct numeric, fixe numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((o.val ->> 'pct')::numeric, g.pct), coalesce((o.val ->> 'fixe')::numeric, g.fixe)
  from commercial_share_rules g
  left join lateral (select r.overrides -> p_key as val from commercial_rates r where r.commercial_id = p_commercial) o on true
  where g.key = p_key;
$$;


--
-- Name: commission_rates(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commission_rates(p_user uuid) RETURNS TABLE(pct numeric, fixe numeric, source text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_plan subscription_plans;
begin
  if p_user is not null then
    select p.* into v_plan from subscriptions s join subscription_plans p on p.id = s.plan_id
    where s.user_id = p_user and has_active_subscription(p_user);
    if v_plan.id is not null and (v_plan.commission_pct is not null or v_plan.commission_fixe is not null) then
      return query select coalesce(v_plan.commission_pct, 0)::numeric, coalesce(v_plan.commission_fixe, 0)::numeric, 'forfait'::text;
      return;
    end if;
  end if;
  return query select setting_num('commission_pct')::numeric, setting_num('commission_fixe')::numeric, 'defaut'::text;
end;
$$;


--
-- Name: confirm_delivery(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_delivery(p_mission_id bigint, p_reserves text DEFAULT NULL::text) RETURNS public.missions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_mission missions;
  v_offer freight_offers;
  v_caller uuid := auth.uid();
  v_res text := nullif(trim(p_reserves), '');
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
$$;


--
-- Name: create_invoice(bigint[], integer, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_invoice(p_mission_ids bigint[], p_delai_paiement integer DEFAULT 0, p_mode_reglement text DEFAULT 'virement'::text, p_timbre numeric DEFAULT 0, p_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_caller uuid := auth.uid();
  v_ids bigint[];
  v_n int;
  v_count int;
  v_me profiles;
  v_donor profiles;
  v_bp billing_profiles;
  v_donor_ids uuid[];
  v_ht numeric(14,2);
  v_taux numeric(5,2);
  v_tva numeric(14,2);
  v_year int := extract(year from current_date)::int;
  v_seq int;
  v_name text;
  v_donor_name text;
  v_invoice invoices;
begin
  select * into v_me from profiles where id = v_caller;
  if not found or v_me.role <> 'transporteur' or v_me.status <> 'valide' then
    raise exception 'Réservé aux transporteurs validés.';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_mission_ids) x;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then raise exception 'Aucune mission sélectionnée.'; end if;
  if v_n > 100 then raise exception 'Maximum 100 missions par facture.'; end if;
  if p_mode_reglement not in ('especes', 'cheque', 'virement', 'traite') then
    raise exception 'Mode de règlement invalide.';
  end if;
  if p_delai_paiement is null or p_delai_paiement < 0 or p_delai_paiement > 365 then
    raise exception 'Délai de paiement invalide (0 à 365 jours).';
  end if;
  if p_timbre is null or p_timbre < 0 then raise exception 'Droit de timbre invalide.'; end if;

  select * into v_bp from billing_profiles where transporteur_id = v_caller;
  if not found then
    raise exception 'Complétez d''abord votre profil de facturation (régime fiscal, TVA, coordonnées).';
  end if;
  v_name := coalesce(nullif(trim(v_me.entreprise), ''), nullif(trim(concat_ws(' ', v_me.prenom, v_me.full_name)), ''));
  if v_name is null or nullif(trim(v_me.adresse), '') is null or nullif(trim(v_me.nif), '') is null then
    raise exception 'Votre profil est incomplet : raison sociale, adresse et NIF sont obligatoires pour facturer.';
  end if;

  perform 1 from missions where id = any(v_ids) order by id for update;

  select count(*) into v_count from missions
  where id = any(v_ids) and transporteur_id = v_caller and status = 'cloturee';
  if v_count <> v_n then
    raise exception 'Certaines missions ne sont pas facturables (elles ne sont pas à vous ou pas encore clôturées).';
  end if;
  if exists (select 1 from invoice_lines where mission_id = any(v_ids) and active) then
    raise exception 'Une des missions est déjà facturée.';
  end if;

  select array_agg(distinct o.donneur_ordre_id) into v_donor_ids
  from missions m join freight_offers o on o.id = m.offer_id where m.id = any(v_ids);
  if array_length(v_donor_ids, 1) <> 1 then
    raise exception 'Une facture ne peut concerner qu''un seul donneur d''ordre.';
  end if;
  select * into v_donor from profiles where id = v_donor_ids[1];
  v_donor_name := coalesce(nullif(trim(v_donor.entreprise), ''), nullif(trim(concat_ws(' ', v_donor.prenom, v_donor.full_name)), ''));
  if v_donor_name is null or nullif(trim(v_donor.adresse), '') is null then
    raise exception 'Les informations du donneur d''ordre (raison sociale, adresse) sont incomplètes.';
  end if;

  select count(*), coalesce(sum(p.prix_propose), 0) into v_count, v_ht
  from missions m
  join proposals p on p.offer_id = m.offer_id and p.status = 'acceptee' and p.transporteur_id = v_caller
  where m.id = any(v_ids);
  if v_count <> v_n then
    raise exception 'Prix convenu introuvable pour une des missions.';
  end if;

  v_taux := case when v_bp.regime = 'tva' then v_bp.taux_tva else 0 end;
  v_tva := round(v_ht * v_taux / 100, 2);

  insert into invoice_counters (transporteur_id, annee, dernier_numero)
  values (v_caller, v_year, 1)
  on conflict (transporteur_id, annee) do update set dernier_numero = invoice_counters.dernier_numero + 1
  returning dernier_numero into v_seq;

  insert into invoices (
    numero, transporteur_id, donneur_ordre_id, date_echeance, delai_paiement, mode_reglement_prevu,
    emetteur, client, montant_ht, taux_tva, montant_tva, timbre_fiscal, montant_ttc, notes
  ) values (
    lpad(v_seq::text, 4, '0') || '/' || v_year, v_caller, v_donor_ids[1],
    case when p_delai_paiement > 0 then current_date + p_delai_paiement end,
    p_delai_paiement, p_mode_reglement,
    jsonb_build_object('raison_sociale', v_name, 'adresse', v_me.adresse, 'nif', v_me.nif, 'nrc', v_me.nrc,
      'nis', v_bp.nis, 'article_imposition', v_bp.article_imposition, 'rib', v_bp.rib,
      'regime', v_bp.regime, 'telephone', v_me.phone, 'mentions_legales', v_bp.mentions_legales),
    jsonb_build_object('raison_sociale', v_donor_name, 'adresse', v_donor.adresse, 'nif', v_donor.nif, 'nrc', v_donor.nrc),
    v_ht, v_taux, v_tva, p_timbre, v_ht + v_tva + p_timbre, nullif(trim(p_notes), '')
  ) returning * into v_invoice;

  insert into invoice_lines (invoice_id, mission_id, offer_id, designation, date_prestation, quantite, prix_unitaire_ht, montant_ht)
  select v_invoice.id, m.id, o.id,
         'Transport ' || coalesce(wd.name, o.wilaya_depart::text) || ' → ' || coalesce(wa.name, o.wilaya_arrivee::text)
           || ' — ' || coalesce(nullif(trim(o.type_marchandise), ''), nullif(trim(o.description), ''), 'marchandise')
           || ' (offre n° ' || o.id || ')',
         coalesce(m.dechargement_at, m.livraison_confirmee_at)::date, 1, p.prix_propose, p.prix_propose
  from missions m
  join freight_offers o on o.id = m.offer_id
  join proposals p on p.offer_id = o.id and p.status = 'acceptee' and p.transporteur_id = v_caller
  left join wilayas wd on wd.code = o.wilaya_depart
  left join wilayas wa on wa.code = o.wilaya_arrivee
  where m.id = any(v_ids)
  order by m.id;

  return to_jsonb(v_invoice) || jsonb_build_object('lines',
    (select jsonb_agg(to_jsonb(l) order by l.id) from invoice_lines l where l.invoice_id = v_invoice.id));
end;
$$;


--
-- Name: current_role_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_role_name() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role from public.profiles where id = auth.uid();
$$;


--
-- Name: decide_subscription_payment(bigint, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decide_subscription_payment(p_payment_id bigint, p_accept boolean, p_note text DEFAULT NULL::text) RETURNS public.subscription_payments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_pay subscription_payments;
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  select * into v_pay from subscription_payments where id = p_payment_id for update;
  if not found then raise exception 'Paiement introuvable.'; end if;
  if v_pay.statut <> 'en_attente' then
    raise exception 'Paiement déjà traité (statut : %).', v_pay.statut;
  end if;
  if p_accept then perform activate_subscription_payment(p_payment_id); end if;
  update subscription_payments
  set statut = case when p_accept then 'validee' else 'refusee' end,
      decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), '')
  where id = p_payment_id returning * into v_pay;
  return v_pay;
end;
$$;


--
-- Name: wallet_topups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_topups (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    amount_ht numeric(14,2) NOT NULL,
    mode text NOT NULL,
    reference text,
    status text DEFAULT 'en_attente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    decided_by uuid,
    decision_note text,
    CONSTRAINT wallet_topups_amount_ht_check CHECK ((amount_ht > (0)::numeric)),
    CONSTRAINT wallet_topups_mode_check CHECK ((mode = ANY (ARRAY['especes'::text, 'cheque'::text, 'virement'::text, 'ccp'::text, 'baridimob'::text, 'cib'::text]))),
    CONSTRAINT wallet_topups_status_check CHECK ((status = ANY (ARRAY['en_attente'::text, 'validee'::text, 'refusee'::text])))
);


--
-- Name: decide_topup(bigint, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decide_topup(p_topup_id bigint, p_accept boolean, p_note text DEFAULT NULL::text) RETURNS public.wallet_topups
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_t wallet_topups;
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  select * into v_t from wallet_topups where id = p_topup_id for update;
  if not found then raise exception 'Demande introuvable.'; end if;
  if v_t.status <> 'en_attente' then raise exception 'Demande déjà traitée (statut : %).', v_t.status; end if;
  update wallet_topups
  set status = case when p_accept then 'validee' else 'refusee' end,
      decided_at = now(), decided_by = auth.uid(), decision_note = nullif(trim(p_note), '')
  where id = p_topup_id returning * into v_t;
  if p_accept then
    insert into wallet_transactions (user_id, type, amount_ht, reference, note, created_by)
    values (v_t.user_id, 'recharge', v_t.amount_ht, v_t.reference, 'Recharge validée', auth.uid());
  end if;
  return v_t;
end;
$$;


--
-- Name: driver_quota(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.driver_quota(p_carrier uuid) RETURNS TABLE(limite integer, actuels bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select setting_num('chauffeurs_max_defaut', 50)::int,
         (select count(*) from profiles c where c.transporteur_id = p_carrier and c.role = 'chauffeur' and c.is_active);
$$;


--
-- Name: enforce_recipient_is_associated(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_recipient_is_associated() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (
    select 1
    from freight_offers o
    join carrier_associations ca
      on ca.shipper_id = o.donneur_ordre_id and ca.carrier_id = new.carrier_id
    where o.id = new.offer_id
  ) then
    raise exception 'Transporteur non associé à ce donneur d''ordre' using errcode = '23514';
  end if;
  return new;
end;
$$;


--
-- Name: enforce_vehicle_quota(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_vehicle_quota(p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_plan subscription_plans; v_role text; v_limit int; v_active int; v_free int; r record;
begin
  perform set_config('netlog.bypass_vehicle_guard', 'on', true);
  if not setting_bool('subscription_enforced') then
    update vehicles set suspendu_abonnement = false where transporteur_id = p_user and suspendu_abonnement;
    return;
  end if;
  select role::text into v_role from profiles where id = p_user;
  select p.* into v_plan from subscriptions s join subscription_plans p on p.id = s.plan_id
   where s.user_id = p_user and s.statut in ('active', 'offerte');
  if v_plan.id is null then return; end if;
  v_limit := case when v_role = 'transporteur' or v_plan.permet_flotte_propre
                  then coalesce(v_plan.max_camions, 2147483647) else 0 end;
  select count(*) into v_active from vehicles where transporteur_id = p_user and not suspendu_abonnement;

  if v_active > v_limit then
    for r in
      select v.id from vehicles v
       where v.transporteur_id = p_user and not v.suspendu_abonnement
       order by exists (select 1 from missions m where m.vehicle_id = v.id and m.status not in ('cloturee', 'annulee')) asc,
                v.created_at desc, v.id desc
       limit v_active - v_limit
    loop
      update vehicles set suspendu_abonnement = true where id = r.id;
    end loop;
    update proposals set status = 'retiree'
     where transporteur_id = p_user and status = 'en_attente'
       and vehicle_id in (select id from vehicles where transporteur_id = p_user and suspendu_abonnement);
  elsif v_active < v_limit then
    v_free := least(v_limit - v_active, 2147483647);
    for r in
      select id from vehicles where transporteur_id = p_user and suspendu_abonnement
       order by created_at asc, id asc limit v_free
    loop
      update vehicles set suspendu_abonnement = false where id = r.id;
    end loop;
  end if;
end;
$$;


--
-- Name: ensure_my_directory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_my_directory() RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id bigint; v_role text;
begin
  select role::text into v_role from profiles where id = auth.uid();
  if v_role is null or v_role not in ('donneur_ordre', 'commissionnaire') then
    raise exception 'Réservé aux donneurs d''ordre et aux commissionnaires.';
  end if;
  select id into v_id from private_directories where owner_id = auth.uid() order by id limit 1;
  if v_id is null then
    insert into private_directories (owner_id, name) values (auth.uid(), 'Mes transporteurs affiliés') returning id into v_id;
  end if;
  return v_id;
end;
$$;


--
-- Name: estimate_commission(numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.estimate_commission(p_price numeric, p_user uuid DEFAULT NULL::uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select round(coalesce(p_price, 0) * r.pct / 100, 2) + round(r.fixe, 2) from commission_rates(p_user) r;
$$;


--
-- Name: get_counterparties(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_counterparties() RETURNS TABLE(id uuid, display_name text, phone text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with links as (
    -- via une proposition : le nom seulement
    select o.donneur_ordre_id as a, pr.transporteur_id as b, false as has_mission
    from proposals pr join freight_offers o on o.id = pr.offer_id
    union all
    -- via une mission : nom et téléphone
    select o.donneur_ordre_id, m.transporteur_id, true
    from missions m join freight_offers o on o.id = m.offer_id
    union all
    select o.donneur_ordre_id, m.chauffeur_id, true
    from missions m join freight_offers o on o.id = m.offer_id
    where m.chauffeur_id is not null
    union all
    select m.transporteur_id, m.chauffeur_id, true
    from missions m where m.chauffeur_id is not null
  ),
  mine as (
    select case when a = auth.uid() then b else a end as other,
           bool_or(has_mission) as has_mission
    from links
    where a = auth.uid() or b = auth.uid()
    group by 1
  )
  select p.id,
         coalesce(nullif(trim(p.entreprise), ''),
                  nullif(trim(concat_ws(' ', p.prenom, p.full_name)), ''))::text,
         (case when mine.has_mission then p.phone end)::text
  from mine join profiles p on p.id = mine.other
  where mine.other is not null and mine.other <> auth.uid();
$$;


--
-- Name: get_ldv_payload(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ldv_payload(p_mission_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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

  if not (o.donneur_ordre_id = v_uid or m.transporteur_id = v_uid
          or m.chauffeur_id = v_uid or public.is_admin()) then
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
$$;


--
-- Name: get_my_mission_details(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_mission_details() RETURNS TABLE(mission_id bigint, offer_id bigint, donneur_nom text, donneur_tel text, transporteur_nom text, transporteur_tel text, chauffeur_nom text, chauffeur_tel text, vehicule_type text, vehicule_immatriculation text, vehicule_capacite_kg integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.id, m.offer_id,
    coalesce(nullif(trim(dn.entreprise), ''), nullif(trim(concat_ws(' ', dn.prenom, dn.full_name)), '')),
    dn.phone,
    coalesce(nullif(trim(t.entreprise), ''), nullif(trim(concat_ws(' ', t.prenom, t.full_name)), '')),
    t.phone,
    nullif(trim(concat_ws(' ', d.prenom, d.full_name)), ''),
    d.phone,
    v.type, v.immatriculation, v.capacite_kg
  from missions m
  join freight_offers o on o.id = m.offer_id
  left join profiles dn on dn.id = o.donneur_ordre_id
  left join profiles t on t.id = m.transporteur_id
  left join profiles d on d.id = m.chauffeur_id
  left join vehicles v on v.id = m.vehicle_id
  where o.donneur_ordre_id = auth.uid()
     or m.transporteur_id = auth.uid()
     or m.chauffeur_id = auth.uid()
     or is_admin();
$$;


--
-- Name: get_payment_instructions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_payment_instructions() RETURNS TABLE(beneficiaire text, rib text, instructions text, tva_pct numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select setting_text('netlog_beneficiaire', ''), setting_text('netlog_rib', ''),
         setting_text('netlog_instructions_paiement', ''), setting_num('tva_abonnement_pct');
$$;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    user_id uuid NOT NULL,
    plan_id bigint NOT NULL,
    statut text NOT NULL,
    debut date DEFAULT CURRENT_DATE NOT NULL,
    fin date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT subscriptions_statut_check CHECK ((statut = ANY (ARRAY['active'::text, 'offerte'::text, 'suspendue'::text])))
);


--
-- Name: grant_free_subscription(uuid, bigint, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_free_subscription(p_user uuid, p_plan_id bigint, p_mois integer DEFAULT NULL::integer, p_validate boolean DEFAULT true) RETURNS public.subscriptions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_target profiles; v_plan subscription_plans; v_sub subscriptions;
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  select * into v_target from profiles where id = p_user;
  if not found then raise exception 'Compte introuvable.'; end if;
  select * into v_plan from subscription_plans where id = p_plan_id;
  if not found then raise exception 'Forfait introuvable.'; end if;
  if not (v_target.role::text = any (v_plan.roles)) then
    raise exception 'Ce forfait ne correspond pas au type de compte.';
  end if;
  if p_mois is not null and (p_mois < 1 or p_mois > 120) then raise exception 'Durée invalide.'; end if;
  insert into subscriptions (user_id, plan_id, statut, debut, fin, updated_by)
  values (p_user, p_plan_id, 'offerte', current_date,
          case when p_mois is null then null else (current_date + (p_mois::text || ' months')::interval)::date - 1 end,
          auth.uid())
  on conflict (user_id) do update
    set plan_id = excluded.plan_id, statut = 'offerte', debut = excluded.debut, fin = excluded.fin,
        updated_at = now(), updated_by = auth.uid()
  returning * into v_sub;
  if p_validate then
    update profiles set status = 'valide' where id = p_user and status = 'en_attente';
  end if;
  return v_sub;
end;
$$;


--
-- Name: guard_mission_status_transition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_mission_status_transition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_priv boolean := coalesce(current_setting('netlog.bypass_status_guard', true), 'off') = 'on'
                    or current_user in ('postgres', 'service_role', 'supabase_admin')
                    or is_admin();
  v_old int;
  v_new int;
begin
  if new.status in ('decharge', 'livree')
     and old.status is distinct from new.status
     and new.dechargement_at is null then
    new.dechargement_at := now();
  end if;

  if new.livraison_confirmee_at is distinct from old.livraison_confirmee_at and not v_priv then
    raise exception 'La confirmation de livraison ne peut être faite que par le donneur d''ordre.';
  end if;

  if new.status is distinct from old.status and not v_priv then
    if new.status = 'cloturee' then
      raise exception 'Transition de statut "%->%" interdite en écriture directe.', old.status, new.status;
    end if;

    if new.status = 'annulee' then
      if old.status::text not in ('creee', 'acceptee_chauffeur', 'en_route_chargement', 'sur_site_chargement') then
        raise exception 'Une mission déjà chargée ne peut plus être annulée (statut actuel : %).', old.status;
      end if;
    else
      v_old := case old.status::text
        when 'creee' then 0 when 'acceptee_chauffeur' then 1 when 'en_route_chargement' then 2
        when 'sur_site_chargement' then 3 when 'en_route' then 4 when 'en_transit' then 5
        when 'sur_site_livraison' then 6 when 'decharge' then 7 when 'livree' then 8
        when 'cloturee' then 9 end;
      v_new := case new.status::text
        when 'creee' then 0 when 'acceptee_chauffeur' then 1 when 'en_route_chargement' then 2
        when 'sur_site_chargement' then 3 when 'en_route' then 4 when 'en_transit' then 5
        when 'sur_site_livraison' then 6 when 'decharge' then 7 when 'livree' then 8
        when 'cloturee' then 9 end;

      if v_old is null or v_new is null or v_new <= v_old then
        raise exception 'Transition impossible : la mission est déjà « % » (retour à « % » interdit).', old.status, new.status;
      end if;
      if new.status::text in ('decharge', 'livree') and v_old < 4 then
        raise exception 'Déclarez d''abord le chargement avant de déclarer la livraison.';
      end if;
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: guard_profile_role_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_profile_role_admin() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and new.role::text = 'admin'
     and (tg_op = 'INSERT' or new.role is distinct from old.role) then
    raise exception 'Attribution du rôle admin interdite' using errcode = '42501';
  end if;
  return new;
end;
$$;


--
-- Name: guard_visibility_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_visibility_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.visibility is distinct from old.visibility
     and auth.uid() is not null
     and coalesce(current_setting('netlog.visibility_rpc', true), '') <> 'on' then
    raise exception 'La visibilité ne peut être modifiée que via set_offer_visibility'
      using errcode = '42501';
  end if;
  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_role public.user_role;
begin
  v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'donneur_ordre'::public.user_role);
  if v_role = 'admin'::public.user_role then
    v_role := 'donneur_ordre'::public.user_role;
  end if;

  insert into public.profiles (id, email, phone, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'full_name', 'Utilisateur'),
    v_role
  );
  return new;
end;
$$;


--
-- Name: has_active_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_active_subscription(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from subscriptions s
    where s.user_id = p_user and s.statut in ('active', 'offerte')
      and (s.fin is null or s.fin + setting_num('abonnement_grace_jours')::int >= current_date));
$$;


--
-- Name: directory_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directory_members (
    id bigint NOT NULL,
    directory_id bigint NOT NULL,
    transporteur_id uuid,
    vehicle_id bigint,
    chauffeur_id uuid,
    status text DEFAULT 'en_attente'::text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT directory_members_status_check CHECK ((status = ANY (ARRAY['en_attente'::text, 'accepte'::text, 'refuse'::text])))
);


--
-- Name: invite_carrier(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invite_carrier(p_carrier uuid) RETURNS public.directory_members
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_dir bigint; v_row directory_members; v_exists boolean; v_limit int; v_count int;
begin
  if not can_use_affiliated_carriers(auth.uid()) then
    raise exception 'Votre forfait ne permet pas d''affilier des transporteurs.';
  end if;
  if p_carrier is null or p_carrier = auth.uid() or not exists (
       select 1 from profiles where id = p_carrier and role = 'transporteur' and status = 'valide' and coalesce(is_active, true)) then
    raise exception 'Transporteur introuvable ou non validé.';
  end if;
  v_dir := ensure_my_directory();
  select * into v_row from directory_members
   where directory_id = v_dir and transporteur_id = p_carrier and vehicle_id is null and chauffeur_id is null for update;
  v_exists := found;
  if v_exists and v_row.status in ('en_attente', 'accepte') then
    raise exception 'Ce transporteur est déjà dans votre liste (statut : %).', v_row.status;
  end if;
  v_limit := affiliate_limit(auth.uid());
  select count(*) into v_count from directory_members
   where directory_id = v_dir and vehicle_id is null and chauffeur_id is null and status in ('en_attente', 'accepte');
  if v_count >= v_limit then
    raise exception 'Limite de transporteurs affiliés atteinte pour votre forfait (% transporteur(s)).', v_limit;
  end if;
  if v_exists then
    update directory_members set status = 'en_attente', invited_by = auth.uid() where id = v_row.id returning * into v_row;
  else
    insert into directory_members (directory_id, transporteur_id, status, invited_by)
    values (v_dir, p_carrier, 'en_attente', auth.uid()) returning * into v_row;
  end if;
  return v_row;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;


--
-- Name: is_carrier(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_carrier(p_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = p_id and role::text = 'transporteur' and coalesce(is_active, true)
  );
$$;


--
-- Name: is_directory_owner(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_directory_owner(p_directory_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.private_directories
    WHERE id = p_directory_id AND owner_id = auth.uid()
  );
$$;


--
-- Name: is_fleet_driver(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_fleet_driver(p_driver uuid, p_carrier uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles d
    where d.id = p_driver and d.role = 'chauffeur'
      and d.status = 'valide' and d.transporteur_id = p_carrier
  );
$$;


--
-- Name: is_mission_party(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_mission_party(p_mission_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.missions m
    join public.freight_offers o on o.id = m.offer_id
    where m.id = p_mission_id
      and auth.uid() is not null
      and (o.donneur_ordre_id = auth.uid()
           or m.transporteur_id = auth.uid()
           or m.chauffeur_id = auth.uid())
  );
$$;


--
-- Name: is_my_network_donor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_my_network_donor(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from profiles where id = p_user and commercial_id = auth.uid() and role = 'donneur_ordre');
$$;


--
-- Name: is_my_network_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_my_network_member(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from profiles where id = p_user and commercial_id = auth.uid());
$$;


--
-- Name: is_offer_owner(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_offer_owner(p_offer_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from freight_offers
    where id = p_offer_id and donneur_ordre_id = auth.uid()
  );
$$;


--
-- Name: is_offer_recipient(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_offer_recipient(p_offer_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from freight_offer_recipients
    where offer_id = p_offer_id and carrier_id = auth.uid()
  );
$$;


--
-- Name: is_quai_operator_for_offer(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_quai_operator_for_offer(p_offer_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.freight_offers fo
    join public.profiles don on don.id = fo.donneur_ordre_id
    join public.profiles op on op.id = auth.uid()
    where fo.id = p_offer_id
      and op.role = 'operateur_quai'
      and op.organization_id is not null
      and op.organization_id = don.organization_id
  );
$$;


--
-- Name: is_validated(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_validated() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and status = 'valide'
  );
$$;


--
-- Name: is_vehicle_owner(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_vehicle_owner(p_vehicle_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE id = p_vehicle_id AND transporteur_id = auth.uid()
  );
$$;


--
-- Name: list_my_carriers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_my_carriers() RETURNS TABLE(carrier_id uuid, company_name text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select ca.carrier_id,
         coalesce(nullif(p.entreprise, ''), p.full_name) as company_name,
         ca.created_at
  from carrier_associations ca
  join profiles p on p.id = ca.carrier_id
  where ca.shipper_id = auth.uid()
  order by 2;
$$;


--
-- Name: mark_invoice_paid(bigint, text, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_invoice_paid(p_invoice_id bigint, p_mode text, p_reference text DEFAULT NULL::text, p_paid_on date DEFAULT CURRENT_DATE) RETURNS public.invoices
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_inv invoices;
begin
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then raise exception 'Facture introuvable.'; end if;
  if not (v_inv.transporteur_id = auth.uid() or is_admin()) then
    raise exception 'Seul l''émetteur de la facture peut enregistrer son règlement.';
  end if;
  if v_inv.status <> 'emise' then
    raise exception 'Cette facture n''est pas en attente de règlement (statut : %).', v_inv.status;
  end if;
  if p_mode not in ('especes', 'cheque', 'virement', 'traite') then
    raise exception 'Mode de règlement invalide.';
  end if;
  update invoices
  set status = 'payee', paid_at = p_paid_on::timestamptz, mode_reglement_effectif = p_mode,
      reference_reglement = nullif(trim(p_reference), '')
  where id = p_invoice_id returning * into v_inv;
  return v_inv;
end;
$$;


--
-- Name: my_affiliate_quota(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_affiliate_quota() RETURNS TABLE(autorise boolean, limite integer, utilises bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select can_use_affiliated_carriers(auth.uid()), affiliate_limit(auth.uid()),
         (select count(*) from directory_members m join private_directories d on d.id = m.directory_id
           where d.owner_id = auth.uid() and m.vehicle_id is null and m.chauffeur_id is null
             and m.status in ('en_attente', 'accepte'));
$$;


--
-- Name: my_affiliates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_affiliates() RETURNS TABLE(member_id bigint, carrier_id uuid, nom text, wilaya text, statut text, depuis date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.id, m.transporteur_id,
         coalesce(nullif(trim(p.entreprise), ''), nullif(trim(concat_ws(' ', p.prenom, p.full_name)), ''), 'Transporteur'),
         (select w.name from wilayas w where w.code = p.wilaya_code), m.status, m.created_at::date
  from directory_members m
  join private_directories d on d.id = m.directory_id
  join profiles p on p.id = m.transporteur_id
  where d.owner_id = auth.uid() and m.vehicle_id is null and m.chauffeur_id is null
  order by m.created_at desc;
$$;


--
-- Name: my_affiliations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_affiliations() RETURNS TABLE(member_id bigint, owner_id uuid, owner_nom text, owner_role text, statut text, depuis date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.id, d.owner_id,
         coalesce(nullif(trim(o.entreprise), ''), nullif(trim(concat_ws(' ', o.prenom, o.full_name)), ''), 'Donneur d''ordre'),
         o.role::text, m.status, m.created_at::date
  from directory_members m
  join private_directories d on d.id = m.directory_id
  join profiles o on o.id = d.owner_id
  where m.transporteur_id = auth.uid() and m.vehicle_id is null and m.chauffeur_id is null and d.owner_id <> auth.uid()
  order by m.created_at desc;
$$;


--
-- Name: my_can_use_affiliated_carriers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_can_use_affiliated_carriers() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.can_use_affiliated_carriers(auth.uid());
$$;


--
-- Name: my_earnings(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_earnings(p_limit integer DEFAULT 300) RETURNS TABLE(id bigint, created_at timestamp with time zone, source text, scenario text, membre text, base_ht numeric, taux_pct numeric, fixe_ht numeric, montant_ht numeric, plafonne boolean, special boolean, statut text, payout_id bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select e.id, e.created_at, e.source, e.scenario,
         coalesce(nullif(trim(m.entreprise), ''), nullif(trim(concat_ws(' ', m.prenom, m.full_name)), ''), 'Membre'),
         e.base_ht, e.taux_pct, e.fixe_ht, e.montant_ht, e.plafonne, e.special, e.statut, e.payout_id
  from commercial_earnings e left join profiles m on m.id = e.member_id
  where e.commercial_id = auth.uid()
  order by e.id desc
  limit least(coalesce(p_limit, 300), 1000);
$$;


--
-- Name: my_fleet_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_fleet_access() RETURNS TABLE(autorise boolean, limite integer, actifs bigint, total bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select can_use_own_fleet(auth.uid()), q.limite, q.actifs, q.total from vehicle_quota(auth.uid()) q;
$$;


--
-- Name: my_network(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_network() RETURNS TABLE(member_id uuid, nom text, role text, statut_compte text, inscrit_le date, abonnement_actif boolean, abonnement_fin date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id,
         coalesce(nullif(trim(p.entreprise), ''), nullif(trim(concat_ws(' ', p.prenom, p.full_name)), ''), 'Membre'),
         p.role::text, p.status, p.created_at::date,
         has_active_subscription(p.id), s.fin
  from profiles p left join subscriptions s on s.user_id = p.id
  where p.commercial_id = auth.uid()
  order by p.created_at desc;
$$;


--
-- Name: my_organization_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_organization_id() RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select organization_id from public.profiles where id = auth.uid();
$$;


--
-- Name: my_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_subscription() RETURNS TABLE(plan_nom text, statut text, debut date, fin date, actif boolean, offerte boolean, max_camions integer, camions_actifs bigint, camions_total bigint, chauffeurs_actuels bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.nom, s.statut, s.debut, s.fin, has_active_subscription(auth.uid()), s.statut = 'offerte', p.max_camions,
         (select count(*) from vehicles v where v.transporteur_id = auth.uid() and not v.suspendu_abonnement),
         (select count(*) from vehicles v where v.transporteur_id = auth.uid()),
         (select count(*) from profiles c where c.transporteur_id = auth.uid() and c.role = 'chauffeur' and c.is_active)
  from subscriptions s join subscription_plans p on p.id = s.plan_id
  where s.user_id = auth.uid();
$$;


--
-- Name: my_vehicle_quota(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_vehicle_quota() RETURNS TABLE(limite integer, actifs bigint, total bigint, applicable boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select * from vehicle_quota(auth.uid());
$$;


--
-- Name: my_wallet(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_wallet() RETURNS TABLE(solde numeric, reserve numeric, disponible numeric, blocage_actif boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select wallet_balance(auth.uid()), wallet_reserved(auth.uid()), wallet_available(auth.uid()), setting_bool('wallet_enabled');
$$;


--
-- Name: my_wallet_for_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_wallet_for_subscription() RETURNS TABLE(utilisable numeric, autorise boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select greatest(0, wallet_available(auth.uid())
           - case when setting_bool('wallet_abonnement_exclut_credit_bienvenue', true)
                  then coalesce((select sum(amount_ht) from wallet_transactions
                                 where user_id = auth.uid() and type = 'credit_bienvenue'), 0)
                  else 0 end),
         setting_bool('wallet_abonnement_autorise', true);
$$;


--
-- Name: pay_subscription_from_wallet(bigint, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pay_subscription_from_wallet(p_plan_id bigint, p_mois integer) RETURNS public.subscription_payments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_caller uuid := auth.uid();
  v_me profiles; v_plan subscription_plans; v_pay subscription_payments;
  v_ht numeric(14,2); v_tva numeric(5,2); v_usable numeric; v_welcome numeric := 0;
begin
  if v_caller is null then raise exception 'Connexion requise.'; end if;
  if not setting_bool('wallet_abonnement_autorise', true) then
    raise exception 'Le paiement d''un abonnement avec le portefeuille n''est pas activé.';
  end if;
  perform 1 from profiles where id = v_caller for update;
  select * into v_me from profiles where id = v_caller;
  if not found or v_me.status <> 'valide'
     or v_me.role::text not in ('donneur_ordre', 'transporteur', 'manutentionnaire', 'commissionnaire', 'stockage') then
    raise exception 'Votre compte n''a pas de portefeuille ou n''est pas validé.';
  end if;
  if exists (select 1 from subscriptions where user_id = v_caller and statut = 'suspendue') then
    raise exception 'Abonnement suspendu : contactez NETLOG.';
  end if;
  select * into v_plan from subscription_plans where id = p_plan_id and actif;
  if not found then raise exception 'Forfait indisponible.'; end if;
  if not (v_me.role::text = any (v_plan.roles)) then
    raise exception 'Ce forfait ne correspond pas à votre type de compte.';
  end if;
  if p_mois is null or p_mois < 1 or p_mois > 12 then raise exception 'Durée invalide (1 à 12 mois).'; end if;

  v_ht := round(v_plan.prix_mensuel_ht * p_mois, 2);
  v_tva := setting_num('tva_abonnement_pct');
  v_usable := wallet_available(v_caller);
  if setting_bool('wallet_abonnement_exclut_credit_bienvenue', true) then
    select coalesce(sum(amount_ht), 0) into v_welcome from wallet_transactions
     where user_id = v_caller and type = 'credit_bienvenue';
  end if;
  v_usable := greatest(0, v_usable - v_welcome);
  if v_usable < v_ht then
    raise exception 'Solde utilisable insuffisant : % DA HT disponibles pour un abonnement de % DA HT. Le crédit de bienvenue et vos engagements en cours ne peuvent pas servir à payer un abonnement. Rechargez votre portefeuille.', v_usable, v_ht;
  end if;

  insert into subscription_payments (user_id, plan_id, mois, montant_ht, taux_tva, montant_ttc, mode,
                                     declare_par, statut, decided_at, decision_note)
  values (v_caller, p_plan_id, p_mois, v_ht, v_tva, round(v_ht * (1 + v_tva / 100), 2), 'portefeuille',
          v_caller, 'validee', now(), 'Payé avec le portefeuille')
  returning * into v_pay;
  if v_ht > 0 then
    insert into wallet_transactions (user_id, type, amount_ht, reference, note, created_by)
    values (v_caller, 'debit_abonnement', -v_ht, 'ABO-' || v_pay.id,
            'Abonnement ' || v_plan.nom || ' (' || p_mois || ' mois)', v_caller);
  end if;
  return activate_subscription_payment(v_pay.id);
end;
$$;


--
-- Name: protect_directory_member_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_directory_member_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Le propriétaire du répertoire peut tout modifier.
  if is_admin() or exists (
    select 1 from public.private_directories d
    where d.id = new.directory_id and d.owner_id = auth.uid()
  ) then
    return new;
  end if;

  -- Sinon (le membre répond à une invitation) : seul `status` peut
  -- changer, tout le reste doit rester identique.
  if new.directory_id is distinct from old.directory_id
    or new.transporteur_id is distinct from old.transporteur_id
    or new.vehicle_id is distinct from old.vehicle_id
    or new.chauffeur_id is distinct from old.chauffeur_id
    or new.invited_by is distinct from old.invited_by
  then
    raise exception 'Seul le statut peut être modifié par le membre invité.';
  end if;

  return new;
end;
$$;


--
-- Name: protect_profile_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_profile_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if not is_admin() and current_user not in ('postgres', 'service_role') then
    if new.status is distinct from old.status then
      raise exception 'Seul un administrateur peut modifier le statut de validation.';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Seul un administrateur peut modifier le rôle.';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Seul un administrateur peut modifier is_active.';
    end if;
    if new.abonnement_actif is distinct from old.abonnement_actif
       or new.date_expiration_abonnement is distinct from old.date_expiration_abonnement then
      raise exception 'Seul un administrateur peut modifier l''abonnement.';
    end if;
    if new.organization_id is distinct from old.organization_id
       or new.transporteur_id is distinct from old.transporteur_id then
      raise exception 'Seul un administrateur peut modifier le rattachement.';
    end if;
    if old.status = 'valide' and (
         new.entreprise is distinct from old.entreprise
         or new.nrc is distinct from old.nrc
         or new.nif is distinct from old.nif
         or new.full_name is distinct from old.full_name
         or new.prenom is distinct from old.prenom
       ) then
      raise exception 'Identité validée : contactez NETLOG pour la modifier.';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: record_commission(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_commission(p_mission_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_m missions; v_o freight_offers; v_price numeric;
  v_res wallet_reservations; v_has_res boolean;
  v_amount numeric; v_detail jsonb; v_reglement text;
  v_cc uuid; v_cd uuid; v_pub uuid; v_scenario text;
  v_sp offer_special_commission;
  r record; e jsonb;
  v_pct numeric; v_fixe numeric; v_part numeric; v_special boolean;
  v_rows jsonb := '[]'::jsonb; v_total numeric := 0; v_factor numeric := 1;
  v_seen uuid[] := '{}';
  v_cumul boolean := setting_bool('commercial_cumul_meme_reseau', true);
begin
  select * into v_m from missions where id = p_mission_id;
  if exists (select 1 from commission_entries where mission_id = p_mission_id) then return; end if;
  select * into v_o from freight_offers where id = v_m.offer_id;
  select p.prix_propose into v_price from proposals p
   where p.offer_id = v_m.offer_id and p.status = 'acceptee' and p.transporteur_id = v_m.transporteur_id limit 1;
  if v_price is null then return; end if;

  -- Commission NETLOG (réservation du portefeuille, sinon calcul au tarif en vigueur) : toujours prélevée
  select * into v_res from wallet_reservations where mission_id = p_mission_id and status = 'active' for update;
  v_has_res := found;
  if v_has_res then
    v_amount := v_res.amount_ht;
    v_detail := coalesce(v_res.detail, '{}'::jsonb);
  else
    select round(coalesce(v_price, 0) * rr.pct / 100, 2) + round(rr.fixe, 2),
           jsonb_build_object('pct', rr.pct, 'fixe', rr.fixe, 'source', rr.source)
      into v_amount, v_detail from commission_rates(v_m.transporteur_id) rr;
  end if;
  if v_has_res then
    update wallet_reservations set status = 'consommee', settled_at = now() where id = v_res.id;
    if v_amount > 0 then
      insert into wallet_transactions (user_id, type, amount_ht, mission_id, note)
      values (v_m.transporteur_id, 'debit_commission', -v_amount, p_mission_id, 'Commission NETLOG');
    end if;
    v_reglement := 'wallet';
  else
    v_reglement := 'a_facturer';
  end if;
  insert into commission_entries (mission_id, transporteur_id, donneur_ordre_id, base_ht, montant_ht, reglement, detail)
  values (p_mission_id, v_m.transporteur_id, v_o.donneur_ordre_id, v_price, v_amount, v_reglement, v_detail);

  -- Parts des commerciaux : base = commission NETLOG de la mission
  select commercial_id into v_cc from profiles where id = v_m.transporteur_id;
  select commercial_id into v_cd from profiles where id = v_o.donneur_ordre_id;
  v_pub := case when v_o.publie_par_role = 'commercial' then v_o.publie_par end;
  v_scenario := case
    when v_o.publie_par_role = 'admin' then 'offre_netlog'
    when v_o.publie_par_role = 'commercial' then 'offre_commercial'
    when v_cc is not null and v_cc = v_cd then 'meme_reseau'
    when v_cc is not null or v_cd is not null then 'reseaux_differents'
    else 'aucun' end;
  select * into v_sp from offer_special_commission where offer_id = v_o.id;

  for r in
    select * from (values
      ('transporteur'::text, v_cc,
        case v_scenario when 'meme_reseau' then 'meme_reseau_transporteur'
                        when 'reseaux_differents' then 'reseaux_differents_transporteur'
                        when 'offre_netlog' then 'offre_netlog_transporteur'
                        when 'offre_commercial' then 'offre_commercial_transporteur' end, 1),
      ('donneur'::text,
        case when v_scenario = 'reseaux_differents' and v_cd is distinct from v_cc then v_cd end,
        'reseaux_differents_donneur', 2),
      ('publieur'::text, case when v_scenario = 'offre_commercial' then v_pub end,
        'offre_commercial_publieur', 3)
    ) as t(rl, commercial, rate_key, ord)
    where commercial is not null and rate_key is not null order by ord
  loop
    if r.commercial = any (v_seen) and not v_cumul then continue; end if;
    v_seen := v_seen || r.commercial;
    select s.pct, s.fixe into v_pct, v_fixe from commercial_share(r.commercial, r.rate_key) s;
    v_pct := coalesce(v_pct, 0);
    v_fixe := coalesce(v_fixe, 0);
    v_special := v_sp.offer_id is not null and v_sp.beneficiaire = r.rl;
    if v_special then
      v_pct := coalesce(v_sp.pct, 0);
      v_fixe := coalesce(v_sp.fixe, 0);
    end if;
    v_part := round(v_amount * v_pct / 100, 2) + v_fixe;
    if not v_special then v_total := v_total + v_part; end if;
    if v_part > 0 then
      v_rows := v_rows || jsonb_build_object('commercial', r.commercial, 'rl', r.rl, 'pct', v_pct,
                                             'fixe', v_fixe, 'theorique', v_part, 'special', v_special);
    end if;
  end loop;

  if v_total > v_amount and setting_bool('commercial_plafond_commission', true) then
    v_factor := case when v_total > 0 then v_amount / v_total else 0 end;
  end if;

  for e in select value from jsonb_array_elements(v_rows) loop
    v_part := case when (e ->> 'special')::boolean then (e ->> 'theorique')::numeric
                   else round((e ->> 'theorique')::numeric * v_factor, 2) end;
    if v_part > 0 then
      insert into commercial_earnings (commercial_id, source, mission_id, member_id, base_ht, taux_pct, fixe_ht,
                                       montant_ht, scenario, montant_theorique_ht, plafonne, special)
      values ((e ->> 'commercial')::uuid,
              case e ->> 'rl' when 'transporteur' then 'commission_transporteur'
                              when 'donneur' then 'commission_donneur' else 'commission_publieur' end,
              p_mission_id,
              case e ->> 'rl' when 'transporteur' then v_m.transporteur_id else v_o.donneur_ordre_id end,
              v_amount, (e ->> 'pct')::numeric, (e ->> 'fixe')::numeric, v_part,
              v_scenario, (e ->> 'theorique')::numeric,
              (not (e ->> 'special')::boolean) and v_factor < 1, (e ->> 'special')::boolean)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;


--
-- Name: remove_affiliation(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_affiliation(p_member_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_m directory_members; v_owner uuid;
begin
  select * into v_m from directory_members where id = p_member_id for update;
  if not found or v_m.vehicle_id is not null or v_m.chauffeur_id is not null then
    raise exception 'Affiliation introuvable.';
  end if;
  select owner_id into v_owner from private_directories where id = v_m.directory_id;
  if not (v_owner = auth.uid() or v_m.transporteur_id = auth.uid()) then
    raise exception 'Affiliation introuvable.';
  end if;
  delete from freight_offer_recipients r using freight_offers o
   where o.id = r.offer_id and o.donneur_ordre_id = v_owner
     and r.carrier_id = v_m.transporteur_id and o.status = 'ouverte';
  delete from directory_members where id = p_member_id;
end;
$$;


--
-- Name: request_subscription_payment(uuid, bigint, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_subscription_payment(p_user uuid, p_plan_id bigint, p_mois integer, p_mode text, p_reference text, p_preuve_path text DEFAULT NULL::text) RETURNS public.subscription_payments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_caller uuid := auth.uid();
  v_target profiles; v_plan subscription_plans; v_pay subscription_payments;
  v_ht numeric(14,2); v_tva numeric(5,2);
begin
  select * into v_target from profiles where id = p_user;
  if not found then raise exception 'Compte introuvable.'; end if;
  if not (p_user = v_caller or is_admin()
          or (v_target.commercial_id = v_caller and exists
              (select 1 from profiles c where c.id = v_caller and c.role = 'commercial' and c.status = 'valide'))) then
    raise exception 'Vous ne pouvez pas déclarer un paiement pour ce compte.';
  end if;
  select * into v_plan from subscription_plans where id = p_plan_id and actif;
  if not found then raise exception 'Forfait indisponible.'; end if;
  if not (v_target.role::text = any (v_plan.roles)) then
    raise exception 'Ce forfait ne correspond pas au type de compte.';
  end if;
  if p_mois is null or p_mois < 1 or p_mois > 12 then raise exception 'Durée invalide (1 à 12 mois).'; end if;
  if p_mode not in ('virement', 'ccp', 'baridimob', 'cib', 'versement_especes') then
    raise exception 'Mode de paiement invalide.';
  end if;
  if nullif(trim(p_reference), '') is null and nullif(trim(p_preuve_path), '') is null then
    raise exception 'Indiquez la référence du versement ou joignez la preuve.';
  end if;
  if (select count(*) from subscription_payments where user_id = p_user and statut = 'en_attente') >= 3 then
    raise exception 'Des paiements sont déjà en attente de vérification.';
  end if;
  v_ht := round(v_plan.prix_mensuel_ht * p_mois, 2);
  v_tva := setting_num('tva_abonnement_pct');
  insert into subscription_payments (user_id, plan_id, mois, montant_ht, taux_tva, montant_ttc, mode, reference, preuve_path, declare_par)
  values (p_user, p_plan_id, p_mois, v_ht, v_tva, round(v_ht * (1 + v_tva / 100), 2), p_mode,
          nullif(trim(p_reference), ''), nullif(trim(p_preuve_path), ''), v_caller)
  returning * into v_pay;
  return v_pay;
end;
$$;


--
-- Name: request_topup(numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_topup(p_amount numeric, p_mode text, p_reference text DEFAULT NULL::text) RETURNS public.wallet_topups
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me profiles; v_t wallet_topups;
begin
  select * into v_me from profiles where id = auth.uid();
  if not found or v_me.status <> 'valide'
     or v_me.role::text not in ('donneur_ordre', 'transporteur', 'manutentionnaire', 'commissionnaire', 'stockage') then
    raise exception 'Votre compte n''a pas de portefeuille ou n''est pas encore validé.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide.'; end if;
  if p_mode not in ('especes', 'cheque', 'virement', 'ccp', 'baridimob', 'cib') then
    raise exception 'Mode de versement invalide.';
  end if;
  if (select count(*) from wallet_topups where user_id = auth.uid() and status = 'en_attente') >= 5 then
    raise exception 'Trop de demandes de recharge en attente.';
  end if;
  insert into wallet_topups (user_id, amount_ht, mode, reference)
  values (auth.uid(), round(p_amount, 2), p_mode, nullif(trim(p_reference), ''))
  returning * into v_t;
  return v_t;
end;
$$;


--
-- Name: respond_affiliation(bigint, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_affiliation(p_member_id bigint, p_accept boolean) RETURNS public.directory_members
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_row directory_members;
begin
  select * into v_row from directory_members where id = p_member_id for update;
  if not found or v_row.transporteur_id is distinct from auth.uid()
     or v_row.vehicle_id is not null or v_row.chauffeur_id is not null then
    raise exception 'Invitation introuvable.';
  end if;
  if v_row.status <> 'en_attente' then
    raise exception 'Invitation déjà traitée (statut : %).', v_row.status;
  end if;
  update directory_members set status = case when p_accept then 'accepte' else 'refuse' end
   where id = p_member_id returning * into v_row;
  return v_row;
end;
$$;


--
-- Name: save_offer_private_details(bigint, numeric, text, text, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_offer_private_details(p_offer_id bigint, p_poids_total_kg numeric, p_destinataire_nom text, p_destinataire_tel text, p_lignes jsonb, p_contact_nom text DEFAULT NULL::text, p_contact_tel text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_uid   uuid := auth.uid();
  v_nom   text := nullif(btrim(regexp_replace(coalesce(p_destinataire_nom, ''), '\s+', ' ', 'g')), '');
  v_tel   text := nullif(regexp_replace(coalesce(p_destinataire_tel, ''), '[\s.\-()]', '', 'g'), '');
  v_cnom  text := nullif(btrim(regexp_replace(coalesce(p_contact_nom, ''), '\s+', ' ', 'g')), '');
  v_ctel  text := nullif(regexp_replace(coalesce(p_contact_tel, ''), '[\s.\-()]', '', 'g'), '');
  v_n     int;
  v_empty boolean;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '42501';
  end if;

  if not exists (select 1 from public.freight_offers o
                 where o.id = p_offer_id and o.donneur_ordre_id = v_uid) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  if exists (select 1 from public.missions m
             where m.offer_id = p_offer_id
               and m.status::text not in ('creee', 'acceptee_chauffeur', 'en_route_chargement')) then
    raise exception 'Le chargement a commencé : les détails ne sont plus modifiables'
      using errcode = '55000';
  end if;

  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' then
    p_lignes := '[]'::jsonb;
  end if;
  v_n := jsonb_array_length(p_lignes);
  if v_n > 8 then
    raise exception '8 lignes de marchandise maximum' using errcode = '22023';
  end if;

  v_empty := p_poids_total_kg is null and v_nom is null and v_tel is null
             and v_cnom is null and v_ctel is null and v_n = 0;

  delete from public.offer_goods_lines where offer_id = p_offer_id;

  if v_empty then
    delete from public.offer_private_details where offer_id = p_offer_id;
    return;
  end if;

  insert into public.offer_private_details
    (offer_id, poids_total_kg, destinataire_nom, destinataire_tel,
     contact_chargement_nom, contact_chargement_tel)
  values (p_offer_id, p_poids_total_kg, v_nom, v_tel, v_cnom, v_ctel)
  on conflict (offer_id) do update
    set poids_total_kg         = excluded.poids_total_kg,
        destinataire_nom       = excluded.destinataire_nom,
        destinataire_tel       = excluded.destinataire_tel,
        contact_chargement_nom = excluded.contact_chargement_nom,
        contact_chargement_tel = excluded.contact_chargement_tel,
        updated_at             = now();

  insert into public.offer_goods_lines (offer_id, position, designation, unite, quantite)
  select p_offer_id,
         e.ord::smallint,
         btrim(regexp_replace(e.val->>'designation', '\s+', ' ', 'g')),
         btrim(e.val->>'unite'),
         (e.val->>'quantite')::numeric
  from jsonb_array_elements(p_lignes) with ordinality as e(val, ord);
end;
$$;


--
-- Name: search_carriers(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_carriers(p_query text) RETURNS TABLE(carrier_id uuid, nom text, wilaya text, deja_dans_ma_liste boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare q text := trim(coalesce(p_query, '')); v_like text; v_digits text;
begin
  if not can_use_affiliated_carriers(auth.uid()) then
    raise exception 'Votre forfait ne permet pas d''affilier des transporteurs.';
  end if;
  if length(q) < 3 then return; end if;
  v_like := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_digits := regexp_replace(q, '\D', '', 'g');
  return query
  select p.id,
         coalesce(nullif(trim(p.entreprise), ''), nullif(trim(concat_ws(' ', p.prenom, p.full_name)), ''), 'Transporteur'),
         (select w.name from wilayas w where w.code = p.wilaya_code),
         exists (select 1 from directory_members m join private_directories d on d.id = m.directory_id
                  where d.owner_id = auth.uid() and m.transporteur_id = p.id
                    and m.vehicle_id is null and m.chauffeur_id is null and m.status in ('en_attente', 'accepte'))
  from profiles p
  where p.role = 'transporteur' and p.status = 'valide' and coalesce(p.is_active, true) and p.id <> auth.uid()
    and (p.entreprise ilike v_like or p.full_name ilike v_like or p.prenom ilike v_like
         or (length(v_digits) >= 6 and p.phone like '%' || v_digits || '%'))
  order by 2
  limit 10;
end;
$$;


--
-- Name: set_offer_visibility(bigint, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_offer_visibility(p_offer_id bigint, p_visibility text, p_carrier_ids uuid[] DEFAULT '{}'::uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner  uuid;
  v_status offer_status;
begin
  select donneur_ordre_id, status into v_owner, v_status
  from freight_offers where id = p_offer_id for update;

  if v_owner is null then raise exception 'Offre introuvable'; end if;
  if v_owner <> auth.uid() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_visibility not in ('public','restricted') then raise exception 'Visibilité invalide'; end if;
  if v_status <> 'ouverte'::offer_status then
    raise exception 'La visibilité ne peut plus être modifiée (offre non ouverte)';
  end if;

  if p_visibility = 'restricted' and not public.can_use_affiliated_carriers(auth.uid()) then
    raise exception 'Option non incluse dans votre forfait' using errcode = 'NL001';
  end if;

  perform set_config('netlog.visibility_rpc', 'on', true);

  if p_visibility = 'restricted' then
    if coalesce(array_length(p_carrier_ids, 1), 0) = 0 then
      raise exception 'Sélectionnez au moins un transporteur';
    end if;

    if exists (
      select 1 from proposals p
      where p.offer_id = p_offer_id
        and p.status::text not in ('retiree', 'refusee')
        and not (p.transporteur_id = any(p_carrier_ids))
    ) then
      raise exception 'Des transporteurs non sélectionnés ont déjà une proposition active sur cette offre';
    end if;

    delete from freight_offer_recipients
      where offer_id = p_offer_id and not (carrier_id = any(p_carrier_ids));

    insert into freight_offer_recipients(offer_id, carrier_id)
      select p_offer_id, c from unnest(p_carrier_ids) c
      on conflict do nothing;

    update freight_offers set visibility = 'restricted' where id = p_offer_id;
  else
    delete from freight_offer_recipients where offer_id = p_offer_id;
    update freight_offers set visibility = 'public' where id = p_offer_id;
  end if;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: setting_bool(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.setting_bool(p_key text, p_default boolean DEFAULT false) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select (value #>> '{}')::boolean from platform_settings where key = p_key), p_default);
$$;


--
-- Name: setting_num(text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.setting_num(p_key text, p_default numeric DEFAULT 0) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select (value #>> '{}')::numeric from platform_settings where key = p_key), p_default);
$$;


--
-- Name: setting_text(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.setting_text(p_key text, p_default text DEFAULT NULL::text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select value #>> '{}' from platform_settings where key = p_key), p_default);
$$;


--
-- Name: sync_offer_driver_from_mission(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_offer_driver_from_mission() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update freight_offers
  set chauffeur_id = new.chauffeur_id
  where id = new.offer_id and chauffeur_id is distinct from new.chauffeur_id;
  return new;
end;
$$;


--
-- Name: sync_offer_status_from_mission(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_offer_status_from_mission() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_target offer_status;
begin
  v_target := case
    when new.status = 'cloturee'
      or (new.status = 'livree' and new.livraison_confirmee_at is not null)
      then 'livree'::offer_status
    when new.status in ('livree', 'decharge')
      then 'decharge'::offer_status
    when new.status in ('en_route', 'en_transit', 'sur_site_livraison')
      then 'en_cours'::offer_status
    when new.status in ('creee', 'acceptee_chauffeur', 'en_route_chargement', 'sur_site_chargement')
      then 'attribuee'::offer_status
    when new.status = 'annulee'
      then 'annulee'::offer_status
  end;

  if v_target is not null then
    update freight_offers
    set status = v_target
    where id = new.offer_id and status is distinct from v_target;
  end if;

  return new;
end;
$$;


--
-- Name: trg_enforced_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_enforced_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record;
begin
  for r in select user_id from subscriptions loop
    perform enforce_vehicle_quota(r.user_id);
  end loop;
  return new;
end;
$$;


--
-- Name: trg_missions_freeze_ldv(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_missions_freeze_ldv() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.ldv_snapshots (mission_id, payload)
  values (new.id, public._build_ldv_payload(new.id))
  on conflict (mission_id) do nothing;
  return new;
end;
$$;


--
-- Name: trg_missions_stamps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_missions_stamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.status::text is distinct from old.status::text then
    if new.status::text in ('en_transit', 'en_route') and new.chargement_at is null then
      new.chargement_at := now();
    end if;
    if new.status::text in ('decharge', 'livree') and new.dechargement_at is null then
      new.dechargement_at := now();
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: trg_offer_protect_publisher(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_offer_protect_publisher() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (new.publie_par is distinct from old.publie_par or new.publie_par_role is distinct from old.publie_par_role)
     and not (auth.uid() is null or is_admin()) then
    raise exception 'Seul un administrateur peut modifier l''origine de publication d''une offre.';
  end if;
  return new;
end;
$$;


--
-- Name: trg_offer_publisher(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_offer_publisher() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text;
begin
  if auth.uid() is null then
    new.publie_par := coalesce(new.publie_par, new.donneur_ordre_id);
    new.publie_par_role := coalesce(new.publie_par_role, 'donneur');
    return new;
  end if;
  select role::text into v_role from profiles where id = auth.uid();
  new.publie_par := auth.uid();
  new.publie_par_role := case
    when v_role = 'admin' then 'admin'
    when v_role = 'commercial' and new.donneur_ordre_id <> auth.uid() then 'commercial'
    else 'donneur' end;
  return new;
end;
$$;


--
-- Name: trg_plan_limit_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_plan_limit_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record;
begin
  if new.max_camions is distinct from old.max_camions or new.permet_flotte_propre is distinct from old.permet_flotte_propre then
    for r in select user_id from subscriptions where plan_id = new.id loop
      perform enforce_vehicle_quota(r.user_id);
    end loop;
  end if;
  return new;
end;
$$;


--
-- Name: trg_proposal_vehicle_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_proposal_vehicle_check() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.vehicle_id is not null and exists (select 1 from vehicles v where v.id = new.vehicle_id and v.suspendu_abonnement) then
    if tg_op = 'INSERT' then
      raise exception 'Ce camion est désactivé par votre forfait : choisissez un camion actif.';
    elsif new.status = 'acceptee' and old.status is distinct from 'acceptee' then
      raise exception 'Le camion de cette proposition n''est plus actif : la proposition ne peut pas être acceptée.';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: trg_protect_network(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_protect_network() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (new.commercial_id is distinct from old.commercial_id or new.referral_code is distinct from old.referral_code)
     and not (auth.uid() is null or is_admin()) then
    raise exception 'Seul un administrateur peut modifier le rattachement commercial.';
  end if;
  return new;
end;
$$;


--
-- Name: trg_recipient_must_be_affiliate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recipient_must_be_affiliate() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then return new; end if;
  if not exists (
    select 1 from freight_offers o
    join private_directories d on d.owner_id = o.donneur_ordre_id
    join directory_members m on m.directory_id = d.id
    where o.id = new.offer_id and m.transporteur_id = new.carrier_id
      and m.vehicle_id is null and m.chauffeur_id is null and m.status = 'accepte'
  ) then
    raise exception 'Seuls vos transporteurs affiliés (invitation acceptée) peuvent être destinataires d''une offre réservée.';
  end if;
  return new;
end;
$$;


--
-- Name: trg_subscription_check_offer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_subscription_check_offer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin perform assert_subscription(new.donneur_ordre_id); return new; end;
$$;


--
-- Name: trg_subscription_check_proposal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_subscription_check_proposal() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin perform assert_subscription(new.transporteur_id); return new; end;
$$;


--
-- Name: trg_subscription_enforce_vehicles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_subscription_enforce_vehicles() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin perform enforce_vehicle_quota(new.user_id); return new; end;
$$;


--
-- Name: trg_vehicle_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_vehicle_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_priv boolean; v_q record;
begin
  v_priv := auth.uid() is null or is_admin()
            or coalesce(current_setting('netlog.bypass_vehicle_guard', true), 'off') = 'on';
  if tg_op = 'INSERT' then
    if v_priv then return new; end if;
    new.suspendu_abonnement := false;
    select * into v_q from vehicle_quota(new.transporteur_id);
    if v_q.applicable and v_q.actifs >= v_q.limite then
      raise exception 'Limite de camions atteinte pour votre forfait (% camion(s)). Passez à un forfait supérieur pour en ajouter.', v_q.limite;
    end if;
    return new;
  end if;
  if v_priv then return new; end if;
  if new.suspendu_abonnement is distinct from old.suspendu_abonnement then
    raise exception 'Seul NETLOG peut activer ou désactiver un camion.';
  end if;
  if old.suspendu_abonnement then
    raise exception 'Ce camion est désactivé par votre forfait : passez à un forfait supérieur pour le réactiver.';
  end if;
  return new;
end;
$$;


--
-- Name: trg_wallet_check_proposal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_wallet_check_proposal() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform wallet_assert_can_commit(new.transporteur_id, new.prix_propose);
  return new;
end;
$$;


--
-- Name: trg_wallet_release_on_cancel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_wallet_release_on_cancel() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.status = 'annulee' and old.status is distinct from 'annulee' then
    update wallet_reservations set status = 'liberee', settled_at = now()
    where mission_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;


--
-- Name: trg_wallet_welcome_credit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_wallet_welcome_credit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_amount numeric := setting_num('wallet_welcome_amount');
begin
  if new.role = 'transporteur' and new.status = 'valide' and old.status is distinct from 'valide'
     and v_amount > 0 and nullif(trim(new.nif), '') is not null
     and not exists (select 1 from wallet_transactions w where w.user_id = new.id and w.type = 'credit_bienvenue')
     and not exists (select 1 from wallet_transactions w join profiles p on p.id = w.user_id
                     where w.type = 'credit_bienvenue' and p.id <> new.id and p.nif = new.nif) then
    insert into wallet_transactions (user_id, type, amount_ht, note)
    values (new.id, 'credit_bienvenue', v_amount, 'Crédit de bienvenue');
  end if;
  return new;
end;
$$;


--
-- Name: validate_delivery(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_delivery(p_mission_id bigint, p_reserves text DEFAULT NULL::text) RETURNS public.missions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_mission public.missions;
    v_offer public.freight_offers;
    v_caller uuid := auth.uid();
    v_res text := nullif(trim(p_reserves), '');
BEGIN
    SELECT *
    INTO v_mission
    FROM public.missions
    WHERE id = p_mission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission introuvable.';
    END IF;

    SELECT *
    INTO v_offer
    FROM public.freight_offers
    WHERE id = v_mission.offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Offre associée introuvable.';
    END IF;

    IF v_offer.donneur_ordre_id <> v_caller
       AND NOT public.is_admin()
    THEN
        RAISE EXCEPTION
            'Seul le donneur d''ordre peut confirmer la livraison.';
    END IF;

    IF v_mission.status <> 'decharge' THEN
        RAISE EXCEPTION
            'La livraison ne peut être confirmée que depuis le statut decharge. Statut actuel: %',
            v_mission.status;
    END IF;

    perform set_config(
        'netlog.bypass_status_guard',
        'on',
        true
    );

    UPDATE public.missions
    SET
        status = 'livree',
        livraison_confirmee_at = now(),
        reserves_livraison = COALESCE(
            v_res,
            reserves_livraison
        ),
        updated_at = now()
    WHERE id = p_mission_id
    RETURNING *
    INTO v_mission;

    UPDATE public.freight_offers
    SET
        status = 'livree',
        reserves_livraison = COALESCE(
            v_res,
            reserves_livraison
        ),
        updated_at = now()
    WHERE id = v_mission.offer_id;

    RETURN v_mission;
END;
$$;


--
-- Name: validate_mission_driver(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_mission_driver() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.chauffeur_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.chauffeur_id is not distinct from old.chauffeur_id then
    return new;
  end if;
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if not public.is_fleet_driver(new.chauffeur_id, new.transporteur_id) then
    raise exception 'Ce chauffeur ne fait pas partie de la flotte du transporteur de la mission.';
  end if;
  return new;
end;
$$;


--
-- Name: validate_unloading(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_unloading(p_mission_id bigint, p_reserves text DEFAULT NULL::text) RETURNS public.missions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_mission public.missions;
    v_offer public.freight_offers;
    v_caller uuid := auth.uid();
    v_res text := nullif(trim(p_reserves), '');
BEGIN
    SELECT *
    INTO v_mission
    FROM public.missions
    WHERE id = p_mission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission introuvable.';
    END IF;

    SELECT *
    INTO v_offer
    FROM public.freight_offers
    WHERE id = v_mission.offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Offre associée introuvable.';
    END IF;

    IF v_mission.chauffeur_id IS NULL
       OR v_mission.chauffeur_id <> v_caller
    THEN
        RAISE EXCEPTION 'Seul le chauffeur affecté à cette mission peut valider la décharge.';
    END IF;

    IF v_mission.status NOT IN (
        'sur_site_livraison',
        'en_transit'
    ) THEN
        RAISE EXCEPTION
            'Transition vers decharge interdite depuis le statut: %',
            v_mission.status;
    END IF;

    perform set_config(
        'netlog.bypass_status_guard',
        'on',
        true
    );

    UPDATE public.missions
    SET
        status = 'decharge',
        dechargement_at = now(),
        reserves_livraison = COALESCE(
            v_res,
            reserves_livraison
        ),
        updated_at = now()
    WHERE id = p_mission_id
    RETURNING *
    INTO v_mission;

    UPDATE public.freight_offers
    SET
        status = 'decharge',
        reserves_livraison = COALESCE(
            v_res,
            reserves_livraison
        ),
        updated_at = now()
    WHERE id = v_mission.offer_id;

    RETURN v_mission;
END;
$$;


--
-- Name: vehicle_quota(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vehicle_quota(p_user uuid) RETURNS TABLE(limite integer, actifs bigint, total bigint, applicable boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_plan subscription_plans; v_role text; v_limit int; v_app boolean := setting_bool('subscription_enforced');
begin
  select role::text into v_role from profiles where id = p_user;
  if v_app then
    select p.* into v_plan from subscriptions s join subscription_plans p on p.id = s.plan_id
     where s.user_id = p_user and has_active_subscription(p_user);
    v_limit := case when v_plan.id is null then 0
                    when v_role = 'transporteur' or v_plan.permet_flotte_propre then coalesce(v_plan.max_camions, 2147483647)
                    else 0 end;
  else
    v_limit := 2147483647;
  end if;
  return query select v_limit,
    (select count(*) from vehicles v where v.transporteur_id = p_user and not v.suspendu_abonnement),
    (select count(*) from vehicles v where v.transporteur_id = p_user),
    v_app;
end;
$$;


--
-- Name: vehicle_visible_via_directory(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vehicle_visible_via_directory(p_vehicle_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.directory_members dm
    where dm.vehicle_id = p_vehicle_id
      and dm.status = 'accepte'
      and (
        dm.transporteur_id = auth.uid()
        or public.is_directory_owner(dm.directory_id)
      )
  );
$$;


--
-- Name: wallet_assert_can_commit(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wallet_assert_can_commit(p_user uuid, p_price numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_need numeric; v_avail numeric;
begin
  if not setting_bool('wallet_enabled') then return; end if;
  if auth.uid() is null or is_admin() then return; end if;
  v_need := estimate_commission(p_price, p_user);
  v_avail := wallet_available(p_user);
  if v_avail < v_need then
    raise exception 'Solde insuffisant : votre portefeuille ne couvre pas vos engagements (disponible : % DA HT, commission de cette mission : % DA HT). Rechargez votre portefeuille.', v_avail, v_need;
  end if;
end;
$$;


--
-- Name: wallet_available(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wallet_available(p_user uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select wallet_balance(p_user) - wallet_reserved(p_user);
$$;


--
-- Name: wallet_balance(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wallet_balance(p_user uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(amount_ht), 0) from wallet_transactions where user_id = p_user;
$$;


--
-- Name: wallet_reserved(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wallet_reserved(p_user uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(amount_ht), 0) from wallet_reservations where user_id = p_user and status = 'active';
$$;


--
-- Name: billing_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_profiles (
    transporteur_id uuid NOT NULL,
    nis text,
    article_imposition text,
    rib text,
    regime text NOT NULL,
    taux_tva numeric(5,2),
    delai_paiement_defaut integer DEFAULT 0 NOT NULL,
    mentions_legales text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT billing_profiles_delai_paiement_defaut_check CHECK (((delai_paiement_defaut >= 0) AND (delai_paiement_defaut <= 365))),
    CONSTRAINT billing_profiles_regime_check CHECK ((regime = ANY (ARRAY['tva'::text, 'ifu'::text]))),
    CONSTRAINT billing_profiles_taux_tva_check CHECK (((taux_tva IS NULL) OR ((taux_tva >= (0)::numeric) AND (taux_tva <= (100)::numeric)))),
    CONSTRAINT billing_tva_coherent CHECK (((regime = 'ifu'::text) OR (taux_tva IS NOT NULL)))
);


--
-- Name: carrier_associations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_associations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipper_id uuid NOT NULL,
    carrier_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT carrier_associations_check CHECK ((shipper_id <> carrier_id))
);


--
-- Name: commercial_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commercial_earnings (
    id bigint NOT NULL,
    commercial_id uuid NOT NULL,
    source text NOT NULL,
    payment_id bigint,
    mission_id bigint,
    member_id uuid NOT NULL,
    base_ht numeric(14,2) NOT NULL,
    taux_pct numeric(7,4) NOT NULL,
    montant_ht numeric(14,2) NOT NULL,
    statut text DEFAULT 'a_payer'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    scenario text,
    fixe_ht numeric(14,2) DEFAULT 0 NOT NULL,
    montant_theorique_ht numeric(14,2),
    plafonne boolean DEFAULT false NOT NULL,
    special boolean DEFAULT false NOT NULL,
    payout_id bigint,
    CONSTRAINT commercial_earnings_check CHECK (((payment_id IS NOT NULL) <> (mission_id IS NOT NULL))),
    CONSTRAINT commercial_earnings_source_check CHECK ((source = ANY (ARRAY['abonnement'::text, 'commission_transporteur'::text, 'commission_donneur'::text, 'commission_publieur'::text]))),
    CONSTRAINT commercial_earnings_statut_check CHECK ((statut = ANY (ARRAY['a_payer'::text, 'releve'::text, 'paye'::text])))
);


--
-- Name: commercial_earnings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.commercial_earnings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.commercial_earnings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: commercial_payouts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.commercial_payouts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.commercial_payouts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: commercial_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commercial_rates (
    commercial_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    overrides jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: commercial_share_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commercial_share_rules (
    key text NOT NULL,
    label text NOT NULL,
    base text NOT NULL,
    pct numeric(7,4) DEFAULT 0 NOT NULL,
    fixe numeric(14,2) DEFAULT 0 NOT NULL,
    ordre integer DEFAULT 0 NOT NULL,
    CONSTRAINT commercial_share_rules_base_check CHECK ((base = ANY (ARRAY['abonnement'::text, 'commission'::text]))),
    CONSTRAINT commercial_share_rules_fixe_check CHECK ((fixe >= (0)::numeric)),
    CONSTRAINT commercial_share_rules_pct_check CHECK (((pct >= (0)::numeric) AND (pct <= (100)::numeric)))
);


--
-- Name: commission_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_entries (
    id bigint NOT NULL,
    mission_id bigint NOT NULL,
    transporteur_id uuid NOT NULL,
    donneur_ordre_id uuid NOT NULL,
    base_ht numeric(14,2) NOT NULL,
    mode text,
    valeur numeric(14,4),
    montant_ht numeric(14,2) NOT NULL,
    reglement text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    detail jsonb,
    CONSTRAINT commission_entries_reglement_check CHECK ((reglement = ANY (ARRAY['wallet'::text, 'a_facturer'::text])))
);


--
-- Name: commission_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.commission_entries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.commission_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: communes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communes (
    id bigint NOT NULL,
    wilaya_code smallint NOT NULL,
    name text NOT NULL,
    name_ar text
);


--
-- Name: communes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.communes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.communes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: directory_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.directory_members ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.directory_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: freight_offer_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.freight_offer_recipients (
    offer_id bigint NOT NULL,
    carrier_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: freight_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.freight_offers (
    id bigint NOT NULL,
    donneur_ordre_id uuid NOT NULL,
    wilaya_depart smallint NOT NULL,
    commune_depart_id bigint,
    point_repere_depart text,
    latitude_depart numeric(9,6),
    longitude_depart numeric(9,6),
    wilaya_arrivee smallint NOT NULL,
    commune_arrivee_id bigint,
    point_repere_arrivee text,
    latitude_arrivee numeric(9,6),
    longitude_arrivee numeric(9,6),
    description text,
    poids_kg integer,
    type_marchandise text,
    prix_propose numeric(12,2) NOT NULL,
    payment_method public.payment_method DEFAULT 'cash'::public.payment_method NOT NULL,
    status public.offer_status DEFAULT 'ouverte'::public.offer_status NOT NULL,
    date_enlevement_souhaitee date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nombre_voyages integer DEFAULT 1 NOT NULL,
    longueur_exigee_m numeric(5,2),
    type_moyen_exige text,
    contrat_logistique_path text,
    transporteur_id uuid,
    chauffeur_id uuid,
    reserves text,
    reserves_chargement text,
    reserves_livraison text,
    chauffeur_signale_probleme text,
    publie_par uuid,
    publie_par_role text,
    visibility text DEFAULT 'public'::text NOT NULL,
    CONSTRAINT freight_offers_nombre_voyages_check CHECK ((nombre_voyages > 0)),
    CONSTRAINT freight_offers_poids_kg_check CHECK ((poids_kg > 0)),
    CONSTRAINT freight_offers_prix_propose_check CHECK ((prix_propose >= (0)::numeric)),
    CONSTRAINT freight_offers_publie_par_role_check CHECK ((publie_par_role = ANY (ARRAY['donneur'::text, 'commercial'::text, 'admin'::text]))),
    CONSTRAINT freight_offers_visibility_chk CHECK ((visibility = ANY (ARRAY['public'::text, 'restricted'::text])))
);


--
-- Name: COLUMN freight_offers.reserves; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.freight_offers.reserves IS 'DEPRECATED - utiliser mission_reserves';


--
-- Name: COLUMN freight_offers.reserves_chargement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.freight_offers.reserves_chargement IS 'DEPRECATED - utiliser mission_reserves';


--
-- Name: COLUMN freight_offers.reserves_livraison; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.freight_offers.reserves_livraison IS 'DEPRECATED - utiliser mission_reserves';


--
-- Name: freight_offers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.freight_offers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.freight_offers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoice_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_counters (
    transporteur_id uuid NOT NULL,
    annee integer NOT NULL,
    dernier_numero integer DEFAULT 0 NOT NULL
);


--
-- Name: invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_lines (
    id bigint NOT NULL,
    invoice_id bigint NOT NULL,
    mission_id bigint NOT NULL,
    offer_id bigint NOT NULL,
    designation text NOT NULL,
    date_prestation date,
    quantite numeric(10,2) DEFAULT 1 NOT NULL,
    prix_unitaire_ht numeric(14,2) NOT NULL,
    montant_ht numeric(14,2) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT invoice_lines_montant_ht_check CHECK ((montant_ht >= (0)::numeric)),
    CONSTRAINT invoice_lines_prix_unitaire_ht_check CHECK ((prix_unitaire_ht >= (0)::numeric)),
    CONSTRAINT invoice_lines_quantite_check CHECK ((quantite > (0)::numeric))
);


--
-- Name: invoice_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.invoice_lines ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoice_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.invoices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ldv_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ldv_snapshots (
    mission_id bigint NOT NULL,
    payload jsonb NOT NULL,
    frozen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mission_reserves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_reserves (
    id bigint NOT NULL,
    mission_id bigint NOT NULL,
    phase text NOT NULL,
    auteur_role text NOT NULL,
    auteur_id uuid,
    texte text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mission_reserves_auteur_role_check CHECK ((auteur_role = ANY (ARRAY['chauffeur'::text, 'donneur_ordre'::text, 'historique'::text]))),
    CONSTRAINT mission_reserves_phase_check CHECK ((phase = ANY (ARRAY['chargement'::text, 'dechargement'::text]))),
    CONSTRAINT mission_reserves_texte_check CHECK ((((char_length(texte) >= 1) AND (char_length(texte) <= 160)) AND (texte = btrim(texte)) AND (texte !~ '[\r\n\t]'::text)))
);


--
-- Name: mission_reserves_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mission_reserves ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mission_reserves_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: missions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.missions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.missions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: offer_directory_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_directory_targets (
    id bigint NOT NULL,
    offer_id bigint NOT NULL,
    directory_id bigint,
    transporteur_id uuid,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: offer_directory_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.offer_directory_targets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.offer_directory_targets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: offer_goods_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_goods_lines (
    id bigint NOT NULL,
    offer_id bigint NOT NULL,
    "position" smallint NOT NULL,
    designation text NOT NULL,
    unite text NOT NULL,
    quantite numeric(12,2) NOT NULL,
    CONSTRAINT offer_goods_lines_designation_check CHECK (((char_length(designation) >= 2) AND (char_length(designation) <= 60))),
    CONSTRAINT offer_goods_lines_position_check CHECK ((("position" >= 1) AND ("position" <= 8))),
    CONSTRAINT offer_goods_lines_quantite_check CHECK (((quantite > (0)::numeric) AND (quantite <= (1000000)::numeric))),
    CONSTRAINT offer_goods_lines_unite_check CHECK (((char_length(unite) >= 1) AND (char_length(unite) <= 20)))
);


--
-- Name: offer_goods_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.offer_goods_lines ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.offer_goods_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: offer_private_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_private_details (
    offer_id bigint NOT NULL,
    poids_total_kg numeric(10,2),
    destinataire_nom text,
    destinataire_tel text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_chargement_nom text,
    contact_chargement_tel text,
    CONSTRAINT offer_private_details_contact_chargement_nom_check CHECK (((contact_chargement_nom IS NULL) OR ((char_length(contact_chargement_nom) >= 2) AND (char_length(contact_chargement_nom) <= 80)))),
    CONSTRAINT offer_private_details_contact_chargement_tel_check CHECK (((contact_chargement_tel IS NULL) OR (contact_chargement_tel ~ '^(0|\+213)[1-9][0-9]{7,8}$'::text))),
    CONSTRAINT offer_private_details_destinataire_nom_check CHECK (((destinataire_nom IS NULL) OR ((char_length(destinataire_nom) >= 2) AND (char_length(destinataire_nom) <= 80)))),
    CONSTRAINT offer_private_details_destinataire_tel_check CHECK (((destinataire_tel IS NULL) OR (destinataire_tel ~ '^(0|\+213)[1-9][0-9]{7,8}$'::text))),
    CONSTRAINT offer_private_details_poids_total_kg_check CHECK (((poids_total_kg IS NULL) OR ((poids_total_kg > (0)::numeric) AND (poids_total_kg <= (100000)::numeric))))
);


--
-- Name: offer_special_commission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_special_commission (
    offer_id bigint NOT NULL,
    pct numeric(7,4),
    fixe numeric(14,2),
    beneficiaire text NOT NULL,
    note text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT offer_special_commission_beneficiaire_check CHECK ((beneficiaire = ANY (ARRAY['transporteur'::text, 'donneur'::text, 'publieur'::text]))),
    CONSTRAINT offer_special_commission_check CHECK (((pct IS NOT NULL) OR (fixe IS NOT NULL))),
    CONSTRAINT offer_special_commission_fixe_check CHECK (((fixe IS NULL) OR (fixe >= (0)::numeric))),
    CONSTRAINT offer_special_commission_pct_check CHECK (((pct IS NULL) OR ((pct >= (0)::numeric) AND (pct <= (100)::numeric))))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id bigint NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    nif text,
    nrc text,
    adresse text,
    wilaya_code smallint,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.organizations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.organizations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: private_directories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.private_directories (
    id bigint NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: private_directories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.private_directories ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.private_directories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    phone text,
    full_name text NOT NULL,
    role public.user_role DEFAULT 'donneur_ordre'::public.user_role NOT NULL,
    wilaya_code smallint,
    entreprise text,
    nif text,
    transporteur_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    prenom text,
    nrc text,
    adresse text,
    status text DEFAULT 'en_attente'::text NOT NULL,
    abonnement_actif boolean DEFAULT false NOT NULL,
    date_expiration_abonnement date,
    email text,
    organization_id bigint,
    commercial_id uuid,
    referral_code text,
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['en_attente'::text, 'valide'::text, 'suspendu'::text])))
);


--
-- Name: proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposals (
    id bigint NOT NULL,
    offer_id bigint NOT NULL,
    transporteur_id uuid NOT NULL,
    vehicle_id bigint,
    chauffeur_id uuid,
    prix_propose numeric(12,2) NOT NULL,
    message text,
    status public.proposal_status DEFAULT 'en_attente'::public.proposal_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT proposals_prix_propose_check CHECK ((prix_propose >= (0)::numeric))
);


--
-- Name: proposals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.proposals ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.proposals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id bigint NOT NULL,
    offer_id bigint NOT NULL,
    proposal_id bigint,
    montant_ht numeric(12,2) NOT NULL,
    taux_tva numeric(5,2) DEFAULT 19.00 NOT NULL,
    montant_tva numeric(12,2) DEFAULT 0 NOT NULL,
    timbre_fiscal numeric(10,2) DEFAULT 0 NOT NULL,
    montant_ttc numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quotes_montant_ht_check CHECK ((montant_ht >= (0)::numeric))
);


--
-- Name: quotes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.quotes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.quotes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: subscription_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.subscription_payments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.subscription_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id bigint NOT NULL,
    code text NOT NULL,
    nom text NOT NULL,
    description text,
    roles text[] DEFAULT '{}'::text[] NOT NULL,
    prix_mensuel_ht numeric(14,2) DEFAULT 0 NOT NULL,
    max_chauffeurs integer,
    actif boolean DEFAULT true NOT NULL,
    ordre integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    commission_pct numeric(7,4),
    commission_fixe numeric(14,2),
    permet_transporteurs_affilies boolean DEFAULT false NOT NULL,
    max_camions integer,
    max_transporteurs_affilies integer,
    permet_flotte_propre boolean DEFAULT false NOT NULL,
    CONSTRAINT subscription_plans_commission_fixe_check CHECK (((commission_fixe IS NULL) OR (commission_fixe >= (0)::numeric))),
    CONSTRAINT subscription_plans_commission_pct_check CHECK (((commission_pct IS NULL) OR ((commission_pct >= (0)::numeric) AND (commission_pct <= (100)::numeric)))),
    CONSTRAINT subscription_plans_max_camions_check CHECK (((max_camions IS NULL) OR (max_camions >= 0))),
    CONSTRAINT subscription_plans_max_chauffeurs_check CHECK (((max_chauffeurs IS NULL) OR (max_chauffeurs >= 0))),
    CONSTRAINT subscription_plans_max_transporteurs_affilies_check CHECK (((max_transporteurs_affilies IS NULL) OR (max_transporteurs_affilies >= 0))),
    CONSTRAINT subscription_plans_prix_mensuel_ht_check CHECK ((prix_mensuel_ht >= (0)::numeric))
);


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.subscription_plans ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.subscription_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sync_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_events (
    id bigint NOT NULL,
    device_id text NOT NULL,
    chauffeur_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    client_created_at timestamp with time zone NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed boolean DEFAULT false NOT NULL
);


--
-- Name: sync_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sync_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sync_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id bigint NOT NULL,
    transporteur_id uuid NOT NULL,
    type text NOT NULL,
    immatriculation text NOT NULL,
    capacite_kg integer NOT NULL,
    wilaya_base smallint,
    restriction_poids_lourd boolean DEFAULT false NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    suspendu_abonnement boolean DEFAULT false NOT NULL,
    marque text,
    modele text,
    longueur_m numeric(5,2),
    largeur_m numeric(5,2),
    hauteur_m numeric(5,2),
    equipements jsonb DEFAULT '{}'::jsonb NOT NULL,
    assurance_valide_date date,
    controle_technique_date date,
    CONSTRAINT vehicles_capacite_kg_check CHECK ((capacite_kg > 0))
);


--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.vehicles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wallet_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_reservations (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    mission_id bigint NOT NULL,
    amount_ht numeric(14,2) NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    settled_at timestamp with time zone,
    detail jsonb,
    CONSTRAINT wallet_reservations_amount_ht_check CHECK ((amount_ht >= (0)::numeric)),
    CONSTRAINT wallet_reservations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'consommee'::text, 'liberee'::text])))
);


--
-- Name: wallet_reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.wallet_reservations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_reservations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wallet_topups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.wallet_topups ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_topups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.wallet_transactions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wilayas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wilayas (
    code smallint NOT NULL,
    name text NOT NULL,
    name_ar text
);


--
-- Name: billing_profiles billing_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_profiles
    ADD CONSTRAINT billing_profiles_pkey PRIMARY KEY (transporteur_id);


--
-- Name: carrier_associations carrier_associations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_associations
    ADD CONSTRAINT carrier_associations_pkey PRIMARY KEY (id);


--
-- Name: carrier_associations carrier_associations_shipper_id_carrier_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_associations
    ADD CONSTRAINT carrier_associations_shipper_id_carrier_id_key UNIQUE (shipper_id, carrier_id);


--
-- Name: commercial_earnings commercial_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_earnings
    ADD CONSTRAINT commercial_earnings_pkey PRIMARY KEY (id);


--
-- Name: commercial_payouts commercial_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_payouts
    ADD CONSTRAINT commercial_payouts_pkey PRIMARY KEY (id);


--
-- Name: commercial_rates commercial_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_rates
    ADD CONSTRAINT commercial_rates_pkey PRIMARY KEY (commercial_id);


--
-- Name: commercial_share_rules commercial_share_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_share_rules
    ADD CONSTRAINT commercial_share_rules_pkey PRIMARY KEY (key);


--
-- Name: commission_entries commission_entries_mission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_mission_id_key UNIQUE (mission_id);


--
-- Name: commission_entries commission_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_pkey PRIMARY KEY (id);


--
-- Name: communes communes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communes
    ADD CONSTRAINT communes_pkey PRIMARY KEY (id);


--
-- Name: directory_members directory_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directory_members
    ADD CONSTRAINT directory_members_pkey PRIMARY KEY (id);


--
-- Name: freight_offer_recipients freight_offer_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offer_recipients
    ADD CONSTRAINT freight_offer_recipients_pkey PRIMARY KEY (offer_id, carrier_id);


--
-- Name: freight_offers freight_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offers
    ADD CONSTRAINT freight_offers_pkey PRIMARY KEY (id);


--
-- Name: invoice_counters invoice_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_counters
    ADD CONSTRAINT invoice_counters_pkey PRIMARY KEY (transporteur_id, annee);


--
-- Name: invoice_lines invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_transporteur_id_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_transporteur_id_numero_key UNIQUE (transporteur_id, numero);


--
-- Name: ldv_snapshots ldv_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldv_snapshots
    ADD CONSTRAINT ldv_snapshots_pkey PRIMARY KEY (mission_id);


--
-- Name: mission_reserves mission_reserves_mission_id_phase_auteur_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reserves
    ADD CONSTRAINT mission_reserves_mission_id_phase_auteur_role_key UNIQUE (mission_id, phase, auteur_role);


--
-- Name: mission_reserves mission_reserves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reserves
    ADD CONSTRAINT mission_reserves_pkey PRIMARY KEY (id);


--
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- Name: offer_directory_targets offer_directory_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_directory_targets
    ADD CONSTRAINT offer_directory_targets_pkey PRIMARY KEY (id);


--
-- Name: offer_goods_lines offer_goods_lines_offer_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_goods_lines
    ADD CONSTRAINT offer_goods_lines_offer_id_position_key UNIQUE (offer_id, "position");


--
-- Name: offer_goods_lines offer_goods_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_goods_lines
    ADD CONSTRAINT offer_goods_lines_pkey PRIMARY KEY (id);


--
-- Name: offer_private_details offer_private_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_private_details
    ADD CONSTRAINT offer_private_details_pkey PRIMARY KEY (offer_id);


--
-- Name: offer_special_commission offer_special_commission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_special_commission
    ADD CONSTRAINT offer_special_commission_pkey PRIMARY KEY (offer_id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);


--
-- Name: private_directories private_directories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_directories
    ADD CONSTRAINT private_directories_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_offer_id_transporteur_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_offer_id_transporteur_id_key UNIQUE (offer_id, transporteur_id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: subscription_payments subscription_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_code_key UNIQUE (code);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (user_id);


--
-- Name: sync_events sync_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_events
    ADD CONSTRAINT sync_events_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_transporteur_id_immatriculation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_transporteur_id_immatriculation_key UNIQUE (transporteur_id, immatriculation);


--
-- Name: wallet_reservations wallet_reservations_mission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_reservations
    ADD CONSTRAINT wallet_reservations_mission_id_key UNIQUE (mission_id);


--
-- Name: wallet_reservations wallet_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_reservations
    ADD CONSTRAINT wallet_reservations_pkey PRIMARY KEY (id);


--
-- Name: wallet_topups wallet_topups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_topups
    ADD CONSTRAINT wallet_topups_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wilayas wilayas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wilayas
    ADD CONSTRAINT wilayas_pkey PRIMARY KEY (code);


--
-- Name: commercial_earnings_commercial_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commercial_earnings_commercial_idx ON public.commercial_earnings USING btree (commercial_id, statut);


--
-- Name: commercial_earnings_mission_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commercial_earnings_mission_uidx ON public.commercial_earnings USING btree (mission_id, source) WHERE (mission_id IS NOT NULL);


--
-- Name: commercial_earnings_payment_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commercial_earnings_payment_uidx ON public.commercial_earnings USING btree (payment_id) WHERE (payment_id IS NOT NULL);


--
-- Name: directory_members_carrier_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX directory_members_carrier_uidx ON public.directory_members USING btree (directory_id, transporteur_id) WHERE ((vehicle_id IS NULL) AND (chauffeur_id IS NULL));


--
-- Name: idx_carrier_assoc_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_assoc_carrier ON public.carrier_associations USING btree (carrier_id);


--
-- Name: idx_communes_wilaya; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communes_wilaya ON public.communes USING btree (wilaya_code);


--
-- Name: idx_for_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_for_carrier ON public.freight_offer_recipients USING btree (carrier_id);


--
-- Name: idx_offers_chauffeur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_chauffeur ON public.freight_offers USING btree (chauffeur_id);


--
-- Name: idx_offers_donneur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_donneur ON public.freight_offers USING btree (donneur_ordre_id);


--
-- Name: idx_offers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_status ON public.freight_offers USING btree (status);


--
-- Name: idx_offers_transporteur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_transporteur ON public.freight_offers USING btree (transporteur_id);


--
-- Name: idx_offers_wilaya_arrivee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_wilaya_arrivee ON public.freight_offers USING btree (wilaya_arrivee);


--
-- Name: idx_offers_wilaya_depart; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_wilaya_depart ON public.freight_offers USING btree (wilaya_depart);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_profiles_transporteur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_transporteur ON public.profiles USING btree (transporteur_id);


--
-- Name: idx_proposals_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_offer ON public.proposals USING btree (offer_id);


--
-- Name: idx_proposals_transporteur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_transporteur ON public.proposals USING btree (transporteur_id);


--
-- Name: idx_sync_chauffeur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_chauffeur ON public.sync_events USING btree (chauffeur_id);


--
-- Name: idx_sync_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_unprocessed ON public.sync_events USING btree (processed) WHERE (processed = false);


--
-- Name: invoice_lines_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_invoice_idx ON public.invoice_lines USING btree (invoice_id);


--
-- Name: invoice_lines_mission_active_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_lines_mission_active_uidx ON public.invoice_lines USING btree (mission_id) WHERE active;


--
-- Name: profiles_referral_code_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_referral_code_uidx ON public.profiles USING btree (referral_code) WHERE (referral_code IS NOT NULL);


--
-- Name: sub_pay_reference_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sub_pay_reference_uidx ON public.subscription_payments USING btree (mode, lower(reference)) WHERE ((reference IS NOT NULL) AND (statut <> 'refusee'::text));


--
-- Name: wallet_bienvenue_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX wallet_bienvenue_uidx ON public.wallet_transactions USING btree (user_id) WHERE (type = 'credit_bienvenue'::text);


--
-- Name: wallet_debit_mission_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX wallet_debit_mission_uidx ON public.wallet_transactions USING btree (mission_id) WHERE (type = 'debit_commission'::text);


--
-- Name: wallet_res_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_res_user_idx ON public.wallet_reservations USING btree (user_id, status);


--
-- Name: wallet_tx_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_tx_user_idx ON public.wallet_transactions USING btree (user_id);


--
-- Name: missions missions_freeze_ldv; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER missions_freeze_ldv AFTER UPDATE ON public.missions FOR EACH ROW WHEN ((((new.livraison_confirmee_at IS NOT NULL) OR (new.cloturee_at IS NOT NULL)) AND (old.livraison_confirmee_at IS NULL) AND (old.cloturee_at IS NULL))) EXECUTE FUNCTION public.trg_missions_freeze_ldv();


--
-- Name: missions missions_stamps; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER missions_stamps BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.trg_missions_stamps();


--
-- Name: carrier_associations trg_cleanup_recipients; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cleanup_recipients AFTER DELETE ON public.carrier_associations FOR EACH ROW EXECUTE FUNCTION public.cleanup_recipients_on_unassociate();


--
-- Name: platform_settings trg_enforced_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforced_changed AFTER UPDATE ON public.platform_settings FOR EACH ROW WHEN ((new.key = 'subscription_enforced'::text)) EXECUTE FUNCTION public.trg_enforced_changed();


--
-- Name: missions trg_guard_mission_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_mission_status BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.guard_mission_status_transition();


--
-- Name: profiles trg_guard_profile_role_admin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_profile_role_admin BEFORE INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_admin();


--
-- Name: freight_offers trg_guard_visibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_visibility BEFORE UPDATE OF visibility ON public.freight_offers FOR EACH ROW EXECUTE FUNCTION public.guard_visibility_change();


--
-- Name: missions trg_missions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_missions_updated BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: freight_offers trg_offer_protect_publisher; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_offer_protect_publisher BEFORE UPDATE ON public.freight_offers FOR EACH ROW EXECUTE FUNCTION public.trg_offer_protect_publisher();


--
-- Name: freight_offers trg_offer_publisher; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_offer_publisher BEFORE INSERT ON public.freight_offers FOR EACH ROW EXECUTE FUNCTION public.trg_offer_publisher();


--
-- Name: freight_offers trg_offers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_offers_updated BEFORE UPDATE ON public.freight_offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organizations trg_organizations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: subscription_plans trg_plan_limit_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plan_limit_changed AFTER UPDATE OF max_camions, permet_flotte_propre ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.trg_plan_limit_changed();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: proposals trg_proposal_vehicle_check_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_proposal_vehicle_check_ins BEFORE INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.trg_proposal_vehicle_check();


--
-- Name: proposals trg_proposal_vehicle_check_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_proposal_vehicle_check_upd BEFORE UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.trg_proposal_vehicle_check();


--
-- Name: proposals trg_proposals_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: directory_members trg_protect_directory_member_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_directory_member_fields BEFORE UPDATE ON public.directory_members FOR EACH ROW EXECUTE FUNCTION public.protect_directory_member_fields();


--
-- Name: profiles trg_protect_network; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_network BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_protect_network();


--
-- Name: profiles trg_protect_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_status BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_status();


--
-- Name: freight_offer_recipients trg_recipient_associated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recipient_associated BEFORE INSERT ON public.freight_offer_recipients FOR EACH ROW EXECUTE FUNCTION public.enforce_recipient_is_associated();


--
-- Name: freight_offer_recipients trg_recipient_must_be_affiliate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recipient_must_be_affiliate BEFORE INSERT ON public.freight_offer_recipients FOR EACH ROW EXECUTE FUNCTION public.trg_recipient_must_be_affiliate();


--
-- Name: freight_offers trg_subscription_check_offer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subscription_check_offer BEFORE INSERT ON public.freight_offers FOR EACH ROW EXECUTE FUNCTION public.trg_subscription_check_offer();


--
-- Name: proposals trg_subscription_check_proposal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subscription_check_proposal BEFORE INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.trg_subscription_check_proposal();


--
-- Name: subscriptions trg_subscription_enforce_vehicles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subscription_enforce_vehicles AFTER INSERT OR UPDATE OF plan_id, statut ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.trg_subscription_enforce_vehicles();


--
-- Name: missions trg_sync_offer_driver; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_offer_driver AFTER INSERT OR UPDATE OF chauffeur_id ON public.missions FOR EACH ROW EXECUTE FUNCTION public.sync_offer_driver_from_mission();


--
-- Name: missions trg_sync_offer_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_offer_status AFTER UPDATE OF status, livraison_confirmee_at ON public.missions FOR EACH ROW EXECUTE FUNCTION public.sync_offer_status_from_mission();


--
-- Name: missions trg_validate_mission_driver; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_mission_driver BEFORE INSERT OR UPDATE OF chauffeur_id ON public.missions FOR EACH ROW EXECUTE FUNCTION public.validate_mission_driver();


--
-- Name: vehicles trg_vehicle_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vehicle_guard BEFORE INSERT OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.trg_vehicle_guard();


--
-- Name: vehicles trg_vehicles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: proposals trg_wallet_check_proposal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wallet_check_proposal BEFORE INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.trg_wallet_check_proposal();


--
-- Name: missions trg_wallet_release; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wallet_release AFTER UPDATE OF status ON public.missions FOR EACH ROW EXECUTE FUNCTION public.trg_wallet_release_on_cancel();


--
-- Name: profiles trg_wallet_welcome; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wallet_welcome AFTER UPDATE OF status ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_wallet_welcome_credit();


--
-- Name: billing_profiles billing_profiles_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_profiles
    ADD CONSTRAINT billing_profiles_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: carrier_associations carrier_associations_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_associations
    ADD CONSTRAINT carrier_associations_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: carrier_associations carrier_associations_shipper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_associations
    ADD CONSTRAINT carrier_associations_shipper_id_fkey FOREIGN KEY (shipper_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: commercial_earnings commercial_earnings_commercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_earnings
    ADD CONSTRAINT commercial_earnings_commercial_id_fkey FOREIGN KEY (commercial_id) REFERENCES public.profiles(id);


--
-- Name: commercial_earnings commercial_earnings_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_earnings
    ADD CONSTRAINT commercial_earnings_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id);


--
-- Name: commercial_earnings commercial_earnings_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_earnings
    ADD CONSTRAINT commercial_earnings_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id);


--
-- Name: commercial_earnings commercial_earnings_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_earnings
    ADD CONSTRAINT commercial_earnings_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.subscription_payments(id);


--
-- Name: commercial_earnings commercial_earnings_payout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_earnings
    ADD CONSTRAINT commercial_earnings_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.commercial_payouts(id);


--
-- Name: commercial_payouts commercial_payouts_commercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_payouts
    ADD CONSTRAINT commercial_payouts_commercial_id_fkey FOREIGN KEY (commercial_id) REFERENCES public.profiles(id);


--
-- Name: commercial_payouts commercial_payouts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_payouts
    ADD CONSTRAINT commercial_payouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: commercial_rates commercial_rates_commercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_rates
    ADD CONSTRAINT commercial_rates_commercial_id_fkey FOREIGN KEY (commercial_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: commission_entries commission_entries_donneur_ordre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_donneur_ordre_id_fkey FOREIGN KEY (donneur_ordre_id) REFERENCES public.profiles(id);


--
-- Name: commission_entries commission_entries_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id);


--
-- Name: commission_entries commission_entries_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id);


--
-- Name: communes communes_wilaya_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communes
    ADD CONSTRAINT communes_wilaya_code_fkey FOREIGN KEY (wilaya_code) REFERENCES public.wilayas(code);


--
-- Name: directory_members directory_members_chauffeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directory_members
    ADD CONSTRAINT directory_members_chauffeur_id_fkey FOREIGN KEY (chauffeur_id) REFERENCES public.profiles(id);


--
-- Name: directory_members directory_members_directory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directory_members
    ADD CONSTRAINT directory_members_directory_id_fkey FOREIGN KEY (directory_id) REFERENCES public.private_directories(id);


--
-- Name: directory_members directory_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directory_members
    ADD CONSTRAINT directory_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id);


--
-- Name: directory_members directory_members_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directory_members
    ADD CONSTRAINT directory_members_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id);


--
-- Name: directory_members directory_members_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directory_members
    ADD CONSTRAINT directory_members_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: freight_offer_recipients freight_offer_recipients_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offer_recipients
    ADD CONSTRAINT freight_offer_recipients_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: freight_offer_recipients freight_offer_recipients_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offer_recipients
    ADD CONSTRAINT freight_offer_recipients_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.freight_offers(id) ON DELETE CASCADE;


--
-- Name: freight_offers freight_offers_chauffeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offers
    ADD CONSTRAINT freight_offers_chauffeur_id_fkey FOREIGN KEY (chauffeur_id) REFERENCES public.profiles(id);


--
-- Name: freight_offers freight_offers_commune_arrivee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offers
    ADD CONSTRAINT freight_offers_commune_arrivee_id_fkey FOREIGN KEY (commune_arrivee_id) REFERENCES public.communes(id);


--
-- Name: freight_offers freight_offers_commune_depart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offers
    ADD CONSTRAINT freight_offers_commune_depart_id_fkey FOREIGN KEY (commune_depart_id) REFERENCES public.communes(id);


--
-- Name: freight_offers freight_offers_donneur_ordre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offers
    ADD CONSTRAINT freight_offers_donneur_ordre_id_fkey FOREIGN KEY (donneur_ordre_id) REFERENCES public.profiles(id);


--
-- Name: freight_offers freight_offers_publie_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offers
    ADD CONSTRAINT freight_offers_publie_par_fkey FOREIGN KEY (publie_par) REFERENCES public.profiles(id);


--
-- Name: freight_offers freight_offers_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offers
    ADD CONSTRAINT freight_offers_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id);


--
-- Name: freight_offers freight_offers_wilaya_arrivee_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offers
    ADD CONSTRAINT freight_offers_wilaya_arrivee_fkey FOREIGN KEY (wilaya_arrivee) REFERENCES public.wilayas(code);


--
-- Name: freight_offers freight_offers_wilaya_depart_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_offers
    ADD CONSTRAINT freight_offers_wilaya_depart_fkey FOREIGN KEY (wilaya_depart) REFERENCES public.wilayas(code);


--
-- Name: invoice_counters invoice_counters_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_counters
    ADD CONSTRAINT invoice_counters_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: invoice_lines invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_lines invoice_lines_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id);


--
-- Name: invoice_lines invoice_lines_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.freight_offers(id);


--
-- Name: invoices invoices_donneur_ordre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_donneur_ordre_id_fkey FOREIGN KEY (donneur_ordre_id) REFERENCES public.profiles(id);


--
-- Name: invoices invoices_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id);


--
-- Name: ldv_snapshots ldv_snapshots_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldv_snapshots
    ADD CONSTRAINT ldv_snapshots_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_reserves mission_reserves_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reserves
    ADD CONSTRAINT mission_reserves_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: missions missions_chauffeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_chauffeur_id_fkey FOREIGN KEY (chauffeur_id) REFERENCES public.profiles(id);


--
-- Name: missions missions_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.freight_offers(id);


--
-- Name: missions missions_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id);


--
-- Name: missions missions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: offer_directory_targets offer_directory_targets_directory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_directory_targets
    ADD CONSTRAINT offer_directory_targets_directory_id_fkey FOREIGN KEY (directory_id) REFERENCES public.private_directories(id);


--
-- Name: offer_directory_targets offer_directory_targets_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_directory_targets
    ADD CONSTRAINT offer_directory_targets_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.freight_offers(id);


--
-- Name: offer_directory_targets offer_directory_targets_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_directory_targets
    ADD CONSTRAINT offer_directory_targets_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id);


--
-- Name: offer_goods_lines offer_goods_lines_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_goods_lines
    ADD CONSTRAINT offer_goods_lines_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.freight_offers(id) ON DELETE CASCADE;


--
-- Name: offer_private_details offer_private_details_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_private_details
    ADD CONSTRAINT offer_private_details_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.freight_offers(id) ON DELETE CASCADE;


--
-- Name: offer_special_commission offer_special_commission_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_special_commission
    ADD CONSTRAINT offer_special_commission_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.freight_offers(id) ON DELETE CASCADE;


--
-- Name: offer_special_commission offer_special_commission_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_special_commission
    ADD CONSTRAINT offer_special_commission_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: organizations organizations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: organizations organizations_wilaya_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_wilaya_code_fkey FOREIGN KEY (wilaya_code) REFERENCES public.wilayas(code);


--
-- Name: platform_settings platform_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: private_directories private_directories_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_directories
    ADD CONSTRAINT private_directories_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_commercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_commercial_id_fkey FOREIGN KEY (commercial_id) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: profiles profiles_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_wilaya_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_wilaya_code_fkey FOREIGN KEY (wilaya_code) REFERENCES public.wilayas(code);


--
-- Name: proposals proposals_chauffeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_chauffeur_id_fkey FOREIGN KEY (chauffeur_id) REFERENCES public.profiles(id);


--
-- Name: proposals proposals_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.freight_offers(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id);


--
-- Name: proposals proposals_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: quotes quotes_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.freight_offers(id);


--
-- Name: quotes quotes_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id);


--
-- Name: subscription_payments subscription_payments_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id);


--
-- Name: subscription_payments subscription_payments_declare_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_declare_par_fkey FOREIGN KEY (declare_par) REFERENCES public.profiles(id);


--
-- Name: subscription_payments subscription_payments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: subscription_payments subscription_payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: subscriptions subscriptions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: sync_events sync_events_chauffeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_events
    ADD CONSTRAINT sync_events_chauffeur_id_fkey FOREIGN KEY (chauffeur_id) REFERENCES public.profiles(id);


--
-- Name: vehicles vehicles_transporteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_transporteur_id_fkey FOREIGN KEY (transporteur_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_wilaya_base_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_wilaya_base_fkey FOREIGN KEY (wilaya_base) REFERENCES public.wilayas(code);


--
-- Name: wallet_reservations wallet_reservations_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_reservations
    ADD CONSTRAINT wallet_reservations_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id);


--
-- Name: wallet_reservations wallet_reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_reservations
    ADD CONSTRAINT wallet_reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: wallet_topups wallet_topups_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_topups
    ADD CONSTRAINT wallet_topups_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id);


--
-- Name: wallet_topups wallet_topups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_topups
    ADD CONSTRAINT wallet_topups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: wallet_transactions wallet_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: wallet_transactions wallet_transactions_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id);


--
-- Name: wallet_transactions wallet_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: billing_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_profiles billing_profiles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_profiles_insert ON public.billing_profiles FOR INSERT TO authenticated WITH CHECK ((((transporteur_id = auth.uid()) AND (public.current_role_name() = 'transporteur'::public.user_role)) OR public.is_admin()));


--
-- Name: billing_profiles billing_profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_profiles_select ON public.billing_profiles FOR SELECT TO authenticated USING (((transporteur_id = auth.uid()) OR public.is_admin()));


--
-- Name: billing_profiles billing_profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_profiles_update ON public.billing_profiles FOR UPDATE TO authenticated USING (((transporteur_id = auth.uid()) OR public.is_admin())) WITH CHECK (((transporteur_id = auth.uid()) OR public.is_admin()));


--
-- Name: carrier_associations ca_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ca_delete ON public.carrier_associations FOR DELETE USING (((shipper_id = auth.uid()) OR (carrier_id = auth.uid())));


--
-- Name: carrier_associations ca_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ca_select ON public.carrier_associations FOR SELECT USING (((shipper_id = auth.uid()) OR (carrier_id = auth.uid()) OR public.is_admin()));


--
-- Name: carrier_associations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carrier_associations ENABLE ROW LEVEL SECURITY;

--
-- Name: commercial_earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commercial_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: commercial_earnings commercial_earnings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commercial_earnings_select ON public.commercial_earnings FOR SELECT TO authenticated USING (((commercial_id = auth.uid()) OR public.is_admin()));


--
-- Name: commercial_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commercial_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: commercial_payouts commercial_payouts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commercial_payouts_select ON public.commercial_payouts FOR SELECT TO authenticated USING (((commercial_id = auth.uid()) OR public.is_admin()));


--
-- Name: commercial_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commercial_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: commercial_rates commercial_rates_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commercial_rates_admin ON public.commercial_rates TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: commercial_rates commercial_rates_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commercial_rates_own ON public.commercial_rates FOR SELECT TO authenticated USING ((commercial_id = auth.uid()));


--
-- Name: commercial_share_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commercial_share_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: commercial_share_rules commercial_share_rules_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commercial_share_rules_admin ON public.commercial_share_rules TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: commission_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_entries commission_entries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commission_entries_select ON public.commission_entries FOR SELECT TO authenticated USING (((transporteur_id = auth.uid()) OR public.is_admin()));


--
-- Name: communes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;

--
-- Name: communes communes_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY communes_ecriture_admin ON public.communes USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: communes communes_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY communes_lecture_publique ON public.communes FOR SELECT USING (true);


--
-- Name: private_directories dir_select_owner_or_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dir_select_owner_or_member ON public.private_directories FOR SELECT USING (((owner_id = auth.uid()) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.directory_members dm
  WHERE ((dm.directory_id = private_directories.id) AND ((dm.transporteur_id = auth.uid()) OR (dm.chauffeur_id = auth.uid()) OR public.is_vehicle_owner(dm.vehicle_id)))))));


--
-- Name: directory_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.directory_members ENABLE ROW LEVEL SECURITY;

--
-- Name: directory_members dirm_select_owner_or_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dirm_select_owner_or_member ON public.directory_members FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.private_directories d
  WHERE ((d.id = directory_members.directory_id) AND (d.owner_id = auth.uid())))) OR (transporteur_id = auth.uid()) OR (chauffeur_id = auth.uid())));


--
-- Name: freight_offer_recipients for_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY for_select ON public.freight_offer_recipients FOR SELECT USING (((carrier_id = auth.uid()) OR public.is_admin() OR public.is_offer_owner(offer_id)));


--
-- Name: freight_offer_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.freight_offer_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: freight_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.freight_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_lines invoice_lines_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_lines_select ON public.invoice_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.invoices i
  WHERE ((i.id = invoice_lines.invoice_id) AND ((i.transporteur_id = auth.uid()) OR (i.donneur_ordre_id = auth.uid()) OR public.is_admin())))));


--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices invoices_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated USING (((transporteur_id = auth.uid()) OR (donneur_ordre_id = auth.uid()) OR public.is_admin()));


--
-- Name: ldv_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ldv_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_reserves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_reserves ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_reserves mission_reserves_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_reserves_select ON public.mission_reserves FOR SELECT TO authenticated USING (public.is_mission_party(mission_id));


--
-- Name: missions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

--
-- Name: missions missions_insert_validated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY missions_insert_validated ON public.missions FOR INSERT WITH CHECK (((public.is_validated() OR public.is_admin()) AND ((transporteur_id = auth.uid()) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.freight_offers o
  WHERE ((o.id = missions.offer_id) AND (o.donneur_ordre_id = auth.uid())))))));


--
-- Name: missions missions_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY missions_select_participants ON public.missions FOR SELECT USING ((public.is_admin() OR (transporteur_id = auth.uid()) OR (chauffeur_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.freight_offers fo
  WHERE ((fo.id = missions.offer_id) AND (fo.donneur_ordre_id = auth.uid())))) OR public.is_quai_operator_for_offer(offer_id)));


--
-- Name: missions missions_update_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY missions_update_participants ON public.missions FOR UPDATE USING (public.can_update_mission(id)) WITH CHECK (public.can_update_mission(id));


--
-- Name: offer_directory_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_directory_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_goods_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_goods_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_goods_lines offer_goods_lines_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_goods_lines_select ON public.offer_goods_lines FOR SELECT TO authenticated USING (public.can_view_offer_private(offer_id));


--
-- Name: offer_private_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_private_details ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_private_details offer_private_details_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_private_details_select ON public.offer_private_details FOR SELECT TO authenticated USING (public.can_view_offer_private(offer_id));


--
-- Name: offer_special_commission offer_special_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_special_admin ON public.offer_special_commission TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: offer_special_commission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_special_commission ENABLE ROW LEVEL SECURITY;

--
-- Name: freight_offers offers_insert_donneur; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_insert_donneur ON public.freight_offers FOR INSERT WITH CHECK ((((donneur_ordre_id = auth.uid()) AND (public.current_role_name() = ANY (ARRAY['donneur_ordre'::public.user_role, 'commissionnaire'::public.user_role, 'commercial'::public.user_role])) AND (public.is_validated() OR public.is_admin())) OR public.is_admin() OR ((public.current_role_name() = 'commercial'::public.user_role) AND public.is_validated() AND public.is_my_network_donor(donneur_ordre_id))));


--
-- Name: freight_offers offers_select_visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_select_visibility ON public.freight_offers FOR SELECT USING (((donneur_ordre_id = auth.uid()) OR (transporteur_id = auth.uid()) OR (chauffeur_id = auth.uid()) OR public.is_admin() OR ((status = 'ouverte'::public.offer_status) AND (visibility = 'public'::text)) OR ((status = 'ouverte'::public.offer_status) AND (visibility = 'restricted'::text) AND public.is_offer_recipient(id))));


--
-- Name: freight_offers offers_update_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_update_owner_or_admin ON public.freight_offers FOR UPDATE USING (((donneur_ordre_id = auth.uid()) OR public.is_admin())) WITH CHECK (((donneur_ordre_id = auth.uid()) OR public.is_admin()));


--
-- Name: organizations org_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_insert_owner ON public.organizations FOR INSERT WITH CHECK (((owner_id = auth.uid()) AND (public.is_validated() OR public.is_admin())));


--
-- Name: organizations org_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_select_member ON public.organizations FOR SELECT USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.organization_id = organizations.id)))) OR public.is_admin()));


--
-- Name: organizations org_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_update_owner ON public.organizations FOR UPDATE USING (((owner_id = auth.uid()) OR public.is_admin()));


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_plans plans_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_admin ON public.subscription_plans TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: subscription_plans plans_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_select ON public.subscription_plans FOR SELECT TO authenticated USING ((actif OR public.is_admin()));


--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings platform_settings_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_settings_admin ON public.platform_settings TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: private_directories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.private_directories ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles_select_org_operators; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_org_operators ON public.profiles FOR SELECT USING (((id = auth.uid()) OR public.is_admin() OR ((role = 'operateur_quai'::public.user_role) AND (organization_id IS NOT NULL) AND (organization_id = public.my_organization_id()))));


--
-- Name: profiles profiles_select_own_drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own_drivers ON public.profiles FOR SELECT TO authenticated USING ((transporteur_id = auth.uid()));


--
-- Name: profiles profiles_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own_or_admin ON public.profiles FOR SELECT USING (((id = auth.uid()) OR public.is_admin()));


--
-- Name: profiles profiles_update_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own_or_admin ON public.profiles FOR UPDATE USING (((id = auth.uid()) OR public.is_admin())) WITH CHECK (((id = auth.uid()) OR public.is_admin()));


--
-- Name: proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: proposals proposals_insert_transporteur; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_insert_transporteur ON public.proposals FOR INSERT WITH CHECK (((transporteur_id = auth.uid()) AND (public.current_role_name() = 'transporteur'::public.user_role) AND (public.is_validated() OR public.is_admin()) AND (EXISTS ( SELECT 1
   FROM public.freight_offers o
  WHERE ((o.id = proposals.offer_id) AND (o.status = 'ouverte'::public.offer_status))))));


--
-- Name: proposals proposals_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_select_participants ON public.proposals FOR SELECT USING (((transporteur_id = auth.uid()) OR (chauffeur_id = auth.uid()) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.freight_offers o
  WHERE ((o.id = proposals.offer_id) AND ((o.donneur_ordre_id = auth.uid()) OR (o.transporteur_id = auth.uid())))))));


--
-- Name: proposals proposals_update_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposals_update_participants ON public.proposals FOR UPDATE USING (((transporteur_id = auth.uid()) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.freight_offers o
  WHERE ((o.id = proposals.offer_id) AND (o.donneur_ordre_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR ((EXISTS ( SELECT 1
   FROM public.freight_offers o
  WHERE ((o.id = proposals.offer_id) AND (o.donneur_ordre_id = auth.uid())))) AND (status = ANY (ARRAY['acceptee'::public.proposal_status, 'refusee'::public.proposal_status]))) OR ((transporteur_id = auth.uid()) AND (status = 'retiree'::public.proposal_status))));


--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes quotes_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_delete_admin ON public.quotes FOR DELETE USING (public.is_admin());


--
-- Name: quotes quotes_insert_transporteur; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_insert_transporteur ON public.quotes FOR INSERT WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = quotes.proposal_id) AND (p.transporteur_id = auth.uid()))))));


--
-- Name: quotes quotes_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_select_participants ON public.quotes FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.freight_offers o
  WHERE ((o.id = quotes.offer_id) AND (o.donneur_ordre_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = quotes.proposal_id) AND (p.transporteur_id = auth.uid()))))));


--
-- Name: quotes quotes_update_transporteur; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_update_transporteur ON public.quotes FOR UPDATE USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = quotes.proposal_id) AND (p.transporteur_id = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = quotes.proposal_id) AND (p.transporteur_id = auth.uid()))))));


--
-- Name: subscription_payments sub_payments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_payments_select ON public.subscription_payments FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (declare_par = auth.uid()) OR public.is_admin() OR public.is_my_network_member(user_id)));


--
-- Name: subscription_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions subscriptions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin() OR public.is_my_network_member(user_id)));


--
-- Name: sync_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;

--
-- Name: sync_events sync_insert_own_chauffeur; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sync_insert_own_chauffeur ON public.sync_events FOR INSERT WITH CHECK (((chauffeur_id = auth.uid()) AND (public.current_role_name() = 'chauffeur'::public.user_role)));


--
-- Name: sync_events sync_select_own_or_transporteur_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sync_select_own_or_transporteur_or_admin ON public.sync_events FOR SELECT USING (((chauffeur_id = auth.uid()) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = sync_events.chauffeur_id) AND (p.transporteur_id = auth.uid()))))));


--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicles vehicles_delete_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_delete_owner_or_admin ON public.vehicles FOR DELETE USING (((transporteur_id = auth.uid()) OR public.is_admin()));


--
-- Name: vehicles vehicles_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_insert_owner ON public.vehicles FOR INSERT WITH CHECK (((transporteur_id = auth.uid()) AND (public.current_role_name() = ANY (ARRAY['transporteur'::public.user_role, 'donneur_ordre'::public.user_role, 'commissionnaire'::public.user_role])) AND (public.is_validated() OR public.is_admin())));


--
-- Name: vehicles vehicles_select_owner_or_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_select_owner_or_admin_only ON public.vehicles FOR SELECT USING (((transporteur_id = auth.uid()) OR public.is_admin()));


--
-- Name: vehicles vehicles_update_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_update_owner_or_admin ON public.vehicles FOR UPDATE USING (((transporteur_id = auth.uid()) OR public.is_admin())) WITH CHECK (((transporteur_id = auth.uid()) OR public.is_admin()));


--
-- Name: wallet_reservations wallet_res_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_res_select ON public.wallet_reservations FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: wallet_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_topups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_topups wallet_topups_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_topups_select ON public.wallet_topups FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: wallet_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_transactions wallet_tx_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_tx_select ON public.wallet_transactions FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: wilayas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wilayas ENABLE ROW LEVEL SECURITY;

--
-- Name: wilayas wilayas_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wilayas_ecriture_admin ON public.wilayas USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: wilayas wilayas_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wilayas_lecture_publique ON public.wilayas FOR SELECT USING (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION _build_ldv_payload(p_mission_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._build_ldv_payload(p_mission_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public._build_ldv_payload(p_mission_id bigint) TO service_role;


--
-- Name: FUNCTION _person_name(j jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._person_name(j jsonb) TO anon;
GRANT ALL ON FUNCTION public._person_name(j jsonb) TO authenticated;
GRANT ALL ON FUNCTION public._person_name(j jsonb) TO service_role;


--
-- Name: FUNCTION _pick(j jsonb, keys text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._pick(j jsonb, keys text[]) TO anon;
GRANT ALL ON FUNCTION public._pick(j jsonb, keys text[]) TO authenticated;
GRANT ALL ON FUNCTION public._pick(j jsonb, keys text[]) TO service_role;


--
-- Name: FUNCTION _wilaya_name(p_code integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._wilaya_name(p_code integer) TO anon;
GRANT ALL ON FUNCTION public._wilaya_name(p_code integer) TO authenticated;
GRANT ALL ON FUNCTION public._wilaya_name(p_code integer) TO service_role;


--
-- Name: FUNCTION accept_proposal(p_offer_id bigint, p_proposal_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_proposal(p_offer_id bigint, p_proposal_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_proposal(p_offer_id bigint, p_proposal_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.accept_proposal(p_offer_id bigint, p_proposal_id bigint) TO service_role;


--
-- Name: TABLE subscription_payments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscription_payments TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscription_payments TO authenticated;
GRANT ALL ON TABLE public.subscription_payments TO service_role;


--
-- Name: FUNCTION activate_subscription_payment(p_payment_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.activate_subscription_payment(p_payment_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.activate_subscription_payment(p_payment_id bigint) TO service_role;


--
-- Name: FUNCTION add_carrier_by_phone(p_phone text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_carrier_by_phone(p_phone text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_carrier_by_phone(p_phone text) TO anon;
GRANT ALL ON FUNCTION public.add_carrier_by_phone(p_phone text) TO authenticated;
GRANT ALL ON FUNCTION public.add_carrier_by_phone(p_phone text) TO service_role;


--
-- Name: FUNCTION add_mission_reserve(p_mission_id bigint, p_phase text, p_texte text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_mission_reserve(p_mission_id bigint, p_phase text, p_texte text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_mission_reserve(p_mission_id bigint, p_phase text, p_texte text) TO service_role;
GRANT ALL ON FUNCTION public.add_mission_reserve(p_mission_id bigint, p_phase text, p_texte text) TO authenticated;


--
-- Name: TABLE commercial_payouts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.commercial_payouts TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.commercial_payouts TO authenticated;
GRANT ALL ON TABLE public.commercial_payouts TO service_role;


--
-- Name: FUNCTION admin_pay_commercial(p_commercial uuid, p_until date, p_reference text, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_pay_commercial(p_commercial uuid, p_until date, p_reference text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_pay_commercial(p_commercial uuid, p_until date, p_reference text, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_pay_commercial(p_commercial uuid, p_until date, p_reference text, p_note text) TO service_role;


--
-- Name: FUNCTION admin_revenue(p_from date, p_to date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_revenue(p_from date, p_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_revenue(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.admin_revenue(p_from date, p_to date) TO service_role;


--
-- Name: TABLE wallet_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.wallet_transactions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.wallet_transactions TO authenticated;
GRANT ALL ON TABLE public.wallet_transactions TO service_role;


--
-- Name: FUNCTION admin_wallet_adjust(p_user uuid, p_amount numeric, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_wallet_adjust(p_user uuid, p_amount numeric, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_wallet_adjust(p_user uuid, p_amount numeric, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_wallet_adjust(p_user uuid, p_amount numeric, p_note text) TO service_role;


--
-- Name: FUNCTION affiliate_limit(p_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.affiliate_limit(p_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.affiliate_limit(p_uid uuid) TO service_role;


--
-- Name: FUNCTION assert_subscription(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assert_subscription(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assert_subscription(p_user uuid) TO service_role;


--
-- Name: TABLE missions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.missions TO anon;
GRANT ALL ON TABLE public.missions TO authenticated;
GRANT ALL ON TABLE public.missions TO service_role;


--
-- Name: FUNCTION assign_driver(p_mission_id bigint, p_driver_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_driver(p_mission_id bigint, p_driver_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_driver(p_mission_id bigint, p_driver_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.assign_driver(p_mission_id bigint, p_driver_id uuid) TO service_role;


--
-- Name: FUNCTION can_see_vehicle(v_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_see_vehicle(v_id bigint) TO anon;
GRANT ALL ON FUNCTION public.can_see_vehicle(v_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.can_see_vehicle(v_id bigint) TO service_role;


--
-- Name: FUNCTION can_update_mission(p_mission_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_update_mission(p_mission_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_update_mission(p_mission_id bigint) TO anon;
GRANT ALL ON FUNCTION public.can_update_mission(p_mission_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.can_update_mission(p_mission_id bigint) TO service_role;


--
-- Name: FUNCTION can_use_affiliated_carriers(p_uid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_use_affiliated_carriers(p_uid uuid) TO anon;
GRANT ALL ON FUNCTION public.can_use_affiliated_carriers(p_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_use_affiliated_carriers(p_uid uuid) TO service_role;


--
-- Name: FUNCTION can_use_own_fleet(p_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_use_own_fleet(p_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_use_own_fleet(p_uid uuid) TO service_role;


--
-- Name: FUNCTION can_view_offer_private(p_offer_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_view_offer_private(p_offer_id bigint) TO anon;
GRANT ALL ON FUNCTION public.can_view_offer_private(p_offer_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_offer_private(p_offer_id bigint) TO service_role;


--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.invoices TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;


--
-- Name: FUNCTION cancel_invoice(p_invoice_id bigint, p_motif text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_invoice(p_invoice_id bigint, p_motif text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_invoice(p_invoice_id bigint, p_motif text) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_invoice(p_invoice_id bigint, p_motif text) TO service_role;


--
-- Name: FUNCTION cleanup_recipients_on_unassociate(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_recipients_on_unassociate() TO anon;
GRANT ALL ON FUNCTION public.cleanup_recipients_on_unassociate() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_recipients_on_unassociate() TO service_role;


--
-- Name: FUNCTION commercial_share(p_commercial uuid, p_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.commercial_share(p_commercial uuid, p_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.commercial_share(p_commercial uuid, p_key text) TO service_role;


--
-- Name: FUNCTION commission_rates(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.commission_rates(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.commission_rates(p_user uuid) TO service_role;


--
-- Name: FUNCTION confirm_delivery(p_mission_id bigint, p_reserves text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.confirm_delivery(p_mission_id bigint, p_reserves text) TO anon;
GRANT ALL ON FUNCTION public.confirm_delivery(p_mission_id bigint, p_reserves text) TO authenticated;
GRANT ALL ON FUNCTION public.confirm_delivery(p_mission_id bigint, p_reserves text) TO service_role;


--
-- Name: FUNCTION create_invoice(p_mission_ids bigint[], p_delai_paiement integer, p_mode_reglement text, p_timbre numeric, p_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_invoice(p_mission_ids bigint[], p_delai_paiement integer, p_mode_reglement text, p_timbre numeric, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_invoice(p_mission_ids bigint[], p_delai_paiement integer, p_mode_reglement text, p_timbre numeric, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.create_invoice(p_mission_ids bigint[], p_delai_paiement integer, p_mode_reglement text, p_timbre numeric, p_notes text) TO service_role;


--
-- Name: FUNCTION current_role_name(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_role_name() TO anon;
GRANT ALL ON FUNCTION public.current_role_name() TO authenticated;
GRANT ALL ON FUNCTION public.current_role_name() TO service_role;


--
-- Name: FUNCTION decide_subscription_payment(p_payment_id bigint, p_accept boolean, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decide_subscription_payment(p_payment_id bigint, p_accept boolean, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decide_subscription_payment(p_payment_id bigint, p_accept boolean, p_note text) TO service_role;
GRANT ALL ON FUNCTION public.decide_subscription_payment(p_payment_id bigint, p_accept boolean, p_note text) TO authenticated;


--
-- Name: TABLE wallet_topups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.wallet_topups TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.wallet_topups TO authenticated;
GRANT ALL ON TABLE public.wallet_topups TO service_role;


--
-- Name: FUNCTION decide_topup(p_topup_id bigint, p_accept boolean, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decide_topup(p_topup_id bigint, p_accept boolean, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decide_topup(p_topup_id bigint, p_accept boolean, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.decide_topup(p_topup_id bigint, p_accept boolean, p_note text) TO service_role;


--
-- Name: FUNCTION driver_quota(p_carrier uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.driver_quota(p_carrier uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.driver_quota(p_carrier uuid) TO service_role;


--
-- Name: FUNCTION enforce_recipient_is_associated(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_recipient_is_associated() TO anon;
GRANT ALL ON FUNCTION public.enforce_recipient_is_associated() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_recipient_is_associated() TO service_role;


--
-- Name: FUNCTION enforce_vehicle_quota(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_vehicle_quota(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_vehicle_quota(p_user uuid) TO service_role;


--
-- Name: FUNCTION ensure_my_directory(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ensure_my_directory() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ensure_my_directory() TO authenticated;
GRANT ALL ON FUNCTION public.ensure_my_directory() TO service_role;


--
-- Name: FUNCTION estimate_commission(p_price numeric, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.estimate_commission(p_price numeric, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.estimate_commission(p_price numeric, p_user uuid) TO service_role;


--
-- Name: FUNCTION get_counterparties(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_counterparties() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_counterparties() TO authenticated;
GRANT ALL ON FUNCTION public.get_counterparties() TO service_role;


--
-- Name: FUNCTION get_ldv_payload(p_mission_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_ldv_payload(p_mission_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_ldv_payload(p_mission_id bigint) TO service_role;
GRANT ALL ON FUNCTION public.get_ldv_payload(p_mission_id bigint) TO authenticated;


--
-- Name: FUNCTION get_my_mission_details(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_mission_details() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_mission_details() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_mission_details() TO service_role;


--
-- Name: FUNCTION get_payment_instructions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_payment_instructions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_payment_instructions() TO authenticated;
GRANT ALL ON FUNCTION public.get_payment_instructions() TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscriptions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: FUNCTION grant_free_subscription(p_user uuid, p_plan_id bigint, p_mois integer, p_validate boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.grant_free_subscription(p_user uuid, p_plan_id bigint, p_mois integer, p_validate boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.grant_free_subscription(p_user uuid, p_plan_id bigint, p_mois integer, p_validate boolean) TO service_role;
GRANT ALL ON FUNCTION public.grant_free_subscription(p_user uuid, p_plan_id bigint, p_mois integer, p_validate boolean) TO authenticated;


--
-- Name: FUNCTION guard_mission_status_transition(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_mission_status_transition() TO anon;
GRANT ALL ON FUNCTION public.guard_mission_status_transition() TO authenticated;
GRANT ALL ON FUNCTION public.guard_mission_status_transition() TO service_role;


--
-- Name: FUNCTION guard_profile_role_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_profile_role_admin() TO anon;
GRANT ALL ON FUNCTION public.guard_profile_role_admin() TO authenticated;
GRANT ALL ON FUNCTION public.guard_profile_role_admin() TO service_role;


--
-- Name: FUNCTION guard_visibility_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_visibility_change() TO anon;
GRANT ALL ON FUNCTION public.guard_visibility_change() TO authenticated;
GRANT ALL ON FUNCTION public.guard_visibility_change() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_active_subscription(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_active_subscription(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_active_subscription(p_user uuid) TO service_role;


--
-- Name: TABLE directory_members; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.directory_members TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.directory_members TO authenticated;
GRANT ALL ON TABLE public.directory_members TO service_role;


--
-- Name: FUNCTION invite_carrier(p_carrier uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.invite_carrier(p_carrier uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.invite_carrier(p_carrier uuid) TO authenticated;
GRANT ALL ON FUNCTION public.invite_carrier(p_carrier uuid) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_carrier(p_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_carrier(p_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_carrier(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_carrier(p_id uuid) TO service_role;


--
-- Name: FUNCTION is_directory_owner(p_directory_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_directory_owner(p_directory_id bigint) TO anon;
GRANT ALL ON FUNCTION public.is_directory_owner(p_directory_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.is_directory_owner(p_directory_id bigint) TO service_role;


--
-- Name: FUNCTION is_fleet_driver(p_driver uuid, p_carrier uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_fleet_driver(p_driver uuid, p_carrier uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_fleet_driver(p_driver uuid, p_carrier uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_fleet_driver(p_driver uuid, p_carrier uuid) TO service_role;


--
-- Name: FUNCTION is_mission_party(p_mission_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_mission_party(p_mission_id bigint) TO anon;
GRANT ALL ON FUNCTION public.is_mission_party(p_mission_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.is_mission_party(p_mission_id bigint) TO service_role;


--
-- Name: FUNCTION is_my_network_donor(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_my_network_donor(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_my_network_donor(p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_my_network_donor(p_user uuid) TO service_role;


--
-- Name: FUNCTION is_my_network_member(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_my_network_member(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_my_network_member(p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_my_network_member(p_user uuid) TO service_role;


--
-- Name: FUNCTION is_offer_owner(p_offer_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_offer_owner(p_offer_id bigint) TO anon;
GRANT ALL ON FUNCTION public.is_offer_owner(p_offer_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.is_offer_owner(p_offer_id bigint) TO service_role;


--
-- Name: FUNCTION is_offer_recipient(p_offer_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_offer_recipient(p_offer_id bigint) TO anon;
GRANT ALL ON FUNCTION public.is_offer_recipient(p_offer_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.is_offer_recipient(p_offer_id bigint) TO service_role;


--
-- Name: FUNCTION is_quai_operator_for_offer(p_offer_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_quai_operator_for_offer(p_offer_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_quai_operator_for_offer(p_offer_id bigint) TO anon;
GRANT ALL ON FUNCTION public.is_quai_operator_for_offer(p_offer_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.is_quai_operator_for_offer(p_offer_id bigint) TO service_role;


--
-- Name: FUNCTION is_validated(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_validated() TO anon;
GRANT ALL ON FUNCTION public.is_validated() TO authenticated;
GRANT ALL ON FUNCTION public.is_validated() TO service_role;


--
-- Name: FUNCTION is_vehicle_owner(p_vehicle_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_vehicle_owner(p_vehicle_id bigint) TO anon;
GRANT ALL ON FUNCTION public.is_vehicle_owner(p_vehicle_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.is_vehicle_owner(p_vehicle_id bigint) TO service_role;


--
-- Name: FUNCTION list_my_carriers(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.list_my_carriers() FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_my_carriers() TO anon;
GRANT ALL ON FUNCTION public.list_my_carriers() TO authenticated;
GRANT ALL ON FUNCTION public.list_my_carriers() TO service_role;


--
-- Name: FUNCTION mark_invoice_paid(p_invoice_id bigint, p_mode text, p_reference text, p_paid_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_invoice_paid(p_invoice_id bigint, p_mode text, p_reference text, p_paid_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_invoice_paid(p_invoice_id bigint, p_mode text, p_reference text, p_paid_on date) TO authenticated;
GRANT ALL ON FUNCTION public.mark_invoice_paid(p_invoice_id bigint, p_mode text, p_reference text, p_paid_on date) TO service_role;


--
-- Name: FUNCTION my_affiliate_quota(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_affiliate_quota() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_affiliate_quota() TO authenticated;
GRANT ALL ON FUNCTION public.my_affiliate_quota() TO service_role;


--
-- Name: FUNCTION my_affiliates(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_affiliates() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_affiliates() TO authenticated;
GRANT ALL ON FUNCTION public.my_affiliates() TO service_role;


--
-- Name: FUNCTION my_affiliations(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_affiliations() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_affiliations() TO authenticated;
GRANT ALL ON FUNCTION public.my_affiliations() TO service_role;


--
-- Name: FUNCTION my_can_use_affiliated_carriers(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_can_use_affiliated_carriers() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_can_use_affiliated_carriers() TO anon;
GRANT ALL ON FUNCTION public.my_can_use_affiliated_carriers() TO authenticated;
GRANT ALL ON FUNCTION public.my_can_use_affiliated_carriers() TO service_role;


--
-- Name: FUNCTION my_earnings(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_earnings(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_earnings(p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.my_earnings(p_limit integer) TO service_role;


--
-- Name: FUNCTION my_fleet_access(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_fleet_access() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_fleet_access() TO authenticated;
GRANT ALL ON FUNCTION public.my_fleet_access() TO service_role;


--
-- Name: FUNCTION my_network(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_network() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_network() TO authenticated;
GRANT ALL ON FUNCTION public.my_network() TO service_role;


--
-- Name: FUNCTION my_organization_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_organization_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_organization_id() TO anon;
GRANT ALL ON FUNCTION public.my_organization_id() TO authenticated;
GRANT ALL ON FUNCTION public.my_organization_id() TO service_role;


--
-- Name: FUNCTION my_subscription(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_subscription() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_subscription() TO service_role;
GRANT ALL ON FUNCTION public.my_subscription() TO authenticated;


--
-- Name: FUNCTION my_vehicle_quota(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_vehicle_quota() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_vehicle_quota() TO service_role;
GRANT ALL ON FUNCTION public.my_vehicle_quota() TO authenticated;


--
-- Name: FUNCTION my_wallet(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_wallet() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_wallet() TO authenticated;
GRANT ALL ON FUNCTION public.my_wallet() TO service_role;


--
-- Name: FUNCTION my_wallet_for_subscription(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_wallet_for_subscription() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_wallet_for_subscription() TO service_role;
GRANT ALL ON FUNCTION public.my_wallet_for_subscription() TO authenticated;


--
-- Name: FUNCTION pay_subscription_from_wallet(p_plan_id bigint, p_mois integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pay_subscription_from_wallet(p_plan_id bigint, p_mois integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pay_subscription_from_wallet(p_plan_id bigint, p_mois integer) TO service_role;
GRANT ALL ON FUNCTION public.pay_subscription_from_wallet(p_plan_id bigint, p_mois integer) TO authenticated;


--
-- Name: FUNCTION protect_directory_member_fields(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.protect_directory_member_fields() TO anon;
GRANT ALL ON FUNCTION public.protect_directory_member_fields() TO authenticated;
GRANT ALL ON FUNCTION public.protect_directory_member_fields() TO service_role;


--
-- Name: FUNCTION protect_profile_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.protect_profile_status() TO anon;
GRANT ALL ON FUNCTION public.protect_profile_status() TO authenticated;
GRANT ALL ON FUNCTION public.protect_profile_status() TO service_role;


--
-- Name: FUNCTION record_commission(p_mission_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_commission(p_mission_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_commission(p_mission_id bigint) TO service_role;


--
-- Name: FUNCTION remove_affiliation(p_member_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_affiliation(p_member_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_affiliation(p_member_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.remove_affiliation(p_member_id bigint) TO service_role;


--
-- Name: FUNCTION request_subscription_payment(p_user uuid, p_plan_id bigint, p_mois integer, p_mode text, p_reference text, p_preuve_path text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.request_subscription_payment(p_user uuid, p_plan_id bigint, p_mois integer, p_mode text, p_reference text, p_preuve_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.request_subscription_payment(p_user uuid, p_plan_id bigint, p_mois integer, p_mode text, p_reference text, p_preuve_path text) TO service_role;
GRANT ALL ON FUNCTION public.request_subscription_payment(p_user uuid, p_plan_id bigint, p_mois integer, p_mode text, p_reference text, p_preuve_path text) TO authenticated;


--
-- Name: FUNCTION request_topup(p_amount numeric, p_mode text, p_reference text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.request_topup(p_amount numeric, p_mode text, p_reference text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.request_topup(p_amount numeric, p_mode text, p_reference text) TO authenticated;
GRANT ALL ON FUNCTION public.request_topup(p_amount numeric, p_mode text, p_reference text) TO service_role;


--
-- Name: FUNCTION respond_affiliation(p_member_id bigint, p_accept boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.respond_affiliation(p_member_id bigint, p_accept boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.respond_affiliation(p_member_id bigint, p_accept boolean) TO authenticated;
GRANT ALL ON FUNCTION public.respond_affiliation(p_member_id bigint, p_accept boolean) TO service_role;


--
-- Name: FUNCTION save_offer_private_details(p_offer_id bigint, p_poids_total_kg numeric, p_destinataire_nom text, p_destinataire_tel text, p_lignes jsonb, p_contact_nom text, p_contact_tel text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_offer_private_details(p_offer_id bigint, p_poids_total_kg numeric, p_destinataire_nom text, p_destinataire_tel text, p_lignes jsonb, p_contact_nom text, p_contact_tel text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_offer_private_details(p_offer_id bigint, p_poids_total_kg numeric, p_destinataire_nom text, p_destinataire_tel text, p_lignes jsonb, p_contact_nom text, p_contact_tel text) TO service_role;
GRANT ALL ON FUNCTION public.save_offer_private_details(p_offer_id bigint, p_poids_total_kg numeric, p_destinataire_nom text, p_destinataire_tel text, p_lignes jsonb, p_contact_nom text, p_contact_tel text) TO authenticated;


--
-- Name: FUNCTION search_carriers(p_query text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_carriers(p_query text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_carriers(p_query text) TO authenticated;
GRANT ALL ON FUNCTION public.search_carriers(p_query text) TO service_role;


--
-- Name: FUNCTION set_offer_visibility(p_offer_id bigint, p_visibility text, p_carrier_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_offer_visibility(p_offer_id bigint, p_visibility text, p_carrier_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_offer_visibility(p_offer_id bigint, p_visibility text, p_carrier_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.set_offer_visibility(p_offer_id bigint, p_visibility text, p_carrier_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.set_offer_visibility(p_offer_id bigint, p_visibility text, p_carrier_ids uuid[]) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION setting_bool(p_key text, p_default boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.setting_bool(p_key text, p_default boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.setting_bool(p_key text, p_default boolean) TO service_role;


--
-- Name: FUNCTION setting_num(p_key text, p_default numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.setting_num(p_key text, p_default numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.setting_num(p_key text, p_default numeric) TO service_role;


--
-- Name: FUNCTION setting_text(p_key text, p_default text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.setting_text(p_key text, p_default text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.setting_text(p_key text, p_default text) TO service_role;


--
-- Name: FUNCTION sync_offer_driver_from_mission(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_offer_driver_from_mission() TO anon;
GRANT ALL ON FUNCTION public.sync_offer_driver_from_mission() TO authenticated;
GRANT ALL ON FUNCTION public.sync_offer_driver_from_mission() TO service_role;


--
-- Name: FUNCTION sync_offer_status_from_mission(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_offer_status_from_mission() TO anon;
GRANT ALL ON FUNCTION public.sync_offer_status_from_mission() TO authenticated;
GRANT ALL ON FUNCTION public.sync_offer_status_from_mission() TO service_role;


--
-- Name: FUNCTION trg_enforced_changed(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_enforced_changed() TO anon;
GRANT ALL ON FUNCTION public.trg_enforced_changed() TO authenticated;
GRANT ALL ON FUNCTION public.trg_enforced_changed() TO service_role;


--
-- Name: FUNCTION trg_missions_freeze_ldv(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_missions_freeze_ldv() TO anon;
GRANT ALL ON FUNCTION public.trg_missions_freeze_ldv() TO authenticated;
GRANT ALL ON FUNCTION public.trg_missions_freeze_ldv() TO service_role;


--
-- Name: FUNCTION trg_missions_stamps(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_missions_stamps() TO anon;
GRANT ALL ON FUNCTION public.trg_missions_stamps() TO authenticated;
GRANT ALL ON FUNCTION public.trg_missions_stamps() TO service_role;


--
-- Name: FUNCTION trg_offer_protect_publisher(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_offer_protect_publisher() TO anon;
GRANT ALL ON FUNCTION public.trg_offer_protect_publisher() TO authenticated;
GRANT ALL ON FUNCTION public.trg_offer_protect_publisher() TO service_role;


--
-- Name: FUNCTION trg_offer_publisher(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_offer_publisher() TO anon;
GRANT ALL ON FUNCTION public.trg_offer_publisher() TO authenticated;
GRANT ALL ON FUNCTION public.trg_offer_publisher() TO service_role;


--
-- Name: FUNCTION trg_plan_limit_changed(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_plan_limit_changed() TO anon;
GRANT ALL ON FUNCTION public.trg_plan_limit_changed() TO authenticated;
GRANT ALL ON FUNCTION public.trg_plan_limit_changed() TO service_role;


--
-- Name: FUNCTION trg_proposal_vehicle_check(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_proposal_vehicle_check() TO anon;
GRANT ALL ON FUNCTION public.trg_proposal_vehicle_check() TO authenticated;
GRANT ALL ON FUNCTION public.trg_proposal_vehicle_check() TO service_role;


--
-- Name: FUNCTION trg_protect_network(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_protect_network() TO anon;
GRANT ALL ON FUNCTION public.trg_protect_network() TO authenticated;
GRANT ALL ON FUNCTION public.trg_protect_network() TO service_role;


--
-- Name: FUNCTION trg_recipient_must_be_affiliate(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_recipient_must_be_affiliate() TO anon;
GRANT ALL ON FUNCTION public.trg_recipient_must_be_affiliate() TO authenticated;
GRANT ALL ON FUNCTION public.trg_recipient_must_be_affiliate() TO service_role;


--
-- Name: FUNCTION trg_subscription_check_offer(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_subscription_check_offer() TO anon;
GRANT ALL ON FUNCTION public.trg_subscription_check_offer() TO authenticated;
GRANT ALL ON FUNCTION public.trg_subscription_check_offer() TO service_role;


--
-- Name: FUNCTION trg_subscription_check_proposal(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_subscription_check_proposal() TO anon;
GRANT ALL ON FUNCTION public.trg_subscription_check_proposal() TO authenticated;
GRANT ALL ON FUNCTION public.trg_subscription_check_proposal() TO service_role;


--
-- Name: FUNCTION trg_subscription_enforce_vehicles(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_subscription_enforce_vehicles() TO anon;
GRANT ALL ON FUNCTION public.trg_subscription_enforce_vehicles() TO authenticated;
GRANT ALL ON FUNCTION public.trg_subscription_enforce_vehicles() TO service_role;


--
-- Name: FUNCTION trg_vehicle_guard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_vehicle_guard() TO anon;
GRANT ALL ON FUNCTION public.trg_vehicle_guard() TO authenticated;
GRANT ALL ON FUNCTION public.trg_vehicle_guard() TO service_role;


--
-- Name: FUNCTION trg_wallet_check_proposal(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_wallet_check_proposal() TO anon;
GRANT ALL ON FUNCTION public.trg_wallet_check_proposal() TO authenticated;
GRANT ALL ON FUNCTION public.trg_wallet_check_proposal() TO service_role;


--
-- Name: FUNCTION trg_wallet_release_on_cancel(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_wallet_release_on_cancel() TO anon;
GRANT ALL ON FUNCTION public.trg_wallet_release_on_cancel() TO authenticated;
GRANT ALL ON FUNCTION public.trg_wallet_release_on_cancel() TO service_role;


--
-- Name: FUNCTION trg_wallet_welcome_credit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_wallet_welcome_credit() TO anon;
GRANT ALL ON FUNCTION public.trg_wallet_welcome_credit() TO authenticated;
GRANT ALL ON FUNCTION public.trg_wallet_welcome_credit() TO service_role;


--
-- Name: FUNCTION validate_delivery(p_mission_id bigint, p_reserves text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_delivery(p_mission_id bigint, p_reserves text) TO anon;
GRANT ALL ON FUNCTION public.validate_delivery(p_mission_id bigint, p_reserves text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_delivery(p_mission_id bigint, p_reserves text) TO service_role;


--
-- Name: FUNCTION validate_mission_driver(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_mission_driver() TO anon;
GRANT ALL ON FUNCTION public.validate_mission_driver() TO authenticated;
GRANT ALL ON FUNCTION public.validate_mission_driver() TO service_role;


--
-- Name: FUNCTION validate_unloading(p_mission_id bigint, p_reserves text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_unloading(p_mission_id bigint, p_reserves text) TO anon;
GRANT ALL ON FUNCTION public.validate_unloading(p_mission_id bigint, p_reserves text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_unloading(p_mission_id bigint, p_reserves text) TO service_role;


--
-- Name: FUNCTION vehicle_quota(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.vehicle_quota(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.vehicle_quota(p_user uuid) TO service_role;


--
-- Name: FUNCTION vehicle_visible_via_directory(p_vehicle_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.vehicle_visible_via_directory(p_vehicle_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.vehicle_visible_via_directory(p_vehicle_id bigint) TO anon;
GRANT ALL ON FUNCTION public.vehicle_visible_via_directory(p_vehicle_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.vehicle_visible_via_directory(p_vehicle_id bigint) TO service_role;


--
-- Name: FUNCTION wallet_assert_can_commit(p_user uuid, p_price numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.wallet_assert_can_commit(p_user uuid, p_price numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.wallet_assert_can_commit(p_user uuid, p_price numeric) TO service_role;


--
-- Name: FUNCTION wallet_available(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.wallet_available(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.wallet_available(p_user uuid) TO service_role;


--
-- Name: FUNCTION wallet_balance(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.wallet_balance(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.wallet_balance(p_user uuid) TO service_role;


--
-- Name: FUNCTION wallet_reserved(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.wallet_reserved(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.wallet_reserved(p_user uuid) TO service_role;


--
-- Name: TABLE billing_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.billing_profiles TO anon;
GRANT ALL ON TABLE public.billing_profiles TO authenticated;
GRANT ALL ON TABLE public.billing_profiles TO service_role;


--
-- Name: TABLE carrier_associations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.carrier_associations TO anon;
GRANT ALL ON TABLE public.carrier_associations TO authenticated;
GRANT ALL ON TABLE public.carrier_associations TO service_role;


--
-- Name: TABLE commercial_earnings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.commercial_earnings TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.commercial_earnings TO authenticated;
GRANT ALL ON TABLE public.commercial_earnings TO service_role;


--
-- Name: SEQUENCE commercial_earnings_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.commercial_earnings_id_seq TO anon;
GRANT ALL ON SEQUENCE public.commercial_earnings_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.commercial_earnings_id_seq TO service_role;


--
-- Name: SEQUENCE commercial_payouts_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.commercial_payouts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.commercial_payouts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.commercial_payouts_id_seq TO service_role;


--
-- Name: TABLE commercial_rates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.commercial_rates TO anon;
GRANT ALL ON TABLE public.commercial_rates TO authenticated;
GRANT ALL ON TABLE public.commercial_rates TO service_role;


--
-- Name: TABLE commercial_share_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.commercial_share_rules TO anon;
GRANT ALL ON TABLE public.commercial_share_rules TO authenticated;
GRANT ALL ON TABLE public.commercial_share_rules TO service_role;


--
-- Name: TABLE commission_entries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.commission_entries TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.commission_entries TO authenticated;
GRANT ALL ON TABLE public.commission_entries TO service_role;


--
-- Name: SEQUENCE commission_entries_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.commission_entries_id_seq TO anon;
GRANT ALL ON SEQUENCE public.commission_entries_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.commission_entries_id_seq TO service_role;


--
-- Name: TABLE communes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.communes TO anon;
GRANT ALL ON TABLE public.communes TO authenticated;
GRANT ALL ON TABLE public.communes TO service_role;


--
-- Name: SEQUENCE communes_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.communes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.communes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.communes_id_seq TO service_role;


--
-- Name: SEQUENCE directory_members_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.directory_members_id_seq TO anon;
GRANT ALL ON SEQUENCE public.directory_members_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.directory_members_id_seq TO service_role;


--
-- Name: TABLE freight_offer_recipients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.freight_offer_recipients TO anon;
GRANT ALL ON TABLE public.freight_offer_recipients TO authenticated;
GRANT ALL ON TABLE public.freight_offer_recipients TO service_role;


--
-- Name: TABLE freight_offers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.freight_offers TO anon;
GRANT ALL ON TABLE public.freight_offers TO authenticated;
GRANT ALL ON TABLE public.freight_offers TO service_role;


--
-- Name: SEQUENCE freight_offers_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.freight_offers_id_seq TO anon;
GRANT ALL ON SEQUENCE public.freight_offers_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.freight_offers_id_seq TO service_role;


--
-- Name: TABLE invoice_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invoice_counters TO anon;
GRANT ALL ON TABLE public.invoice_counters TO authenticated;
GRANT ALL ON TABLE public.invoice_counters TO service_role;


--
-- Name: TABLE invoice_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.invoice_lines TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.invoice_lines TO authenticated;
GRANT ALL ON TABLE public.invoice_lines TO service_role;


--
-- Name: SEQUENCE invoice_lines_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.invoice_lines_id_seq TO anon;
GRANT ALL ON SEQUENCE public.invoice_lines_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.invoice_lines_id_seq TO service_role;


--
-- Name: SEQUENCE invoices_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.invoices_id_seq TO anon;
GRANT ALL ON SEQUENCE public.invoices_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.invoices_id_seq TO service_role;


--
-- Name: TABLE ldv_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ldv_snapshots TO service_role;


--
-- Name: TABLE mission_reserves; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_reserves TO service_role;
GRANT SELECT ON TABLE public.mission_reserves TO authenticated;


--
-- Name: SEQUENCE mission_reserves_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.mission_reserves_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mission_reserves_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mission_reserves_id_seq TO service_role;


--
-- Name: SEQUENCE missions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.missions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.missions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.missions_id_seq TO service_role;


--
-- Name: TABLE offer_directory_targets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.offer_directory_targets TO anon;
GRANT ALL ON TABLE public.offer_directory_targets TO authenticated;
GRANT ALL ON TABLE public.offer_directory_targets TO service_role;


--
-- Name: SEQUENCE offer_directory_targets_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.offer_directory_targets_id_seq TO anon;
GRANT ALL ON SEQUENCE public.offer_directory_targets_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.offer_directory_targets_id_seq TO service_role;


--
-- Name: TABLE offer_goods_lines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.offer_goods_lines TO service_role;
GRANT SELECT ON TABLE public.offer_goods_lines TO authenticated;


--
-- Name: SEQUENCE offer_goods_lines_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.offer_goods_lines_id_seq TO anon;
GRANT ALL ON SEQUENCE public.offer_goods_lines_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.offer_goods_lines_id_seq TO service_role;


--
-- Name: TABLE offer_private_details; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.offer_private_details TO service_role;
GRANT SELECT ON TABLE public.offer_private_details TO authenticated;


--
-- Name: TABLE offer_special_commission; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.offer_special_commission TO anon;
GRANT ALL ON TABLE public.offer_special_commission TO authenticated;
GRANT ALL ON TABLE public.offer_special_commission TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- Name: SEQUENCE organizations_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.organizations_id_seq TO anon;
GRANT ALL ON SEQUENCE public.organizations_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.organizations_id_seq TO service_role;


--
-- Name: TABLE platform_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_settings TO anon;
GRANT ALL ON TABLE public.platform_settings TO authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;


--
-- Name: TABLE private_directories; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.private_directories TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.private_directories TO authenticated;
GRANT ALL ON TABLE public.private_directories TO service_role;


--
-- Name: SEQUENCE private_directories_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.private_directories_id_seq TO anon;
GRANT ALL ON SEQUENCE public.private_directories_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.private_directories_id_seq TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE proposals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.proposals TO anon;
GRANT ALL ON TABLE public.proposals TO authenticated;
GRANT ALL ON TABLE public.proposals TO service_role;


--
-- Name: SEQUENCE proposals_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.proposals_id_seq TO anon;
GRANT ALL ON SEQUENCE public.proposals_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.proposals_id_seq TO service_role;


--
-- Name: TABLE quotes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quotes TO anon;
GRANT ALL ON TABLE public.quotes TO authenticated;
GRANT ALL ON TABLE public.quotes TO service_role;


--
-- Name: SEQUENCE quotes_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.quotes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.quotes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.quotes_id_seq TO service_role;


--
-- Name: SEQUENCE subscription_payments_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.subscription_payments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.subscription_payments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.subscription_payments_id_seq TO service_role;


--
-- Name: TABLE subscription_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscription_plans TO anon;
GRANT ALL ON TABLE public.subscription_plans TO authenticated;
GRANT ALL ON TABLE public.subscription_plans TO service_role;


--
-- Name: SEQUENCE subscription_plans_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.subscription_plans_id_seq TO anon;
GRANT ALL ON SEQUENCE public.subscription_plans_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.subscription_plans_id_seq TO service_role;


--
-- Name: TABLE sync_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sync_events TO anon;
GRANT ALL ON TABLE public.sync_events TO authenticated;
GRANT ALL ON TABLE public.sync_events TO service_role;


--
-- Name: SEQUENCE sync_events_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.sync_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.sync_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.sync_events_id_seq TO service_role;


--
-- Name: TABLE vehicles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicles TO anon;
GRANT ALL ON TABLE public.vehicles TO authenticated;
GRANT ALL ON TABLE public.vehicles TO service_role;


--
-- Name: SEQUENCE vehicles_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.vehicles_id_seq TO anon;
GRANT ALL ON SEQUENCE public.vehicles_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.vehicles_id_seq TO service_role;


--
-- Name: TABLE wallet_reservations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.wallet_reservations TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.wallet_reservations TO authenticated;
GRANT ALL ON TABLE public.wallet_reservations TO service_role;


--
-- Name: SEQUENCE wallet_reservations_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.wallet_reservations_id_seq TO anon;
GRANT ALL ON SEQUENCE public.wallet_reservations_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.wallet_reservations_id_seq TO service_role;


--
-- Name: SEQUENCE wallet_topups_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.wallet_topups_id_seq TO anon;
GRANT ALL ON SEQUENCE public.wallet_topups_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.wallet_topups_id_seq TO service_role;


--
-- Name: SEQUENCE wallet_transactions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.wallet_transactions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.wallet_transactions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.wallet_transactions_id_seq TO service_role;


--
-- Name: TABLE wilayas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.wilayas TO anon;
GRANT ALL ON TABLE public.wilayas TO authenticated;
GRANT ALL ON TABLE public.wilayas TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

