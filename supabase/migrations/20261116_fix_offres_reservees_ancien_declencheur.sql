-- À placer dans supabase/migrations/20261116_fix_offres_reservees_ancien_declencheur.sql
-- Appliquée et testée sur le STAGING le 16/11/2026. NON appliquée en production.

-- L'ancien déclencheur exige une ligne dans carrier_associations (ancien mécanisme, jamais alimenté
-- par le nouveau parcours d'invitation). Il rend impossible toute offre réservée via invite_carrier.
-- Le contrôle équivalent est fait par trg_recipient_must_be_affiliate (invitation acceptée).
drop trigger if exists trg_recipient_associated on public.freight_offer_recipients;
drop function if exists public.enforce_recipient_is_associated();
