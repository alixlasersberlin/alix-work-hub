-- Suppliers (Zulieferer)
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  email text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "admins insert suppliers" ON public.suppliers
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "admins update suppliers" ON public.suppliers
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins delete suppliers" ON public.suppliers
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Production Orders (Bestellungen an Produktion)
CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,            -- Bezug zum Auftrag (orders.id)
  order_number text NOT NULL,        -- Bestellnummer = Auftragsnummer
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  modellname text,
  farbe text NOT NULL,
  power_handstueck text NOT NULL,
  bearbeiter text NOT NULL,
  liefertermin date NOT NULL,
  sonderwuensche text,
  seriennummer text,
  anmerkungen text,
  status text NOT NULL DEFAULT 'offen',
  pdf_path text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read production orders" ON public.production_orders
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "admins insert production orders" ON public.production_orders
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "admins update production orders" ON public.production_orders
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins delete production orders" ON public.production_orders
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER production_orders_updated_at
  BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Übernommene Positionen aus dem Auftrag
CREATE TABLE public.production_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  source_order_item_id uuid,
  item_name text,
  description text,
  sku text,
  quantity numeric DEFAULT 1,
  unit text,
  item_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.production_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read production order items" ON public.production_order_items
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "admins insert production order items" ON public.production_order_items
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "admins update production order items" ON public.production_order_items
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins delete production order items" ON public.production_order_items
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX idx_production_orders_order_id ON public.production_orders(order_id);
CREATE INDEX idx_production_orders_supplier_id ON public.production_orders(supplier_id);
CREATE INDEX idx_production_order_items_po_id ON public.production_order_items(production_order_id);

-- Storage Bucket für Bestell-PDFs (privat)
INSERT INTO storage.buckets (id, name, public)
VALUES ('production-orders', 'production-orders', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admins read production order pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'production-orders' AND is_admin());

CREATE POLICY "admins upload production order pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'production-orders' AND is_admin());

CREATE POLICY "admins update production order pdfs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'production-orders' AND is_admin());

CREATE POLICY "admins delete production order pdfs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'production-orders' AND is_admin());