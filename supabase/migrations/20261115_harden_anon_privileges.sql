-- À placer dans supabase/migrations/20261115_harden_anon_privileges.sql
-- Appliquée et testée sur le STAGING le 15/11/2026. NON appliquée en production (sauvegarde requise).

-- 1) Règles RLS : TO public devient TO authenticated, sauf la lecture publique des wilayas/communes
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = '{public}'
      AND policyname NOT IN ('wilayas_lecture_publique', 'communes_lecture_publique')
    ORDER BY tablename, policyname
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2) Fonctions : aucun droit pour PUBLIC/anon ; authenticated + service_role gardent les fonctions métier ;
--    les fonctions de déclencheur ne sont plus appelables.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, (p.prorettype = 'trigger'::regtype) AS is_trg
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON ROUTINE %s FROM PUBLIC, anon', r.sig);
    IF r.is_trg THEN
      EXECUTE format('REVOKE ALL ON ROUTINE %s FROM authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO authenticated, service_role', r.sig);
    END IF;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- 3) Tables : anon n'a rien sauf la lecture des wilayas et communes ; privilèges inutiles retirés
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind IN ('r','v','m','p','f')
  LOOP
    EXECUTE format('REVOKE ALL ON %s FROM anon', r.rel);
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON %s FROM authenticated', r.rel);
  END LOOP;
END $$;

GRANT SELECT ON public.wilayas, public.communes TO anon;
