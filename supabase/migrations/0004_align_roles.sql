alter type user_role add value if not exists 'commissionnaire';
alter type user_role add value if not exists 'manutentionnaire';
alter type user_role add value if not exists 'stockage';

alter table profiles
  add column if not exists prenom text,
  add column if not exists nrc text,
  add column if not exists adresse text;
