
-- Create order_items table for line items from Zoho
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  external_item_id TEXT,
  item_name TEXT,
  description TEXT,
  sku TEXT,
  quantity NUMERIC DEFAULT 1,
  rate NUMERIC,
  amount NUMERIC,
  discount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  unit TEXT,
  item_order INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint to avoid duplicate line items per order
CREATE UNIQUE INDEX idx_order_items_external ON public.order_items (order_id, external_item_id) WHERE external_item_id IS NOT NULL;

-- Index for fast lookup by order
CREATE INDEX idx_order_items_order_id ON public.order_items (order_id);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Read: same as orders
CREATE POLICY "authorized roles can read order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (can_access_orders());

-- Insert: order managers
CREATE POLICY "authorized roles can insert order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (can_manage_orders());

-- Update: order managers
CREATE POLICY "authorized roles can update order items"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (can_manage_orders())
  WITH CHECK (can_manage_orders());

-- Delete: admins only
CREATE POLICY "admins can delete order items"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (is_admin());
