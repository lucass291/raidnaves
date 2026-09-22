create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'worker'
    check (role in ('admin', 'ceo', 'manager', 'worker')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id and role = 'worker');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set must_change_password = false, updated_at = timezone('utc', now())
  where id = auth.uid();
end;
$$;

revoke all on function public.complete_password_change() from public;
grant execute on function public.complete_password_change() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.list_admin_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) then
    raise exception 'Only administrators can list users';
  end if;

  return query
    select u.id, u.email::text, p.full_name, p.role, p.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by p.created_at desc nulls last, u.created_at desc;
end;
$$;

create or replace function public.update_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) then
    raise exception 'Only administrators can update roles';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Administrators cannot change their own role';
  end if;

  if new_role not in ('admin', 'ceo', 'manager', 'worker') then
    raise exception 'Invalid role';
  end if;

  update public.profiles
  set role = new_role, updated_at = timezone('utc', now())
  where id = target_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.list_admin_users() from public;
grant execute on function public.list_admin_users() to authenticated;
revoke all on function public.update_user_role(uuid, text) from public;
grant execute on function public.update_user_role(uuid, text) to authenticated;

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (area_id, name)
);

alter table public.areas
  add column if not exists manager_id uuid references public.profiles(id) on delete set null;

alter table public.teams
  add column if not exists responsible_id uuid references public.profiles(id) on delete set null;

alter table public.areas enable row level security;
alter table public.teams enable row level security;

drop policy if exists "Authenticated users can read areas" on public.areas;
create policy "Authenticated users can read areas"
  on public.areas for select to authenticated using (true);

drop policy if exists "Authenticated users can read teams" on public.teams;
create policy "Authenticated users can read teams"
  on public.teams for select to authenticated using (true);

create or replace function public.list_admin_structure()
returns json
language plpgsql
security definer set search_path = public
as $$
declare result json;
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) then
    raise exception 'Only administrators can manage structure';
  end if;

  select json_build_object(
    'areas', coalesce((
      select json_agg(json_build_object(
        'id', a.id, 'name', a.name, 'description', a.description,
        'manager_id', a.manager_id, 'manager_name', manager.full_name, 'manager_role', manager.role
      ) order by a.created_at)
      from public.areas a
      left join public.profiles manager on manager.id = a.manager_id
    ), '[]'::json),
    'teams', coalesce((
      select json_agg(json_build_object(
        'id', t.id, 'area_id', t.area_id, 'name', t.name, 'description', t.description,
        'responsible_id', t.responsible_id, 'responsible_name', responsible.full_name,
        'responsible_role', responsible.role
      ) order by t.created_at)
      from public.teams t
      left join public.profiles responsible on responsible.id = t.responsible_id
    ), '[]'::json)
  ) into result;
  return result;
end;
$$;

create or replace function public.create_area(area_name text, area_description text default null)
returns public.areas
language plpgsql security definer set search_path = public
as $$
declare created public.areas;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only administrators can manage structure';
  end if;
  insert into public.areas (name, description)
  values (trim(area_name), nullif(trim(area_description), ''))
  returning * into created;
  return created;
end;
$$;

create or replace function public.create_team(team_area_id uuid, team_name text, team_description text default null)
returns public.teams
language plpgsql security definer set search_path = public
as $$
declare created public.teams;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only administrators can manage structure';
  end if;
  insert into public.teams (area_id, name, description)
  values (team_area_id, trim(team_name), nullif(trim(team_description), ''))
  returning * into created;
  return created;
end;
$$;

create or replace function public.delete_area(area_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only administrators can manage structure';
  end if;
  delete from public.areas where id = area_id;
end;
$$;

create or replace function public.delete_team(team_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only administrators can manage structure';
  end if;
  delete from public.teams where id = team_id;
end;
$$;

revoke all on function public.list_admin_structure() from public;
grant execute on function public.list_admin_structure() to authenticated;
revoke all on function public.create_area(text, text) from public;
grant execute on function public.create_area(text, text) to authenticated;
revoke all on function public.create_team(uuid, text, text) from public;
grant execute on function public.create_team(uuid, text, text) to authenticated;
revoke all on function public.delete_area(uuid) from public;
grant execute on function public.delete_area(uuid) to authenticated;
revoke all on function public.delete_team(uuid) from public;
grant execute on function public.delete_team(uuid) to authenticated;

alter table public.profiles
  add column if not exists area_id uuid references public.areas(id) on delete set null,
  add column if not exists team_id uuid references public.teams(id) on delete set null;

drop function if exists public.list_admin_users();

create or replace function public.list_admin_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  area_id uuid,
  area_name text,
  team_id uuid,
  team_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) then
    raise exception 'Only administrators can list users';
  end if;

  return query
    select
      u.id,
      u.email::text,
      p.full_name,
      p.role,
      p.area_id,
      a.name,
      p.team_id,
      t.name,
      p.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.areas a on a.id = p.area_id
    left join public.teams t on t.id = p.team_id
    order by p.created_at desc nulls last, u.created_at desc;
end;
$$;

create or replace function public.update_user_assignment(
  target_user_id uuid,
  new_area_id uuid,
  new_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) then
    raise exception 'Only administrators can assign users';
  end if;

  if new_team_id is not null and not exists (
    select 1 from public.teams
    where teams.id = new_team_id and teams.area_id = new_area_id
  ) then
    raise exception 'The selected team does not belong to the selected area';
  end if;

  update public.profiles
  set area_id = new_area_id, team_id = new_team_id, updated_at = timezone('utc', now())
  where id = target_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

create or replace function public.update_area_manager(area_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only administrators can manage structure';
  end if;
  if target_user_id is not null and not exists (
    select 1 from public.profiles
    where profiles.id = target_user_id
      and profiles.area_id = update_area_manager.area_id
      and profiles.role in ('ceo', 'manager')
  ) then
    raise exception 'The area manager must have role CEO or Manager and belong to the selected area';
  end if;
  update public.areas set manager_id = target_user_id where public.areas.id = update_area_manager.area_id;
  if not found then raise exception 'Area not found'; end if;
end;
$$;

create or replace function public.update_team_responsible(team_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only administrators can manage structure';
  end if;
  if target_user_id is not null and not exists (
    select 1 from public.profiles
    where profiles.id = target_user_id
      and profiles.team_id = update_team_responsible.team_id
      and profiles.role in ('ceo', 'manager')
  ) then
    raise exception 'The team responsible must have role CEO or Manager and belong to the selected team';
  end if;
  update public.teams set responsible_id = target_user_id where public.teams.id = update_team_responsible.team_id;
  if not found then raise exception 'Team not found'; end if;
end;
$$;

revoke all on function public.list_admin_users() from public;
grant execute on function public.list_admin_users() to authenticated;
revoke all on function public.update_user_assignment(uuid, uuid, uuid) from public;
grant execute on function public.update_user_assignment(uuid, uuid, uuid) to authenticated;
revoke all on function public.update_area_manager(uuid, uuid) from public;
grant execute on function public.update_area_manager(uuid, uuid) to authenticated;
revoke all on function public.update_team_responsible(uuid, uuid) from public;
grant execute on function public.update_team_responsible(uuid, uuid) to authenticated;

-- Tasks and operations module
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  area_id uuid references public.areas(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  due_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tasks_team_area_check check (team_id is null or area_id is not null)
);

create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_priority_idx on public.tasks(priority);
create index if not exists tasks_area_id_idx on public.tasks(area_id);
create index if not exists tasks_team_id_idx on public.tasks(team_id);
create index if not exists tasks_assignee_id_idx on public.tasks(assignee_id);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists tasks_due_date_idx on public.tasks(due_date);

alter table public.tasks enable row level security;

create or replace function public.list_tasks()
returns table (
  id uuid, title text, description text, status text, priority text,
  area_id uuid, area_name text, team_id uuid, team_name text,
  assignee_id uuid, assignee_name text, created_by uuid, creator_name text,
  due_date date, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare me public.profiles;
begin
  select * into me from public.profiles where profiles.id = auth.uid();
  if me.id is null then raise exception 'Perfil no encontrado'; end if;
  return query
    select t.id, t.title, t.description, t.status, t.priority,
      t.area_id, a.name, t.team_id, tm.name, t.assignee_id, assignee.full_name,
      t.created_by, creator.full_name, t.due_date, t.created_at, t.updated_at
    from public.tasks t
    left join public.areas a on a.id = t.area_id
    left join public.teams tm on tm.id = t.team_id
    left join public.profiles assignee on assignee.id = t.assignee_id
    left join public.profiles creator on creator.id = t.created_by
    where me.role in ('admin', 'ceo')
       or (me.role = 'manager' and (t.area_id = me.area_id or t.team_id = me.team_id))
       or (me.role = 'worker' and (t.assignee_id = me.id or t.team_id = me.team_id))
    order by t.due_date nulls last, t.created_at desc;
end;
$$;

create or replace function public.list_task_options()
returns json
language plpgsql security definer set search_path = public
as $$
declare me public.profiles; result json;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Perfil no encontrado'; end if;
  select json_build_object(
    'areas', coalesce((select json_agg(json_build_object('id', a.id, 'name', a.name) order by a.name)
      from public.areas a where me.role in ('admin','ceo') or me.role = 'manager' and a.id = me.area_id), '[]'::json),
    'teams', coalesce((select json_agg(json_build_object('id', tm.id, 'name', tm.name, 'area_id', tm.area_id) order by tm.name)
      from public.teams tm where me.role in ('admin','ceo') or me.role = 'manager' and (tm.area_id = me.area_id or tm.id = me.team_id)), '[]'::json),
    'assignees', coalesce((select json_agg(json_build_object('id', p.id, 'name', coalesce(p.full_name, 'Sin nombre'), 'area_id', p.area_id, 'team_id', p.team_id) order by p.full_name)
      from public.profiles p where me.role in ('admin','ceo') or me.role = 'manager' and (p.area_id = me.area_id or p.team_id = me.team_id)), '[]'::json)
  ) into result;
  return result;
end;
$$;

create or replace function public.create_task(
  task_title text, task_description text default null, task_status text default 'pending',
  task_priority text default 'medium', task_area_id uuid default null, task_team_id uuid default null,
  task_assignee_id uuid default null, task_due_date date default null
)
returns public.tasks
language plpgsql security definer set search_path = public
as $$
declare me public.profiles; created public.tasks;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.role is null or me.role not in ('admin','ceo','manager') then raise exception 'No tenés permisos para crear tareas'; end if;
  if task_status not in ('pending','in_progress','completed','cancelled') or task_priority not in ('low','medium','high','urgent') then raise exception 'Estado o prioridad inválidos'; end if;
  if task_team_id is not null and not exists (select 1 from public.teams where id = task_team_id and area_id = task_area_id) then raise exception 'El equipo no pertenece al área'; end if;
  if task_assignee_id is not null and not exists (
    select 1 from public.profiles p where p.id = task_assignee_id
      and (task_team_id is null or p.team_id = task_team_id)
      and (task_area_id is null or p.area_id = task_area_id)
  ) then raise exception 'El responsable no pertenece al área o equipo seleccionado'; end if;
  if me.role = 'manager' and not (coalesce(task_area_id = me.area_id, false) or coalesce(task_team_id = me.team_id, false)) then raise exception 'La tarea está fuera de tu alcance'; end if;
  insert into public.tasks (title, description, status, priority, area_id, team_id, assignee_id, created_by, due_date)
  values (trim(task_title), nullif(trim(task_description), ''), task_status, task_priority, task_area_id, task_team_id, task_assignee_id, me.id, task_due_date)
  returning * into created;
  return created;
end;
$$;

create or replace function public.update_task_status(task_id uuid, new_status text)
returns public.tasks
language plpgsql security definer set search_path = public
as $$
declare me public.profiles; current_task public.tasks; updated public.tasks;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into current_task from public.tasks where id = task_id;
  if current_task.id is null then raise exception 'Tarea no encontrada'; end if;
  if new_status not in ('pending','in_progress','completed','cancelled') then raise exception 'Estado inválido'; end if;
  if me.role = 'worker' and current_task.assignee_id is distinct from me.id then raise exception 'No podés cambiar esta tarea'; end if;
  if me.role = 'manager' and not (coalesce(current_task.area_id = me.area_id, false) or coalesce(current_task.team_id = me.team_id, false)) then raise exception 'La tarea está fuera de tu alcance'; end if;
  if me.role not in ('admin','ceo','manager','worker') then raise exception 'No tenés permisos'; end if;
  update public.tasks set status = new_status, updated_at = timezone('utc', now()) where id = task_id returning * into updated;
  return updated;
end;
$$;

create or replace function public.delete_task(task_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Solo administradores pueden eliminar tareas'; end if;
  delete from public.tasks where id = task_id;
end;
$$;

revoke all on public.tasks from anon, authenticated;
revoke all on function public.list_tasks() from public;
revoke all on function public.list_task_options() from public;
revoke all on function public.create_task(text, text, text, text, uuid, uuid, uuid, date) from public;
revoke all on function public.update_task_status(uuid, text) from public;
revoke all on function public.delete_task(uuid) from public;
grant execute on function public.list_tasks() to authenticated;
grant execute on function public.list_task_options() to authenticated;
grant execute on function public.create_task(text, text, text, text, uuid, uuid, uuid, date) to authenticated;
grant execute on function public.update_task_status(uuid, text) to authenticated;
grant execute on function public.delete_task(uuid) to authenticated;
