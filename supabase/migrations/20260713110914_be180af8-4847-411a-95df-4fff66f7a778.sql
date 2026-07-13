-- 1) Vier-Augen-Freigabe ----------------------------------------------------
CREATE TABLE public.catalog_pending_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,        -- 'item_price' | 'item_description' | 'item' | 'bundle'
  entity_id UUID NOT NULL,
  field_scope TEXT,                 -- optional: z. B. 'sale_gross', 'long_text'
  old_value JSONB,
  new_value JSONB NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | applied | withdrawn
  requested_by UUID,
  approved_by UUID,
  applied_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_pending_changes TO authenticated;
GRANT ALL ON public.catalog_pending_changes TO service_role;

ALTER TABLE public.catalog_pending_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_read_auth" ON public.catalog_pending_changes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pending_insert_catalog" ON public.catalog_pending_changes
  FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text));
CREATE POLICY "pending_update_catalog" ON public.catalog_pending_changes
  FOR UPDATE TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text));
CREATE POLICY "pending_delete_super" ON public.catalog_pending_changes
  FOR DELETE TO authenticated USING (has_role('Super Admin'::text));

CREATE TRIGGER trg_catalog_pending_changes_updated
  BEFORE UPDATE ON public.catalog_pending_changes
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE INDEX idx_catalog_pending_changes_status ON public.catalog_pending_changes(status, created_at DESC);
CREATE INDEX idx_catalog_pending_changes_entity ON public.catalog_pending_changes(entity_type, entity_id);

CREATE TABLE public.catalog_change_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_id UUID NOT NULL REFERENCES public.catalog_pending_changes(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,           -- approve | reject | comment
  comment TEXT,
  decided_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.catalog_change_approvals TO authenticated;
GRANT ALL ON public.catalog_change_approvals TO service_role;

ALTER TABLE public.catalog_change_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approv_read_auth" ON public.catalog_change_approvals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "approv_insert_catalog" ON public.catalog_change_approvals
  FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text));

CREATE INDEX idx_catalog_change_approvals_pending ON public.catalog_change_approvals(pending_id);

-- 2) Portal-Sammelanfrage-Checkout ------------------------------------------
CREATE TABLE public.catalog_portal_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.catalog_portal_inquiries(id) ON DELETE SET NULL,
  customer_id UUID,
  portal_user_id UUID,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  customer_reference TEXT,
  desired_date DATE,
  delivery_address JSONB,
  notes TEXT,
  confirmation_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_portal_checkouts TO authenticated;
GRANT ALL ON public.catalog_portal_checkouts TO service_role;

ALTER TABLE public.catalog_portal_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkout_read_auth" ON public.catalog_portal_checkouts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "checkout_insert_auth" ON public.catalog_portal_checkouts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "checkout_update_staff" ON public.catalog_portal_checkouts
  FOR UPDATE TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Order'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Order'::text));

CREATE TRIGGER trg_catalog_portal_checkouts_updated
  BEFORE UPDATE ON public.catalog_portal_checkouts
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE INDEX idx_catalog_portal_checkouts_status ON public.catalog_portal_checkouts(status, created_at DESC);

-- 3) Kunden-/Preisgruppen ----------------------------------------------------
CREATE TABLE public.catalog_price_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,        -- z. B. 'vip', 'reseller', 'endcustomer'
  name TEXT NOT NULL,
  default_discount_pct NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (default_discount_pct >= 0 AND default_discount_pct <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_price_groups TO authenticated;
GRANT ALL ON public.catalog_price_groups TO service_role;
ALTER TABLE public.catalog_price_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pg_read_auth" ON public.catalog_price_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "pg_write_catalog" ON public.catalog_price_groups FOR ALL TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text));
CREATE TRIGGER trg_catalog_price_groups_updated BEFORE UPDATE ON public.catalog_price_groups
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE TABLE public.catalog_customer_price_group (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  price_group_id UUID NOT NULL REFERENCES public.catalog_price_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_customer_price_group TO authenticated;
GRANT ALL ON public.catalog_customer_price_group TO service_role;
ALTER TABLE public.catalog_customer_price_group ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpg_read_auth" ON public.catalog_customer_price_group FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpg_write_catalog" ON public.catalog_customer_price_group FOR ALL TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text));

CREATE TABLE public.catalog_price_group_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_group_id UUID NOT NULL REFERENCES public.catalog_price_groups(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL,         -- 'country' | 'bundle' | 'item' | 'category'
  scope_id UUID NOT NULL,
  discount_pct NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  fixed_net NUMERIC(12,2),          -- optionaler Festpreis netto
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (price_group_id, scope_type, scope_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_price_group_overrides TO authenticated;
GRANT ALL ON public.catalog_price_group_overrides TO service_role;
ALTER TABLE public.catalog_price_group_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pgo_read_auth" ON public.catalog_price_group_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "pgo_write_catalog" ON public.catalog_price_group_overrides FOR ALL TO authenticated
  USING (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text))
  WITH CHECK (has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text) OR has_role('Katalog Preise'::text));
CREATE TRIGGER trg_catalog_price_group_overrides_updated BEFORE UPDATE ON public.catalog_price_group_overrides
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

CREATE INDEX idx_catalog_price_group_overrides_group ON public.catalog_price_group_overrides(price_group_id, scope_type);