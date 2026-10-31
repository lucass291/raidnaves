create or replace function public.list_manager_structure()
returns json
language plpgsql
security definer set search_path = public
as $$
declare me public.profiles; result json;
begin
  select * into me
  from public.profiles
  where profiles.id = auth.uid() and profiles.role = 'manager';

  if me.id is null or me.area_id is null then
    raise exception 'Only area managers with an assigned area can list their structure';
  end if;

  select json_build_object(
    'areas', coalesce((
      select json_agg(json_build_object(
        'id', a.id, 'name', a.name, 'description', a.description,
        'manager_id', a.manager_id, 'manager_name', manager.full_name, 'manager_role', manager.role
      ))
      from public.areas a
      left join public.profiles manager on manager.id = a.manager_id
      where a.id = me.area_id
    ), '[]'::json),
    'teams', coalesce((
      select json_agg(json_build_object(
        'id', t.id, 'area_id', t.area_id, 'name', t.name, 'description', t.description,
        'responsible_id', t.responsible_id, 'responsible_name', responsible.full_name,
        'responsible_role', responsible.role,
        'members', coalesce((
          select json_agg(json_build_object(
            'id', worker.id, 'full_name', worker.full_name
          ) order by worker.full_name)
          from public.profiles worker
          where worker.area_id = me.area_id and worker.team_id = t.id and worker.role = 'worker'
        ), '[]'::json)
      ) order by t.created_at)
      from public.teams t
      left join public.profiles responsible on responsible.id = t.responsible_id
      where t.area_id = me.area_id
    ), '[]'::json)
  ) into result;

  return result;
end;
$$;

revoke all on function public.list_manager_structure() from public;
grant execute on function public.list_manager_structure() to authenticated;

create or replace function public.create_team(team_area_id uuid, team_name text, team_description text default null)
returns public.teams
language plpgsql security definer set search_path = public
as $$
declare me public.profiles; created public.teams;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or not (
    me.role in ('admin', 'ceo')
    or (me.role = 'manager' and me.area_id = team_area_id)
  ) then
    raise exception 'Only administrators, CEOs, or managers creating teams in their area can manage teams';
  end if;
  if team_area_id is null or nullif(trim(team_name), '') is null then
    raise exception 'A team area and name are required';
  end if;
  insert into public.teams (area_id, name, description)
  values (team_area_id, trim(team_name), nullif(trim(team_description), ''))
  returning * into created;
  return created;
end;
$$;

revoke all on function public.create_team(uuid, text, text) from public;
grant execute on function public.create_team(uuid, text, text) to authenticated;
