alter table freight_offers
  add column nombre_voyages integer not null default 1 check (nombre_voyages > 0),
  add column longueur_exigee_m numeric(5,2),
  add column type_moyen_exige text,
  add column code_confirmation char(4),
  add column contrat_logistique_path text,
  add column transporteur_id uuid references profiles(id),
  add column chauffeur_id uuid references profiles(id),
  add column reserves text,
  add column reserves_chargement text,
  add column reserves_livraison text,
  add column chauffeur_signale_probleme text;

create or replace function generate_code_confirmation()
returns trigger language plpgsql as $$
begin
  if new.code_confirmation is null then
    new.code_confirmation := lpad(floor(random() * 10000)::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_offers_code_confirmation
  before insert on freight_offers
  for each row execute function generate_code_confirmation();

create index idx_offers_transporteur on freight_offers(transporteur_id);
create index idx_offers_chauffeur on freight_offers(chauffeur_id);

alter table profiles
  add column metadata jsonb not null default '{}'::jsonb;
