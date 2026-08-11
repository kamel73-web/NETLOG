alter table profiles
  add column email text unique;

alter table profiles
  alter column phone drop not null;
alter table profiles
  drop constraint if exists profiles_phone_key;

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, phone, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'full_name', 'Utilisateur'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'donneur_ordre')
  );
  return new;
end;
$$;
