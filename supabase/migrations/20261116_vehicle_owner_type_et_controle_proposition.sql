-- À placer dans supabase/migrations/20261116_vehicle_owner_type_et_controle_proposition.sql
-- Appliquée et testée sur le STAGING le 16/11/2026. NON appliquée en production (sauvegarde requise).

-- 1) Type de propriétaire explicite sur les véhicules.
--    transporteur_id reste l'identifiant du propriétaire (aucun changement de code applicatif).
alter table public.vehicles add column if not exists owner_type text;

update public.vehicles v
   set owner_type = case when p.role = 'transporteur' then 'transporteur' else 'donneur_ordre' end
  from public.profiles p
 where p.id = v.transporteur_id and v.owner_type is null;

alter table public.vehicles alter column owner_type set not null;
alter table public.vehicles drop constraint if exists vehicles_owner_type_check;
alter table public.vehicles add constraint vehicles_owner_type_check check (owner_type in ('transporteur','donneur_ordre'));

create or replace function public.trg_vehicle_owner_type()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    select case when role = 'transporteur' then 'transporteur' else 'donneur_ordre' end
      into new.owner_type from public.profiles where id = new.transporteur_id;
  else
    new.owner_type := old.owner_type;  -- non modifiable
  end if;
  return new;
end $$;

revoke all on function public.trg_vehicle_owner_type() from public, anon, authenticated;

drop trigger if exists trg_vehicle_owner_type on public.vehicles;
create trigger trg_vehicle_owner_type before insert or update on public.vehicles
  for each row execute function public.trg_vehicle_owner_type();

-- 2) Une proposition ne peut citer qu'un camion du transporteur (ou un camion qui lui est affecté
--    via un répertoire, statut accepté). Contrôle à l'insertion ou au changement de camion seulement,
--    pour ne pas bloquer les mises à jour de statut des propositions existantes.
create or replace function public.trg_proposal_vehicle_check()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.vehicle_id is not null
     and (tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id)
     and auth.uid() is not null and not is_admin() then
    if not exists (select 1 from vehicles v where v.id = new.vehicle_id and v.transporteur_id = new.transporteur_id)
       and not exists (select 1 from directory_members dm
                        where dm.vehicle_id = new.vehicle_id and dm.status = 'accepte'
                          and dm.transporteur_id = new.transporteur_id) then
      raise exception 'Ce camion n''appartient pas à votre parc : choisissez un de vos camions.';
    end if;
  end if;

  if new.vehicle_id is not null and exists (select 1 from vehicles v where v.id = new.vehicle_id and v.suspendu_abonnement) then
    if tg_op = 'INSERT' then
      raise exception 'Ce camion est désactivé par votre forfait : choisissez un camion actif.';
    elsif new.status = 'acceptee' and old.status is distinct from 'acceptee' then
      raise exception 'Le camion de cette proposition n''est plus actif : la proposition ne peut pas être acceptée.';
    end if;
  end if;
  return new;
end $$;
