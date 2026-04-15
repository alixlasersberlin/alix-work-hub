
CREATE TABLE public.deleted_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_customer_id text NOT NULL,
  source_system text NOT NULL,
  company_name text,
  deleted_by uuid REFERENCES public.user_profiles(id),
  deleted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(external_customer_id, source_system)
);

ALTER TABLE public.deleted_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authorized roles can read deleted customers"
ON public.deleted_customers FOR SELECT
TO authenticated
USING (can_access_orders());

CREATE POLICY "admins can insert deleted customers"
ON public.deleted_customers FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "admins can delete deleted customers"
ON public.deleted_customers FOR DELETE
TO authenticated
USING (is_admin());
