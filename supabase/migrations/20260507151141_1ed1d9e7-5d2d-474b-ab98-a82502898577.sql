
CREATE TABLE public.zoho_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'zoho_books_eu',
  zoho_item_id text NOT NULL,
  name text,
  sku text,
  description text,
  unit text,
  rate numeric,
  purchase_rate numeric,
  currency_code text,
  status text,
  product_type text,
  item_type text,
  tax_id text,
  tax_name text,
  tax_percentage numeric,
  stock_on_hand numeric,
  available_stock numeric,
  actual_available_stock numeric,
  category_name text,
  brand text,
  manufacturer text,
  image_name text,
  image_type text,
  zoho_created_time timestamptz,
  zoho_last_modified_time timestamptz,
  raw_data jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zoho_items_source_item_unique UNIQUE (source_system, zoho_item_id)
);

CREATE INDEX idx_zoho_items_name ON public.zoho_items (name);
CREATE INDEX idx_zoho_items_sku ON public.zoho_items (sku);
CREATE INDEX idx_zoho_items_status ON public.zoho_items (status);

ALTER TABLE public.zoho_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authorized roles can read zoho items"
ON public.zoho_items FOR SELECT TO authenticated
USING (can_access_orders() OR can_access_finance());

CREATE POLICY "admins can insert zoho items"
ON public.zoho_items FOR INSERT TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "admins can update zoho items"
ON public.zoho_items FOR UPDATE TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins can delete zoho items"
ON public.zoho_items FOR DELETE TO authenticated
USING (is_admin());

CREATE TRIGGER trg_zoho_items_updated_at
BEFORE UPDATE ON public.zoho_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
