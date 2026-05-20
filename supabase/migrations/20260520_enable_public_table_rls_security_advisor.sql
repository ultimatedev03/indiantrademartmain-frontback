-- Enable RLS for public tables reported by Supabase Security Advisor.
-- Safe to rerun. Uses table-exists checks so environments without old backup
-- tables can still apply the migration.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'contact_submissions',
    'employees',
    'head_categories',
    'micro_categories',
    'micro_category_meta',
    'product_images',
    'products',
    'proposals',
    'sub_categories',
    'system_config',
    'vendor_additional_leads',
    'lead_purchases_backup_20260222',
    'lead_quota_backup_20260222',
    'plan_coupons',
    'vendor_plan_coupons',
    'referral_plan_rules',
    'vendor_referral_profiles',
    'vendor_plan_slots',
    'plan_tiers',
    'regions',
    'employee_state_scope',
    'vendor_referrals',
    'vendor_referral_wallets',
    'vendor_referral_wallet_ledger',
    'superadmin_users',
    'vendor_referral_cashout_requests',
    'referral_program_settings'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end $$;

-- Low-risk public catalog/config lookup tables.
do $$
declare
  item record;
begin
  for item in
    select *
    from (values
      ('plan_tiers', 'plan_tiers_public_read'),
      ('regions', 'regions_public_read')
    ) as v(table_name, policy_name)
  loop
    if to_regclass(format('public.%I', item.table_name)) is not null then
      execute format('grant select on table public.%I to anon, authenticated', item.table_name);
      execute format('drop policy if exists %I on public.%I', item.policy_name, item.table_name);
      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (true)',
        item.policy_name,
        item.table_name
      );
    end if;
  end loop;
end $$;

-- Public directory/catalog tables must remain readable by the website.
do $$
declare
  item record;
begin
  for item in
    select *
    from (values
      ('head_categories', 'head_categories_public_read'),
      ('sub_categories', 'sub_categories_public_read'),
      ('micro_categories', 'micro_categories_public_read'),
      ('micro_category_meta', 'micro_category_meta_public_read'),
      ('products', 'products_public_read'),
      ('product_images', 'product_images_public_read')
    ) as v(table_name, policy_name)
  loop
    if to_regclass(format('public.%I', item.table_name)) is not null then
      execute format('grant select on table public.%I to anon, authenticated', item.table_name);
      execute format('drop policy if exists %I on public.%I', item.policy_name, item.table_name);
      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (true)',
        item.policy_name,
        item.table_name
      );
    end if;
  end loop;
end $$;

-- Public contact forms may insert submissions, but clients should not read them.
do $$
begin
  if to_regclass('public.contact_submissions') is not null then
    grant insert on table public.contact_submissions to anon, authenticated;

    drop policy if exists contact_submissions_public_insert on public.contact_submissions;
    create policy contact_submissions_public_insert
      on public.contact_submissions
      for insert
      to anon, authenticated
      with check (true);
  end if;
end $$;

-- Employees can read their own employee row when the frontend uses Supabase
-- directly. Admin APIs still use the backend service role.
do $$
begin
  if to_regclass('public.employees') is not null then
    grant select on table public.employees to authenticated;

    drop policy if exists employees_select_own on public.employees;
    create policy employees_select_own
      on public.employees
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
  end if;
end $$;

-- Buyer/vendor proposal rows are private to their owner. Backend service role
-- remains responsible for employee/admin views.
do $$
begin
  if to_regclass('public.proposals') is not null then
    grant select on table public.proposals to authenticated;

    drop policy if exists proposals_select_related_user on public.proposals;
    create policy proposals_select_related_user
      on public.proposals
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.buyers b
          where b.id = proposals.buyer_id
            and (
              b.user_id = auth.uid()
              or lower(coalesce(b.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
        or exists (
          select 1
          from public.vendors v
          where v.id = proposals.vendor_id
            and (
              v.user_id = auth.uid()
              or lower(coalesce(v.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
      );
  end if;
end $$;

-- Sensitive/internal tables: enable RLS and keep direct browser access closed.
-- Service role bypasses RLS for backend routes; no anon/authenticated policies
-- are intentionally added here.
do $$
begin
  if to_regclass('public.system_config') is not null then
    revoke all on table public.system_config from anon, authenticated;
  end if;

  if to_regclass('public.vendor_additional_leads') is not null then
    revoke all on table public.vendor_additional_leads from anon, authenticated;
  end if;

  if to_regclass('public.lead_purchases_backup_20260222') is not null then
    revoke all on table public.lead_purchases_backup_20260222 from anon, authenticated;
  end if;

  if to_regclass('public.lead_quota_backup_20260222') is not null then
    revoke all on table public.lead_quota_backup_20260222 from anon, authenticated;
  end if;

  if to_regclass('public.plan_coupons') is not null then
    revoke all on table public.plan_coupons from anon, authenticated;
  end if;

  if to_regclass('public.vendor_plan_coupons') is not null then
    revoke all on table public.vendor_plan_coupons from anon, authenticated;
  end if;

  if to_regclass('public.referral_plan_rules') is not null then
    revoke all on table public.referral_plan_rules from anon, authenticated;
  end if;

  if to_regclass('public.employee_state_scope') is not null then
    revoke all on table public.employee_state_scope from anon, authenticated;
  end if;

  if to_regclass('public.superadmin_users') is not null then
    revoke all on table public.superadmin_users from anon, authenticated;
  end if;

  if to_regclass('public.referral_program_settings') is not null then
    revoke all on table public.referral_program_settings from anon, authenticated;
  end if;
end $$;

-- Vendor-owned plan/referral rows. Backend service role still handles all
-- admin/finance actions; these policies only cover any direct authenticated
-- reads from browser clients.
do $$
begin
  if to_regclass('public.vendor_plan_slots') is not null then
    grant select on table public.vendor_plan_slots to authenticated;

    drop policy if exists vendor_plan_slots_select_own on public.vendor_plan_slots;
    create policy vendor_plan_slots_select_own
      on public.vendor_plan_slots
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id = vendor_plan_slots.vendor_id
            and (
              v.user_id = auth.uid()
              or lower(coalesce(v.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.vendor_referral_profiles') is not null then
    grant select on table public.vendor_referral_profiles to authenticated;

    drop policy if exists vendor_referral_profiles_select_own on public.vendor_referral_profiles;
    create policy vendor_referral_profiles_select_own
      on public.vendor_referral_profiles
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id = vendor_referral_profiles.vendor_id
            and (
              v.user_id = auth.uid()
              or lower(coalesce(v.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.vendor_referral_wallets') is not null then
    grant select on table public.vendor_referral_wallets to authenticated;

    drop policy if exists vendor_referral_wallets_select_own on public.vendor_referral_wallets;
    create policy vendor_referral_wallets_select_own
      on public.vendor_referral_wallets
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id = vendor_referral_wallets.vendor_id
            and (
              v.user_id = auth.uid()
              or lower(coalesce(v.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.vendor_referral_wallet_ledger') is not null then
    grant select on table public.vendor_referral_wallet_ledger to authenticated;

    drop policy if exists vendor_referral_wallet_ledger_select_own on public.vendor_referral_wallet_ledger;
    create policy vendor_referral_wallet_ledger_select_own
      on public.vendor_referral_wallet_ledger
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id = vendor_referral_wallet_ledger.vendor_id
            and (
              v.user_id = auth.uid()
              or lower(coalesce(v.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.vendor_referral_cashout_requests') is not null then
    grant select, insert on table public.vendor_referral_cashout_requests to authenticated;

    drop policy if exists vendor_referral_cashout_requests_select_own on public.vendor_referral_cashout_requests;
    create policy vendor_referral_cashout_requests_select_own
      on public.vendor_referral_cashout_requests
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id = vendor_referral_cashout_requests.vendor_id
            and (
              v.user_id = auth.uid()
              or lower(coalesce(v.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
      );

    drop policy if exists vendor_referral_cashout_requests_insert_own on public.vendor_referral_cashout_requests;
    create policy vendor_referral_cashout_requests_insert_own
      on public.vendor_referral_cashout_requests
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.vendors v
          where v.id = vendor_referral_cashout_requests.vendor_id
            and (
              v.user_id = auth.uid()
              or lower(coalesce(v.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.vendor_referrals') is not null then
    grant select on table public.vendor_referrals to authenticated;

    drop policy if exists vendor_referrals_select_related_vendor on public.vendor_referrals;
    create policy vendor_referrals_select_related_vendor
      on public.vendor_referrals
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id in (vendor_referrals.referrer_vendor_id, vendor_referrals.referred_vendor_id)
            and (
              v.user_id = auth.uid()
              or lower(coalesce(v.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
      );
  end if;
end $$;
