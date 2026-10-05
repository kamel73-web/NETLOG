create or replace function public.guard_mission_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('decharge', 'livree')
     and old.status is distinct from new.status
     and new.dechargement_at is null
  then
    new.dechargement_at := now();
  end if;

  if new.status is distinct from old.status
     and new.status = 'cloturee'
     and coalesce(current_setting('netlog.bypass_status_guard', true), 'off') <> 'on'
  then
    raise exception 'Transition de statut "%->%" interdite en écriture directe.', old.status, new.status;
  end if;

  return new;
end;
$$;
