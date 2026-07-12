
-- Helper trigger function (inline; project has no shared update_updated_at_column)
CREATE OR REPLACE FUNCTION public.tg_customer_bank_details_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.customer_bank_details (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  iban TEXT,
  bic TEXT,
  bank_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_bank_details TO authenticated;
GRANT ALL ON public.customer_bank_details TO service_role;

ALTER TABLE public.customer_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance roles read customer bank details"
  ON public.customer_bank_details FOR SELECT
  TO authenticated
  USING (public.can_access_finance() OR public.has_role('Finanzierungen'));

CREATE POLICY "finance roles insert customer bank details"
  ON public.customer_bank_details FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_finance() OR public.has_role('Finanzierungen'));

CREATE POLICY "finance roles update customer bank details"
  ON public.customer_bank_details FOR UPDATE
  TO authenticated
  USING (public.can_access_finance() OR public.has_role('Finanzierungen'))
  WITH CHECK (public.can_access_finance() OR public.has_role('Finanzierungen'));

CREATE POLICY "super admin deletes customer bank details"
  ON public.customer_bank_details FOR DELETE
  TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_customer_bank_details_updated_at
  BEFORE UPDATE ON public.customer_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.tg_customer_bank_details_touch();

INSERT INTO public.customer_bank_details (customer_id, iban, bic, bank_name)
SELECT id, iban, bic, bank_name
FROM public.customers
WHERE iban IS NOT NULL OR bic IS NOT NULL OR bank_name IS NOT NULL
ON CONFLICT (customer_id) DO NOTHING;

ALTER TABLE public.customers DROP COLUMN IF EXISTS iban;
ALTER TABLE public.customers DROP COLUMN IF EXISTS bic;
ALTER TABLE public.customers DROP COLUMN IF EXISTS bank_name;
