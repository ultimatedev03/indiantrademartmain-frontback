-- Buyer proposal targeting alignment
-- Adds structured category/location targeting metadata for buyer -> vendor / marketplace requirement flow.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS vendor_email text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS category_slug text,
  ADD COLUMN IF NOT EXISTS micro_category_id uuid REFERENCES public.micro_categories(id),
  ADD COLUMN IF NOT EXISTS sub_category_id uuid REFERENCES public.sub_categories(id),
  ADD COLUMN IF NOT EXISTS head_category_id uuid REFERENCES public.head_categories(id),
  ADD COLUMN IF NOT EXISTS state_id uuid REFERENCES public.states(id),
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id),
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS pincode text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS vendor_email text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS pincode text;

CREATE INDEX IF NOT EXISTS idx_proposals_vendor_id ON public.proposals(vendor_id);
CREATE INDEX IF NOT EXISTS idx_proposals_buyer_id ON public.proposals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_proposals_micro_category_id ON public.proposals(micro_category_id);
CREATE INDEX IF NOT EXISTS idx_proposals_state_id ON public.proposals(state_id);
CREATE INDEX IF NOT EXISTS idx_proposals_city_id ON public.proposals(city_id);
CREATE INDEX IF NOT EXISTS idx_leads_vendor_email ON public.leads(vendor_email);
CREATE INDEX IF NOT EXISTS idx_leads_pincode ON public.leads(pincode);
