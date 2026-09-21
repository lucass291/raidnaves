create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'worker'
    check (role in ('admin', 'ceo', 'manager', 'worker')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
