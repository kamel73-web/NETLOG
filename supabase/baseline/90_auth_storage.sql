-- Éléments hors schéma public, relevés dans la production le 08/11/2026
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists payment_proofs_insert on storage.objects;
create policy payment_proofs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists payment_proofs_select on storage.objects;
create policy payment_proofs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = (auth.uid())::text or public.is_admin()));
