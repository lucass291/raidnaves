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
    'areas', coalesce((select json_agg(a order by a.created_at) from public.areas a), '[]'::json),
    'teams', coalesce((select json_agg(t order by t.created_at) from public.teams t), '[]'::json)
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
