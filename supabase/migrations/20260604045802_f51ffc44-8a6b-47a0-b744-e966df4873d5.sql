CREATE TABLE public.zoho_recurring_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  zoho_recurring_invoice_id text NOT NULL,
  recurrence_name text,
  reference_number text,
  status text,
  customer_id text,
  customer_name text,
  company_name text,
  email text,
  salesperson_name text,
  recurrence_frequency text,
  repeat_every integer,
  start_date date,
  end_date date,
  next_invoice_date date,
  last_sent_date date,
  total numeric,
  sub_total numeric,
  currency text,
  device_name text,
  line_items jsonb,
  raw_data jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, zoho_recurring_invoice_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoho_recurring_profiles TO authenticated;
GRANT ALL ON public.zoho_recurring_profiles TO service_role;

ALTER TABLE public.zoho_recurring_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance can read recurring profiles"
  ON public.zoho_recurring_profiles FOR SELECT
  TO authenticated
  USING (can_access_finance());

CREATE POLICY "admins can insert recurring profiles"
  ON public.zoho_recurring_profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "admins can update recurring profiles"
  ON public.zoho_recurring_profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "only super admin can delete recurring profiles"
  ON public.zoho_recurring_profiles FOR DELETE
  TO authenticated
  USING (has_role('Super Admin'));

CREATE TRIGGER trg_zoho_recurring_profiles_updated_at
  BEFORE UPDATE ON public.zoho_recurring_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_zoho_recurring_profiles_status ON public.zoho_recurring_profiles(status);
CREATE INDEX idx_zoho_recurring_profiles_source ON public.zoho_recurring_profiles(source_system);
CREATE INDEX idx_zoho_recurring_profiles_next ON public.zoho_recurring_profiles(next_invoice_date);
