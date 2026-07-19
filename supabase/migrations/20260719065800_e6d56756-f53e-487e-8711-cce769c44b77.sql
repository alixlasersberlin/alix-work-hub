
CREATE TABLE IF NOT EXISTS public.orders_missing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  external_order_id text NOT NULL,
  order_number text,
  zoho_date date,
  zoho_status text,
  customer_name text,
  total numeric,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  seen_count integer NOT NULL DEFAULT 1,
  import_status text NOT NULL DEFAULT 'pending',
  import_error text,
  imported_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, external_order_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders_missing TO authenticated;
GRANT ALL ON public.orders_missing TO service_role;

ALTER TABLE public.orders_missing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_missing_select_priv"
  ON public.orders_missing FOR SELECT
  TO authenticated
  USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Order')
  );

CREATE POLICY "orders_missing_modify_priv"
  ON public.orders_missing FOR ALL
  TO authenticated
  USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
  )
  WITH CHECK (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
  );

CREATE INDEX IF NOT EXISTS idx_orders_missing_status ON public.orders_missing(import_status);
CREATE INDEX IF NOT EXISTS idx_orders_missing_source ON public.orders_missing(source_system);

CREATE TRIGGER trg_orders_missing_updated_at
  BEFORE UPDATE ON public.orders_missing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
