drop function if exists public.update_team_responsible(uuid, uuid);

create function public.update_team_responsible(target_team_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'ceo')
  ) then
    raise exception 'Only administrators or CEOs can manage structure';
  end if;

  if target_user_id is not null and not exists (
    select 1
    from public.profiles
    where profiles.id = target_user_id
      and profiles.team_id = target_team_id
      and profiles.role in ('ceo', 'manager')
  ) then
    raise exception 'The team responsible must have role CEO or Manager and belong to the selected team';
  end if;

  update public.teams
  set responsible_id = target_user_id
  where public.teams.id = target_team_id;

  if not found then
    raise exception 'Team not found';
  end if;
end;
$$;

revoke all on function public.update_team_responsible(uuid, uuid) from public;
grant execute on function public.update_team_responsible(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
