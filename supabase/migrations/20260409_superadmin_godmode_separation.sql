-- Separate GOD MODE (developer) from SUPERADMIN (ITM owner)
-- GOD MODE = developer, highest level, only 1
-- SUPERADMIN = ITM business owner, second level

-- Ensure superadmin_users table has role column with correct default
alter table public.superadmin_users
  add column if not exists role text not null default 'SUPERADMIN';

-- Drop old constraint if exists
alter table public.superadmin_users
  drop constraint if exists superadmin_users_role_check;

-- Add new role constraint: only GODMODE or SUPERADMIN allowed
alter table public.superadmin_users
  add constraint superadmin_users_role_check
  check (role in ('GODMODE', 'SUPERADMIN'));

-- Normalize any existing rows:
-- 1. Legacy developer aliases stay GODMODE.
-- 2. If the old system only had one root account, preserve it as GODMODE.
-- 3. Everyone else becomes SUPERADMIN.
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

update public.superadmin_users
  set role = 'SUPERADMIN'
  where role not in ('GODMODE', 'SUPERADMIN');

-- Ensure only 1 GODMODE account can ever exist (enforce via unique partial index)
create unique index if not exists superadmin_users_single_godmode
  on public.superadmin_users (role)
  where role = 'GODMODE';
