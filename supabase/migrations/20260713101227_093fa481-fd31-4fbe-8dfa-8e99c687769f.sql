
CREATE TABLE public.catalog_portal_cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_user_id UUID NOT NULL REFERENCES public.customer_portal_users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  country_iso TEXT,
  language_code TEXT DEFAULT 'de',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_cart_user ON public.catalog_portal_cart_items(portal_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_portal_cart_items TO authenticated;
GRANT ALL ON public.catalog_portal_cart_items TO service_role;
ALTER TABLE public.catalog_portal_cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_owner_all" ON public.catalog_portal_cart_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_users u WHERE u.id = portal_user_id AND u.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customer_portal_users u WHERE u.id = portal_user_id AND u.user_id = auth.uid()));
CREATE POLICY "cart_admin_read" ON public.catalog_portal_cart_items FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung'));
CREATE TRIGGER trg_catalog_portal_cart_updated_at BEFORE UPDATE ON public.catalog_portal_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE TABLE public.catalog_portal_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_user_id UUID NOT NULL REFERENCES public.customer_portal_users(id) ON DELETE CASCADE,
  inquiry_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'neu',
  message TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  desired_delivery_date DATE,
  country_iso TEXT,
  language_code TEXT DEFAULT 'de',
  assigned_to UUID,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_inq_user ON public.catalog_portal_inquiries(portal_user_id);
CREATE INDEX idx_portal_inq_status ON public.catalog_portal_inquiries(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_portal_inquiries TO authenticated;
GRANT ALL ON public.catalog_portal_inquiries TO service_role;
ALTER TABLE public.catalog_portal_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inq_owner_read" ON public.catalog_portal_inquiries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_users u WHERE u.id = portal_user_id AND u.user_id = auth.uid()));
CREATE POLICY "inq_owner_insert" ON public.catalog_portal_inquiries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.customer_portal_users u WHERE u.id = portal_user_id AND u.user_id = auth.uid()));
CREATE POLICY "inq_staff_all" ON public.catalog_portal_inquiries FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Service'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Service'));
CREATE TRIGGER trg_catalog_portal_inq_updated_at BEFORE UPDATE ON public.catalog_portal_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE TABLE public.catalog_portal_inquiry_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id UUID NOT NULL REFERENCES public.catalog_portal_inquiries(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  snapshot_id UUID REFERENCES public.catalog_item_snapshots(id) ON DELETE SET NULL,
  sku TEXT,
  name TEXT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  note TEXT,
  price_gross NUMERIC(14,2),
  price_net NUMERIC(14,2),
  tax_rate NUMERIC(6,2),
  currency TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_inq_items_inq ON public.catalog_portal_inquiry_items(inquiry_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_portal_inquiry_items TO authenticated;
GRANT ALL ON public.catalog_portal_inquiry_items TO service_role;
ALTER TABLE public.catalog_portal_inquiry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inq_items_owner_all" ON public.catalog_portal_inquiry_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.catalog_portal_inquiries i JOIN public.customer_portal_users u ON u.id = i.portal_user_id WHERE i.id = inquiry_id AND u.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.catalog_portal_inquiries i JOIN public.customer_portal_users u ON u.id = i.portal_user_id WHERE i.id = inquiry_id AND u.user_id = auth.uid()));
CREATE POLICY "inq_items_staff_all" ON public.catalog_portal_inquiry_items FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Service'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Service'));

CREATE OR REPLACE FUNCTION public.catalog_inq_set_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.inquiry_number IS NULL THEN
    NEW.inquiry_number := 'ANF-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_catalog_inq_set_number BEFORE INSERT ON public.catalog_portal_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.catalog_inq_set_number();
