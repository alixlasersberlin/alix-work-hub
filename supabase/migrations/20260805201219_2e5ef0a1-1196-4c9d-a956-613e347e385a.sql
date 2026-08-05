
-- Rolle
INSERT INTO public.roles (name, description)
SELECT 'License Manager', 'Verwaltung von Marken, Lizenzverträgen, Royalty-Sätzen und Intercompany-Rechnungen'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'License Manager');

-- Mandant
INSERT INTO public.tenants (code, name, country, currency, flag_emoji, zoho_source_system, is_active, sort_order,
  legal_name, address_line1, address_line2, postal_code, city, country_name, website, email, accent_color)
SELECT 'LIC', 'Alix License', 'AE', 'EUR', '🇦🇪', NULL, true, 70,
  'ALIX LASERS LICENSING L.L.C-FZ', 'MEYDAN GRANDSTAND, 6TH FLOOR', 'MEYDAN ROAD, NAD AL SHEBA', NULL, 'DUBAI',
  'UNITED ARAB EMIRATES', 'https://alixlicence.com', 'office@alixlicence.com', '#C8A24A'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE code = 'LIC');

-- Kennzeichnung als Systemmandant
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_system_tenant boolean NOT NULL DEFAULT false;
UPDATE public.tenants SET is_system_tenant = true WHERE code = 'LIC';

-- Hilfsfunktion Rechte
CREATE OR REPLACE FUNCTION public.can_manage_license()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('License Manager');
$$;

-- Nummernkreise
CREATE TABLE IF NOT EXISTS public.license_number_ranges (
  prefix text NOT NULL,
  year integer NOT NULL,
  last_no integer NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);
GRANT SELECT ON public.license_number_ranges TO authenticated;
GRANT ALL ON public.license_number_ranges TO service_role;
ALTER TABLE public.license_number_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "license_number_ranges_select" ON public.license_number_ranges FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.license_next_number(p_prefix text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year integer := EXTRACT(YEAR FROM now())::int; v_no integer;
BEGIN
  INSERT INTO public.license_number_ranges (prefix, year, last_no)
  VALUES (p_prefix, v_year, 1)
  ON CONFLICT (prefix, year) DO UPDATE SET last_no = public.license_number_ranges.last_no + 1
  RETURNING last_no INTO v_no;
  RETURN p_prefix || '-' || v_year || '-' || lpad(v_no::text, 6, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.license_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Marken
CREATE TABLE public.brand_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  owner_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  registration_number text,
  jurisdiction text,
  valid_from date,
  valid_to date,
  status text NOT NULL DEFAULT 'aktiv',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_registry TO authenticated;
GRANT ALL ON public.brand_registry TO service_role;
ALTER TABLE public.brand_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_registry_select" ON public.brand_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "brand_registry_write" ON public.brand_registry FOR INSERT TO authenticated WITH CHECK (public.can_manage_license());
CREATE POLICY "brand_registry_update" ON public.brand_registry FOR UPDATE TO authenticated USING (public.can_manage_license()) WITH CHECK (public.can_manage_license());
CREATE POLICY "brand_registry_delete" ON public.brand_registry FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_brand_registry_touch BEFORE UPDATE ON public.brand_registry FOR EACH ROW EXECUTE FUNCTION public.license_touch_updated_at();

-- Lizenzverträge
CREATE TABLE public.license_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text UNIQUE,
  licensor_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  licensee_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brand_registry(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  license_model text NOT NULL DEFAULT 'percent',
  royalty_percent numeric(10,4) DEFAULT 0,
  rate_per_unit numeric(14,2) DEFAULT 0,
  minimum_royalty numeric(14,2) DEFAULT 0,
  payment_terms_days integer DEFAULT 14,
  auto_renew boolean NOT NULL DEFAULT true,
  billing_mode text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'aktiv',
  document_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_contracts TO authenticated;
GRANT ALL ON public.license_contracts TO service_role;
ALTER TABLE public.license_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "license_contracts_select" ON public.license_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "license_contracts_insert" ON public.license_contracts FOR INSERT TO authenticated WITH CHECK (public.can_manage_license());
CREATE POLICY "license_contracts_update" ON public.license_contracts FOR UPDATE TO authenticated USING (public.can_manage_license()) WITH CHECK (public.can_manage_license());
CREATE POLICY "license_contracts_delete" ON public.license_contracts FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_license_contracts_touch BEFORE UPDATE ON public.license_contracts FOR EACH ROW EXECUTE FUNCTION public.license_touch_updated_at();

CREATE OR REPLACE FUNCTION public.license_assign_contract_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    NEW.contract_number := public.license_next_number('LIC-CON');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_license_contract_number BEFORE INSERT ON public.license_contracts FOR EACH ROW EXECUTE FUNCTION public.license_assign_contract_number();

-- Royalty-Sätze
CREATE TABLE public.license_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.license_contracts(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brand_registry(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  sku text,
  product_name text,
  license_model text NOT NULL DEFAULT 'percent',
  rate_percent numeric(10,4) DEFAULT 0,
  rate_per_unit numeric(14,2) DEFAULT 0,
  min_amount numeric(14,2) DEFAULT 0,
  valid_from date,
  valid_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_rates TO authenticated;
GRANT ALL ON public.license_rates TO service_role;
ALTER TABLE public.license_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "license_rates_select" ON public.license_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "license_rates_insert" ON public.license_rates FOR INSERT TO authenticated WITH CHECK (public.can_manage_license());
CREATE POLICY "license_rates_update" ON public.license_rates FOR UPDATE TO authenticated USING (public.can_manage_license()) WITH CHECK (public.can_manage_license());
CREATE POLICY "license_rates_delete" ON public.license_rates FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_license_rates_touch BEFORE UPDATE ON public.license_rates FOR EACH ROW EXECUTE FUNCTION public.license_touch_updated_at();

-- Produktlizenzen (Artikelstamm-Erweiterung, ohne bestehende Tabellen zu ändern)
CREATE TABLE public.license_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  sku text,
  item_name text NOT NULL,
  is_licensable boolean NOT NULL DEFAULT true,
  licensor_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brand_registry(id) ON DELETE SET NULL,
  license_model text NOT NULL DEFAULT 'percent',
  rate_percent numeric(10,4) DEFAULT 0,
  rate_per_unit numeric(14,2) DEFAULT 0,
  min_amount numeric(14,2) DEFAULT 0,
  per_device boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_license_products_item ON public.license_products (coalesce(catalog_item_id::text, lower(coalesce(sku, item_name))));
CREATE INDEX idx_license_products_sku ON public.license_products (lower(sku));
CREATE INDEX idx_license_products_name ON public.license_products (lower(item_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_products TO authenticated;
GRANT ALL ON public.license_products TO service_role;
ALTER TABLE public.license_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "license_products_select" ON public.license_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "license_products_insert" ON public.license_products FOR INSERT TO authenticated WITH CHECK (public.can_manage_license());
CREATE POLICY "license_products_update" ON public.license_products FOR UPDATE TO authenticated USING (public.can_manage_license()) WITH CHECK (public.can_manage_license());
CREATE POLICY "license_products_delete" ON public.license_products FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_license_products_touch BEFORE UPDATE ON public.license_products FOR EACH ROW EXECUTE FUNCTION public.license_touch_updated_at();

-- Lizenzrechnungen
CREATE TABLE public.license_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  licensor_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  licensee_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.license_contracts(id) ON DELETE SET NULL,
  period_start date,
  period_end date,
  invoice_date date NOT NULL DEFAULT current_date,
  due_date date,
  amount_net numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'entwurf',
  paid_at timestamptz,
  pdf_path text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_invoices TO authenticated;
GRANT ALL ON public.license_invoices TO service_role;
ALTER TABLE public.license_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "license_invoices_select" ON public.license_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "license_invoices_insert" ON public.license_invoices FOR INSERT TO authenticated WITH CHECK (public.can_manage_license());
CREATE POLICY "license_invoices_update" ON public.license_invoices FOR UPDATE TO authenticated USING (public.can_manage_license()) WITH CHECK (public.can_manage_license());
CREATE POLICY "license_invoices_delete" ON public.license_invoices FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_license_invoices_touch BEFORE UPDATE ON public.license_invoices FOR EACH ROW EXECUTE FUNCTION public.license_touch_updated_at();

CREATE OR REPLACE FUNCTION public.license_assign_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.license_next_number('LIC-RG');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_license_invoice_number BEFORE INSERT ON public.license_invoices FOR EACH ROW EXECUTE FUNCTION public.license_assign_invoice_number();

-- Royalty-Buchungen
CREATE TABLE public.royalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  royalty_number text UNIQUE,
  licensor_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  licensee_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.license_contracts(id) ON DELETE SET NULL,
  license_product_id uuid REFERENCES public.license_products(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brand_registry(id) ON DELETE SET NULL,
  source_system text,
  source_invoice_id uuid,
  source_invoice_number text,
  source_invoice_date date,
  order_number text,
  product_sku text,
  product_name text,
  serial_number text,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  license_model text NOT NULL DEFAULT 'percent',
  rate_percent numeric(10,4) DEFAULT 0,
  rate_per_unit numeric(14,2) DEFAULT 0,
  royalty_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'offen',
  license_invoice_id uuid REFERENCES public.license_invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_royalty_source_line ON public.royalty_transactions (source_invoice_number, lower(coalesce(product_sku, product_name)), coalesce(serial_number, ''));
CREATE INDEX idx_royalty_date ON public.royalty_transactions (source_invoice_date DESC);
CREATE INDEX idx_royalty_status ON public.royalty_transactions (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.royalty_transactions TO authenticated;
GRANT ALL ON public.royalty_transactions TO service_role;
ALTER TABLE public.royalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "royalty_transactions_select" ON public.royalty_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "royalty_transactions_insert" ON public.royalty_transactions FOR INSERT TO authenticated WITH CHECK (public.can_manage_license());
CREATE POLICY "royalty_transactions_update" ON public.royalty_transactions FOR UPDATE TO authenticated USING (public.can_manage_license()) WITH CHECK (public.can_manage_license());
CREATE POLICY "royalty_transactions_delete" ON public.royalty_transactions FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_royalty_touch BEFORE UPDATE ON public.royalty_transactions FOR EACH ROW EXECUTE FUNCTION public.license_touch_updated_at();

CREATE OR REPLACE FUNCTION public.license_assign_royalty_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.royalty_number IS NULL OR NEW.royalty_number = '' THEN
    NEW.royalty_number := public.license_next_number('LIC-ROY');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_royalty_number BEFORE INSERT ON public.royalty_transactions FOR EACH ROW EXECUTE FUNCTION public.license_assign_royalty_number();

-- Rechnungspositionen
CREATE TABLE public.license_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.license_invoices(id) ON DELETE CASCADE,
  royalty_transaction_id uuid REFERENCES public.royalty_transactions(id) ON DELETE SET NULL,
  description text NOT NULL,
  product_name text,
  serial_number text,
  source_invoice_number text,
  base_amount numeric(14,2) DEFAULT 0,
  rate_percent numeric(10,4) DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_license_invoice_items_invoice ON public.license_invoice_items (invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_invoice_items TO authenticated;
GRANT ALL ON public.license_invoice_items TO service_role;
ALTER TABLE public.license_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "license_invoice_items_select" ON public.license_invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "license_invoice_items_insert" ON public.license_invoice_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_license());
CREATE POLICY "license_invoice_items_update" ON public.license_invoice_items FOR UPDATE TO authenticated USING (public.can_manage_license()) WITH CHECK (public.can_manage_license());
CREATE POLICY "license_invoice_items_delete" ON public.license_invoice_items FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- Intercompany-Rechnungen
CREATE TABLE public.intercompany_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  from_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  to_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  license_invoice_id uuid REFERENCES public.license_invoices(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'lizenz',
  invoice_date date NOT NULL DEFAULT current_date,
  due_date date,
  amount_net numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'offen',
  paid_at timestamptz,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intercompany_invoices TO authenticated;
GRANT ALL ON public.intercompany_invoices TO service_role;
ALTER TABLE public.intercompany_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intercompany_invoices_select" ON public.intercompany_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "intercompany_invoices_insert" ON public.intercompany_invoices FOR INSERT TO authenticated WITH CHECK (public.can_manage_license());
CREATE POLICY "intercompany_invoices_update" ON public.intercompany_invoices FOR UPDATE TO authenticated USING (public.can_manage_license()) WITH CHECK (public.can_manage_license());
CREATE POLICY "intercompany_invoices_delete" ON public.intercompany_invoices FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_intercompany_touch BEFORE UPDATE ON public.intercompany_invoices FOR EACH ROW EXECUTE FUNCTION public.license_touch_updated_at();

CREATE OR REPLACE FUNCTION public.license_assign_ic_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.license_next_number('LIC-IC');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_ic_number BEFORE INSERT ON public.intercompany_invoices FOR EACH ROW EXECUTE FUNCTION public.license_assign_ic_number();

-- Einstellungen
CREATE TABLE public.license_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_mode text NOT NULL DEFAULT 'monthly',
  auto_generate boolean NOT NULL DEFAULT true,
  default_rate_percent numeric(10,4) NOT NULL DEFAULT 5,
  payment_terms_days integer NOT NULL DEFAULT 14,
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_settings TO authenticated;
GRANT ALL ON public.license_settings TO service_role;
ALTER TABLE public.license_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "license_settings_select" ON public.license_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "license_settings_insert" ON public.license_settings FOR INSERT TO authenticated WITH CHECK (public.can_manage_license());
CREATE POLICY "license_settings_update" ON public.license_settings FOR UPDATE TO authenticated USING (public.can_manage_license()) WITH CHECK (public.can_manage_license());
CREATE TRIGGER trg_license_settings_touch BEFORE UPDATE ON public.license_settings FOR EACH ROW EXECUTE FUNCTION public.license_touch_updated_at();

-- Revisionssicheres Protokoll
CREATE TABLE public.license_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_license_audit_created ON public.license_audit_log (created_at DESC);
GRANT SELECT, INSERT ON public.license_audit_log TO authenticated;
GRANT ALL ON public.license_audit_log TO service_role;
ALTER TABLE public.license_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "license_audit_select" ON public.license_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "license_audit_insert" ON public.license_audit_log FOR INSERT TO authenticated WITH CHECK (true);
