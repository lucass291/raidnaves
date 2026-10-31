drop function if exists public.update_area_manager(uuid, uuid);

create function public.update_area_manager(target_area_id uuid, target_user_id uuid)
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
      and profiles.area_id = target_area_id
      and profiles.role in ('ceo', 'manager')
  ) then
    raise exception 'The area manager must have role CEO or Manager and belong to the selected area';
  end if;

  update public.areas
  set manager_id = target_user_id
  where public.areas.id = target_area_id;

  if not found then
    raise exception 'Area not found';
  end if;
end;
$$;

revoke all on function public.update_area_manager(uuid, uuid) from public;
grant execute on function public.update_area_manager(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
