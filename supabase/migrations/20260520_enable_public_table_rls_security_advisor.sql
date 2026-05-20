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
    'referral_program_settings',
    'lead_contacts',
    'sales_vendor_engagements',
    'lead_status_history',
    'subscription_extension_requests',
    'buyers',
    'kyc_documents',
    'buyer_notifications',
    'geo_divisions',
    'vendor_coupon_usages',
    'quotation_emails',
    'geo_division_pincodes',
    'quotation_unregistered',
    'vendor_services',
    'vendor_subscriptions',
    'vp_manager_division_allocations',
    'manager_sales_division_allocations',
    'vendor_division_map',
    'vendor_lead_quota_backup_20260222',
    'chat_blocks',
    'categories',
    'chatbot_history',
    'platform_feedback',
    'geo_postal_raw',
    'product_videos',
    'requirements',
    'quotes',
    'favorites'
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
      ('regions', 'regions_public_read'),
      ('categories', 'categories_public_read'),
      ('geo_divisions', 'geo_divisions_public_read'),
      ('geo_division_pincodes', 'geo_division_pincodes_public_read'),
      ('vendor_services', 'vendor_services_public_read'),
      ('product_videos', 'product_videos_public_read')
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
        user_id = (select auth.uid())
        or lower(coalesce(email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
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
              b.user_id = (select auth.uid())
              or lower(coalesce(b.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
        or exists (
          select 1
          from public.vendors v
          where v.id = proposals.vendor_id
            and (
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
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

  if to_regclass('public.sales_vendor_engagements') is not null then
    revoke all on table public.sales_vendor_engagements from anon, authenticated;
  end if;

  if to_regclass('public.subscription_extension_requests') is not null then
    revoke all on table public.subscription_extension_requests from anon, authenticated;
  end if;

  if to_regclass('public.vendor_coupon_usages') is not null then
    revoke all on table public.vendor_coupon_usages from anon, authenticated;
  end if;

  if to_regclass('public.quotation_emails') is not null then
    revoke all on table public.quotation_emails from anon, authenticated;
  end if;

  if to_regclass('public.quotation_unregistered') is not null then
    revoke all on table public.quotation_unregistered from anon, authenticated;
  end if;

  if to_regclass('public.vendor_subscriptions') is not null then
    revoke all on table public.vendor_subscriptions from anon, authenticated;
  end if;

  if to_regclass('public.vp_manager_division_allocations') is not null then
    revoke all on table public.vp_manager_division_allocations from anon, authenticated;
  end if;

  if to_regclass('public.manager_sales_division_allocations') is not null then
    revoke all on table public.manager_sales_division_allocations from anon, authenticated;
  end if;

  if to_regclass('public.geo_postal_raw') is not null then
    revoke all on table public.geo_postal_raw from anon, authenticated;
  end if;

  if to_regclass('public.vendor_lead_quota_backup_20260222') is not null then
    revoke all on table public.vendor_lead_quota_backup_20260222 from anon, authenticated;
  end if;
end $$;

-- Remove policies that triggered the "RLS references user metadata" advisor
-- warning for buyers. Use (select auth.uid()) and top-level JWT email instead.
do $$
declare
  policy_item record;
begin
  if to_regclass('public.buyers') is not null then
    for policy_item in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'buyers'
        and (
          coalesce(qual, '') ilike '%user_metadata%'
          or coalesce(with_check, '') ilike '%user_metadata%'
          or coalesce(qual, '') ilike '%raw_user_meta_data%'
          or coalesce(with_check, '') ilike '%raw_user_meta_data%'
        )
    loop
      execute format('drop policy if exists %I on public.buyers', policy_item.policyname);
    end loop;

    grant select, update on table public.buyers to authenticated;

    drop policy if exists buyers_select_own_safe on public.buyers;
    create policy buyers_select_own_safe
      on public.buyers
      for select
      to authenticated
      using (
        user_id = (select auth.uid())
        or lower(coalesce(email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      );

    drop policy if exists buyers_update_own_safe on public.buyers;
    create policy buyers_update_own_safe
      on public.buyers
      for update
      to authenticated
      using (
        user_id = (select auth.uid())
        or lower(coalesce(email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      )
      with check (
        user_id = (select auth.uid())
        or lower(coalesce(email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      );
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
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
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
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
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
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
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
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
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
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
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
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
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
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      );
  end if;
end $$;

-- Additional owner-scoped direct browser policies for advisor-reported tables.
do $$
begin
  if to_regclass('public.lead_contacts') is not null then
    grant select, insert, update on table public.lead_contacts to authenticated;

    drop policy if exists lead_contacts_vendor_owner_rw on public.lead_contacts;
    create policy lead_contacts_vendor_owner_rw
      on public.lead_contacts
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id = lead_contacts.vendor_id
            and (
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      )
      with check (
        exists (
          select 1
          from public.vendors v
          where v.id = lead_contacts.vendor_id
            and (
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.lead_status_history') is not null then
    grant select on table public.lead_status_history to authenticated;

    drop policy if exists lead_status_history_vendor_owner_read on public.lead_status_history;
    create policy lead_status_history_vendor_owner_read
      on public.lead_status_history
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id = lead_status_history.vendor_id
            and (
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.kyc_documents') is not null then
    grant select on table public.kyc_documents to authenticated;

    drop policy if exists kyc_documents_vendor_owner_read on public.kyc_documents;
    create policy kyc_documents_vendor_owner_read
      on public.kyc_documents
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id = kyc_documents.vendor_id
            and (
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.buyer_notifications') is not null then
    grant select, update on table public.buyer_notifications to authenticated;

    drop policy if exists buyer_notifications_owner_read_update on public.buyer_notifications;
    create policy buyer_notifications_owner_read_update
      on public.buyer_notifications
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.buyers b
          where b.id = buyer_notifications.buyer_id
            and (
              b.user_id = (select auth.uid())
              or lower(coalesce(b.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      )
      with check (
        exists (
          select 1
          from public.buyers b
          where b.id = buyer_notifications.buyer_id
            and (
              b.user_id = (select auth.uid())
              or lower(coalesce(b.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.vendor_division_map') is not null then
    grant select, insert, update, delete on table public.vendor_division_map to authenticated;

    drop policy if exists vendor_division_map_vendor_owner_read on public.vendor_division_map;
    create policy vendor_division_map_vendor_owner_read
      on public.vendor_division_map
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.vendors v
          where v.id = vendor_division_map.vendor_id
            and (
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      );

    drop policy if exists vendor_division_map_employee_manage on public.vendor_division_map;
    create policy vendor_division_map_employee_manage
      on public.vendor_division_map
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.employees e
          where e.user_id = (select auth.uid())
            and e.role in ('DATA_ENTRY', 'DATAENTRY', 'SUPPORT', 'ADMIN', 'SUPERADMIN')
        )
      )
      with check (
        exists (
          select 1
          from public.employees e
          where e.user_id = (select auth.uid())
            and e.role in ('DATA_ENTRY', 'DATAENTRY', 'SUPPORT', 'ADMIN', 'SUPERADMIN')
        )
      );
  end if;

  if to_regclass('public.quotes') is not null then
    grant select on table public.quotes to authenticated;

    drop policy if exists quotes_related_user_read on public.quotes;
    create policy quotes_related_user_read
      on public.quotes
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.buyers b
          where b.id = quotes.buyer_id
            and (
              b.user_id = (select auth.uid())
              or lower(coalesce(b.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
        or exists (
          select 1
          from public.vendors v
          where v.id = quotes.vendor_id
            and (
              v.user_id = (select auth.uid())
              or lower(coalesce(v.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      );
  end if;

  if to_regclass('public.chatbot_history') is not null then
    grant select, insert on table public.chatbot_history to authenticated;

    drop policy if exists chatbot_history_owner_read_insert on public.chatbot_history;
    create policy chatbot_history_owner_read_insert
      on public.chatbot_history
      for all
      to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.platform_feedback') is not null then
    grant insert on table public.platform_feedback to authenticated;

    drop policy if exists platform_feedback_owner_insert on public.platform_feedback;
    create policy platform_feedback_owner_insert
      on public.platform_feedback
      for insert
      to authenticated
      with check (user_id = (select auth.uid()) or user_id is null);
  end if;

  if to_regclass('public.requirements') is not null then
    grant insert on table public.requirements to anon, authenticated;

    drop policy if exists requirements_public_insert on public.requirements;
    create policy requirements_public_insert
      on public.requirements
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if to_regclass('public.chat_blocks') is not null then
    grant select, insert, delete on table public.chat_blocks to authenticated;
  end if;

  if to_regclass('public.favorites') is not null then
    grant select, insert, delete on table public.favorites to authenticated;

    drop policy if exists favorites_buyer_owner_rw on public.favorites;
    create policy favorites_buyer_owner_rw
      on public.favorites
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.buyers b
          where b.id = favorites.buyer_id
            and (
              b.user_id = (select auth.uid())
              or lower(coalesce(b.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      )
      with check (
        exists (
          select 1
          from public.buyers b
          where b.id = favorites.buyer_id
            and (
              b.user_id = (select auth.uid())
              or lower(coalesce(b.email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
            )
        )
      );
  end if;
end $$;

-- Vendor inserts/updates can fire a geography sync trigger that writes to
-- vendor_division_map. Keep the trigger compatible with RLS-enabled tables.
do $$
begin
  if to_regprocedure('public.sync_vendor_division_map_from_vendor()') is not null then
    alter function public.sync_vendor_division_map_from_vendor() security definer;
    alter function public.sync_vendor_division_map_from_vendor() set search_path = public, pg_temp;
  end if;
end $$;

-- Convert security-definer views reported by the advisor to security invoker.
do $$
declare
  view_name text;
begin
  foreach view_name in array array[
    'marketplace_available_leads',
    'buyer_support_tickets',
    'view_category_hierarchy',
    'public_vendor_plan_badges',
    'admin_users'
  ]
  loop
    if to_regclass(format('public.%I', view_name)) is not null then
      execute format('alter view public.%I set (security_invoker = true)', view_name);
    end if;
  end loop;
end $$;

-- Supabase performance advisor recommends wrapping auth helper calls in a
-- scalar subquery so Postgres can initialize them once per statement.
do $$
declare
  policy_item record;
  next_qual text;
  next_check text;
  alter_sql text;
begin
  for policy_item in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~ 'auth\.(uid|jwt)\(\)'
        or coalesce(with_check, '') ~ 'auth\.(uid|jwt)\(\)'
      )
  loop
    next_qual := replace(replace(policy_item.qual, 'auth.uid()', '(select auth.uid())'), 'auth.jwt()', '(select auth.jwt())');
    next_check := replace(replace(policy_item.with_check, 'auth.uid()', '(select auth.uid())'), 'auth.jwt()', '(select auth.jwt())');

    alter_sql := format(
      'alter policy %I on %I.%I',
      policy_item.policyname,
      policy_item.schemaname,
      policy_item.tablename
    );

    if next_qual is not null then
      alter_sql := alter_sql || format(' using (%s)', next_qual);
    end if;

    if next_check is not null then
      alter_sql := alter_sql || format(' with check (%s)', next_check);
    end if;

    execute alter_sql;
  end loop;
end $$;
