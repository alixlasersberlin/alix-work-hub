CREATE OR REPLACE FUNCTION public.offers_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number text NOT NULL UNIQUE,
  offer_date date,
  valid_until date,
  customer_id uuid,
  customer_name text,
  customer_email text,
  total_net numeric(14,2) DEFAULT 0,
  total_tax numeric(14,2) DEFAULT 0,
  total_gross numeric(14,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  signed_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_offers_created_at ON public.offers (created_at DESC);
CREATE INDEX idx_offers_customer_id ON public.offers (customer_id);
CREATE INDEX idx_offers_status ON public.offers (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offers_select_all_authenticated"
  ON public.offers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "offers_insert_authenticated"
  ON public.offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "offers_update_creator_or_admin"
  ON public.offers FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Vertriebsleitung')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Vertriebsleitung')
  );

CREATE POLICY "offers_delete_super_admin"
  ON public.offers FOR DELETE
  TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.offers_set_updated_at();