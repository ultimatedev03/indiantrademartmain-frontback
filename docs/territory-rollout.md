# Territory Sales Hierarchy Rollout

This rollout adds VP -> Manager -> Sales division control without changing the existing vendor/buyer/public flow.

## What stays unchanged

- Existing directory, vendor portal, buyer portal, and employee core auth flows remain as-is.
- New territory logic is isolated under dedicated endpoints and role-specific pages.
- Existing sales pages still work; lead source has been switched to territory-scoped masked vendors.

## New capability added

- Geography model: `State -> City -> Division`
- VP can allocate divisions to managers.
- Manager can allocate/rebalance own divisions to sales users.
- Sales users only see masked vendor contact data in their assigned divisions.
- Engagement logging now resolves manager/vp hierarchy automatically for proper reporting.
- Territory screens now show pincode coverage (`division.pincode_count`) and vendor pincode for field execution.

## Hierarchy-wise assignment model

1. `State -> City -> Division` data comes from `geo_divisions` and `geo_division_pincodes`.
2. VP allocates divisions to manager in `vp_manager_division_allocations`.
3. Manager allocates the same scoped divisions to sales in `manager_sales_division_allocations`.
4. Vendor is mapped to a division via `vendor_division_map` (city-first, state fallback).
5. Sales list and engagement logs resolve through `vendor -> division -> manager -> vp`.

## SQL checks (hierarchy + pincode)

```sql
-- Division inventory with hierarchy and pincode volume
select
  s.name as state_name,
  c.name as city_name,
  d.id as division_id,
  d.name as division_name,
  d.pincode_count
from public.geo_divisions d
left join public.states s on s.id = d.state_id
left join public.cities c on c.id = d.city_id
where d.is_active = true
order by s.name, c.name, d.name;

-- VP -> Manager active scope
select
  vma.vp_user_id,
  vma.manager_user_id,
  d.name as division_name,
  c.name as city_name,
  s.name as state_name,
  d.pincode_count
from public.vp_manager_division_allocations vma
join public.geo_divisions d on d.id = vma.division_id
left join public.cities c on c.id = d.city_id
left join public.states s on s.id = d.state_id
where vma.allocation_status = 'ACTIVE'
order by vma.manager_user_id, s.name, c.name, d.name;

-- Manager -> Sales active scope
select
  msa.manager_user_id,
  msa.sales_user_id,
  d.name as division_name,
  c.name as city_name,
  s.name as state_name,
  d.pincode_count
from public.manager_sales_division_allocations msa
join public.geo_divisions d on d.id = msa.division_id
left join public.cities c on c.id = d.city_id
left join public.states s on s.id = d.state_id
where msa.allocation_status = 'ACTIVE'
order by msa.sales_user_id, s.name, c.name, d.name;

-- Vendor coverage (with pincode)
select
  v.id as vendor_id,
  v.company_name,
  v.pincode as vendor_pincode,
  d.name as division_name,
  d.pincode_count
from public.vendors v
left join public.vendor_division_map vm on vm.vendor_id = v.id
left join public.geo_divisions d on d.id = vm.division_id
where coalesce(v.is_active, true) = true
order by v.updated_at desc;
```

## Database objects required

Apply migration:

- `supabase/migrations/20260224_territory_sales_hierarchy.sql`

Creates:

- `geo_postal_raw`
- `geo_divisions`
- `geo_division_pincodes`
- `vp_manager_division_allocations`
- `manager_sales_division_allocations`
- `vendor_division_map`
- `sales_vendor_engagements`

## Postal dataset import

Input data directory (default):

- `C:\Users\Dipanshu pandey\OneDrive\Desktop\Statewise-postal-code`

Commands:

```bash
npm run import:territory-postal -- --dry-run --limit-files=1
npm run import:territory-postal -- --dry-run
npm run import:territory-postal
```

Optional:

```bash
npm run import:territory-postal -- --data-dir="C:\path\to\Statewise-postal-code" --store-raw
```

## UI flow after rollout

1. VP logs in -> `/employee/vp/dashboard` and allocates divisions to managers.
2. Manager logs in -> `/employee/manager/dashboard` and allocates/rebalances divisions to sales staff.
3. Sales logs in -> `/employee/sales/leads` and gets masked vendors from assigned divisions only.
4. Sales logs call/pitch actions -> manager/vp linkage is auto-resolved and visible in engagement pages.

## Validation checklist

1. Create/verify active employees with roles `VP`, `MANAGER`, `SALES`.
2. Confirm divisions exist (`geo_divisions` has rows).
3. Save VP -> Manager allocation.
4. Save Manager -> Sales allocation.
5. Open sales leads and verify:
   - only scoped vendors visible
   - phone/email masked
   - engagement action succeeds
6. Open manager/vp engagements page and verify sales engagement visibility.
