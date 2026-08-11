alter table profiles
  add column abonnement_actif boolean not null default false,
  add column date_expiration_abonnement date;
