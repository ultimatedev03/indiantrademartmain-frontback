-- Repair GODMODE regression after the superadmin split.
-- If a legacy install still has only one root account and no GODMODE row,
-- that sole account must remain the developer's GODMODE login.

update public.superadmin_users
  set role = 'GODMODE'
  where regexp_replace(upper(coalesce(role, '')), '[^A-Z]', '', 'g') in ('GODMODE', 'SUPERUSER', 'DEVELOPER');

update public.superadmin_users
  set role = 'GODMODE'
  where id in (
    select id
    from public.superadmin_users
    order by created_at nulls first, id
    limit 1
  )
    and not exists (
      select 1
      from public.superadmin_users
      where role = 'GODMODE'
    )
    and (select count(*) from public.superadmin_users) = 1;
