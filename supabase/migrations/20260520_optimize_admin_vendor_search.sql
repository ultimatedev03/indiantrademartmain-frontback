-- Optimize admin vendor search for large vendor tables.
-- Supports partial search by company, owner, email, phone, public vendor id,
-- and exact lookup by internal uuid.

create extension if not exists pg_trgm;

create index if not exists vendors_company_name_trgm_idx
  on public.vendors using gin (company_name gin_trgm_ops);

create index if not exists vendors_owner_name_trgm_idx
  on public.vendors using gin (owner_name gin_trgm_ops);

create index if not exists vendors_vendor_id_trgm_idx
  on public.vendors using gin (vendor_id gin_trgm_ops);

create index if not exists vendors_email_trgm_idx
  on public.vendors using gin (email gin_trgm_ops);

create index if not exists vendors_phone_trgm_idx
  on public.vendors using gin (phone gin_trgm_ops);

create index if not exists vendors_lower_email_idx
  on public.vendors (lower(email));

create index if not exists vendors_created_at_idx
  on public.vendors (created_at desc);

create index if not exists vendors_kyc_status_idx
  on public.vendors (kyc_status);

create index if not exists vendors_is_active_idx
  on public.vendors (is_active);
