-- ============ Tenant CMR ============
INSERT INTO public.tenants (code, name, country, currency, flag_emoji, zoho_source_system, is_active, sort_order)
SELECT 'CMR', 'Cloud Marketing Research', 'AE', 'AED', '🇦🇪', NULL, true,
       COALESCE((SELECT MAX(sort_order) FROM public.tenants), 0) + 10
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE code = 'CMR');

-- ============ Zugriffshelfer ============
CREATE OR REPLACE FUNCTION public.cmr_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE code = 'CMR' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_access(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin')
      OR public.has_role('Admin')
      OR EXISTS (
           SELECT 1 FROM public.user_tenant_access uta
            WHERE uta.user_id = (SELECT auth.uid()) AND uta.tenant_id = _tenant_id
         )
$$;

CREATE OR REPLACE FUNCTION public.touch_cmr_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ Einstellungen ============
CREATE TABLE public.cmr_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT 'Cloud Marketing Research',
  address_line1 text, address_line2 text, address_line3 text,
  city text, country text,
  phone text, whatsapp text, website text, email text,
  logo_url text, watermark_url text,
  color_primary text DEFAULT '#C9A227',
  color_secondary text DEFAULT '#0F172A',
  font_family text DEFAULT 'Inter',
  header_html text, footer_html text,
  bank_name text, bank_iban text, bank_bic text, bank_account text,
  tax_rate numeric NOT NULL DEFAULT 5,
  tax_note text,
  payment_terms text,
  default_currency text NOT NULL DEFAULT 'AED',
  email_from_name text DEFAULT 'Cloud Marketing Research',
  email_from_address text DEFAULT 'dubai@cmresearch.ae',
  email_reply_to text DEFAULT 'dubai@cmresearch.ae',
  email_signature text,
  smtp_host text, smtp_port integer, smtp_user text, smtp_secure boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_settings TO authenticated;
GRANT ALL ON public.cmr_settings TO service_role;
ALTER TABLE public.cmr_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_settings_read" ON public.cmr_settings FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_settings_write" ON public.cmr_settings FOR INSERT TO authenticated WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_settings_update" ON public.cmr_settings FOR UPDATE TO authenticated USING (public.has_tenant_access(tenant_id)) WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_settings_delete" ON public.cmr_settings FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_cmr_settings_touch BEFORE UPDATE ON public.cmr_settings FOR EACH ROW EXECUTE FUNCTION public.touch_cmr_updated_at();

INSERT INTO public.cmr_settings (tenant_id, address_line1, address_line2, address_line3, city, country, phone, whatsapp, website, email, payment_terms, tax_note)
SELECT id, 'Building A1', 'Dubai Digital Park', 'Dubai Silicon Oasis', 'Dubai', 'United Arab Emirates',
       '+971 254 9559', '+971 254 9559', 'https://cmresearch.ae', 'dubai@cmresearch.ae',
       'Zahlbar innerhalb von 14 Tagen ohne Abzug.', 'VAT 5% (UAE)'
FROM public.tenants WHERE code = 'CMR';

-- ============ Nummernkreise ============
CREATE TABLE public.cmr_number_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  prefix text NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  padding integer NOT NULL DEFAULT 6,
  next_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, doc_type, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_number_ranges TO authenticated;
GRANT ALL ON public.cmr_number_ranges TO service_role;
ALTER TABLE public.cmr_number_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_nr_read" ON public.cmr_number_ranges FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_nr_insert" ON public.cmr_number_ranges FOR INSERT TO authenticated WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_nr_update" ON public.cmr_number_ranges FOR UPDATE TO authenticated USING (public.has_tenant_access(tenant_id)) WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_nr_delete" ON public.cmr_number_ranges FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_cmr_nr_touch BEFORE UPDATE ON public.cmr_number_ranges FOR EACH ROW EXECUTE FUNCTION public.touch_cmr_updated_at();

INSERT INTO public.cmr_number_ranges (tenant_id, doc_type, prefix)
SELECT t.id, d.doc_type, d.prefix
FROM public.tenants t
CROSS JOIN (VALUES
  ('angebot','CMR-AN'), ('auftragsbestaetigung','CMR-AB'), ('rechnung','CMR-RG'),
  ('gutschrift','CMR-GS'), ('lieferschein','CMR-LS'), ('vertrag','CMR-VT'),
  ('mahnung','CMR-MA'), ('zahlungserinnerung','CMR-ZE'), ('proforma','CMR-PF'),
  ('serviceauftrag','CMR-SA')
) AS d(doc_type, prefix)
WHERE t.code = 'CMR';

CREATE OR REPLACE FUNCTION public.cmr_next_document_number(_tenant_id uuid, _doc_type text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year int := EXTRACT(YEAR FROM now()); v_row public.cmr_number_ranges%ROWTYPE; v_prefix text;
BEGIN
  IF NOT public.has_tenant_access(_tenant_id) THEN RAISE EXCEPTION 'Nicht berechtigt'; END IF;
  SELECT prefix INTO v_prefix FROM public.cmr_number_ranges
   WHERE tenant_id = _tenant_id AND doc_type = _doc_type ORDER BY year DESC LIMIT 1;
  IF v_prefix IS NULL THEN v_prefix := 'CMR-DOC'; END IF;

  INSERT INTO public.cmr_number_ranges (tenant_id, doc_type, prefix, year, next_number)
  VALUES (_tenant_id, _doc_type, v_prefix, v_year, 1)
  ON CONFLICT (tenant_id, doc_type, year)
  DO UPDATE SET next_number = public.cmr_number_ranges.next_number + 1, updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row.prefix || '-' || v_row.year || '-' || lpad(v_row.next_number::text, v_row.padding, '0');
END $$;
REVOKE EXECUTE ON FUNCTION public.cmr_next_document_number(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cmr_next_document_number(uuid, text) TO authenticated, service_role;

-- ============ Artikelstamm ============
CREATE TABLE public.cmr_item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_item_categories TO authenticated;
GRANT ALL ON public.cmr_item_categories TO service_role;
ALTER TABLE public.cmr_item_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_cat_read" ON public.cmr_item_categories FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_cat_insert" ON public.cmr_item_categories FOR INSERT TO authenticated WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_cat_update" ON public.cmr_item_categories FOR UPDATE TO authenticated USING (public.has_tenant_access(tenant_id)) WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_cat_delete" ON public.cmr_item_categories FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_cmr_cat_touch BEFORE UPDATE ON public.cmr_item_categories FOR EACH ROW EXECUTE FUNCTION public.touch_cmr_updated_at();

INSERT INTO public.cmr_item_categories (tenant_id, name, sort_order)
SELECT t.id, c.name, c.ord FROM public.tenants t
CROSS JOIN (VALUES
 ('Social Media',10),('Meta Ads',20),('Google Ads',30),('Webseiten',40),('SEO',50),('SEA',60),
 ('Hosting',70),('Domains',80),('Grafikdesign',90),('Print',100),('Flyer',110),('Videos',120),
 ('Fotos',130),('KI-Dienstleistungen',140),('Wartungsverträge',150),('Marketingpakete',160),
 ('Beratung',170),('Schulungen',180)) AS c(name, ord)
WHERE t.code = 'CMR';

CREATE TABLE public.cmr_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.cmr_item_categories(id) ON DELETE SET NULL,
  sku text,
  name text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'Stück',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  tax_rate numeric NOT NULL DEFAULT 5,
  is_recurring boolean NOT NULL DEFAULT false,
  billing_interval text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cmr_items_tenant ON public.cmr_items(tenant_id, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_items TO authenticated;
GRANT ALL ON public.cmr_items TO service_role;
ALTER TABLE public.cmr_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_items_read" ON public.cmr_items FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_items_insert" ON public.cmr_items FOR INSERT TO authenticated WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_items_update" ON public.cmr_items FOR UPDATE TO authenticated USING (public.has_tenant_access(tenant_id)) WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_items_delete" ON public.cmr_items FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_cmr_items_touch BEFORE UPDATE ON public.cmr_items FOR EACH ROW EXECUTE FUNCTION public.touch_cmr_updated_at();

-- ============ Geschäftsvorgänge ============
CREATE TABLE public.cmr_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  doc_number text,
  status text NOT NULL DEFAULT 'entwurf',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  billing_address text,
  shipping_address text,
  doc_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  currency text NOT NULL DEFAULT 'AED',
  tax_rate numeric NOT NULL DEFAULT 5,
  net_total numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  gross_total numeric NOT NULL DEFAULT 0,
  paid_total numeric NOT NULL DEFAULT 0,
  reference text,
  notes text,
  internal_notes text,
  parent_document_id uuid REFERENCES public.cmr_documents(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cmr_docs_tenant_type ON public.cmr_documents(tenant_id, doc_type, doc_date DESC);
CREATE INDEX idx_cmr_docs_customer ON public.cmr_documents(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_documents TO authenticated;
GRANT ALL ON public.cmr_documents TO service_role;
ALTER TABLE public.cmr_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_docs_read" ON public.cmr_documents FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_docs_insert" ON public.cmr_documents FOR INSERT TO authenticated WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_docs_update" ON public.cmr_documents FOR UPDATE TO authenticated USING (public.has_tenant_access(tenant_id)) WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_docs_delete" ON public.cmr_documents FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_cmr_docs_touch BEFORE UPDATE ON public.cmr_documents FOR EACH ROW EXECUTE FUNCTION public.touch_cmr_updated_at();

CREATE TABLE public.cmr_document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.cmr_documents(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.cmr_items(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'Stück',
  unit_price numeric NOT NULL DEFAULT 0,
  discount_pct numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 5,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cmr_doc_items_doc ON public.cmr_document_items(document_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_document_items TO authenticated;
GRANT ALL ON public.cmr_document_items TO service_role;
ALTER TABLE public.cmr_document_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_doc_items_all" ON public.cmr_document_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cmr_documents d WHERE d.id = document_id AND public.has_tenant_access(d.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cmr_documents d WHERE d.id = document_id AND public.has_tenant_access(d.tenant_id)));
CREATE TRIGGER trg_cmr_doc_items_touch BEFORE UPDATE ON public.cmr_document_items FOR EACH ROW EXECUTE FUNCTION public.touch_cmr_updated_at();

-- ============ Zahlungen ============
CREATE TABLE public.cmr_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.cmr_documents(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  method text,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cmr_payments_tenant ON public.cmr_payments(tenant_id, paid_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_payments TO authenticated;
GRANT ALL ON public.cmr_payments TO service_role;
ALTER TABLE public.cmr_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_pay_read" ON public.cmr_payments FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_pay_insert" ON public.cmr_payments FOR INSERT TO authenticated WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_pay_update" ON public.cmr_payments FOR UPDATE TO authenticated USING (public.has_tenant_access(tenant_id)) WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_pay_delete" ON public.cmr_payments FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_cmr_pay_touch BEFORE UPDATE ON public.cmr_payments FOR EACH ROW EXECUTE FUNCTION public.touch_cmr_updated_at();

CREATE OR REPLACE FUNCTION public.cmr_sync_paid_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_doc uuid := COALESCE(NEW.document_id, OLD.document_id);
BEGIN
  IF v_doc IS NOT NULL THEN
    UPDATE public.cmr_documents d
       SET paid_total = COALESCE((SELECT SUM(p.amount) FROM public.cmr_payments p WHERE p.document_id = v_doc), 0),
           updated_at = now()
     WHERE d.id = v_doc;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_cmr_pay_sync AFTER INSERT OR UPDATE OR DELETE ON public.cmr_payments
FOR EACH ROW EXECUTE FUNCTION public.cmr_sync_paid_total();

-- ============ PDF- und E-Mail-Vorlagen ============
CREATE TABLE public.cmr_pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  name text NOT NULL,
  header_html text, body_html text, footer_html text,
  accent_color text DEFAULT '#C9A227',
  font_family text DEFAULT 'Inter',
  logo_url text, watermark_url text,
  show_qr boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_pdf_templates TO authenticated;
GRANT ALL ON public.cmr_pdf_templates TO service_role;
ALTER TABLE public.cmr_pdf_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_pdf_read" ON public.cmr_pdf_templates FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_pdf_insert" ON public.cmr_pdf_templates FOR INSERT TO authenticated WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_pdf_update" ON public.cmr_pdf_templates FOR UPDATE TO authenticated USING (public.has_tenant_access(tenant_id)) WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_pdf_delete" ON public.cmr_pdf_templates FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_cmr_pdf_touch BEFORE UPDATE ON public.cmr_pdf_templates FOR EACH ROW EXECUTE FUNCTION public.touch_cmr_updated_at();

CREATE TABLE public.cmr_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_email_templates TO authenticated;
GRANT ALL ON public.cmr_email_templates TO service_role;
ALTER TABLE public.cmr_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr_mail_read" ON public.cmr_email_templates FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_mail_insert" ON public.cmr_email_templates FOR INSERT TO authenticated WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_mail_update" ON public.cmr_email_templates FOR UPDATE TO authenticated USING (public.has_tenant_access(tenant_id)) WITH CHECK (public.has_tenant_access(tenant_id));
CREATE POLICY "cmr_mail_delete" ON public.cmr_email_templates FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
CREATE TRIGGER trg_cmr_mail_touch BEFORE UPDATE ON public.cmr_email_templates FOR EACH ROW EXECUTE FUNCTION public.touch_cmr_updated_at();

INSERT INTO public.cmr_email_templates (tenant_id, key, name, subject, body_html)
SELECT t.id, x.key, x.name, x.subject, x.body
FROM public.tenants t CROSS JOIN (VALUES
 ('angebot','Angebot versenden','Ihr Angebot {{doc_number}} – Cloud Marketing Research','<p>Sehr geehrte Damen und Herren,</p><p>anbei erhalten Sie unser Angebot {{doc_number}}.</p><p>Mit freundlichen Grüßen<br/>Cloud Marketing Research</p>'),
 ('rechnung','Rechnung versenden','Ihre Rechnung {{doc_number}} – Cloud Marketing Research','<p>Sehr geehrte Damen und Herren,</p><p>anbei erhalten Sie unsere Rechnung {{doc_number}}.</p><p>Mit freundlichen Grüßen<br/>Cloud Marketing Research</p>'),
 ('mahnung','Zahlungserinnerung','Zahlungserinnerung zu {{doc_number}}','<p>Sehr geehrte Damen und Herren,</p><p>zur Rechnung {{doc_number}} konnten wir noch keinen Zahlungseingang feststellen.</p><p>Mit freundlichen Grüßen<br/>Cloud Marketing Research</p>')
) AS x(key,name,subject,body)
WHERE t.code = 'CMR';

-- ============ Dashboard-Kennzahlen ============
CREATE OR REPLACE FUNCTION public.cmr_dashboard_kpis(_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.has_tenant_access(_tenant_id) THEN RAISE EXCEPTION 'Nicht berechtigt'; END IF;
  SELECT jsonb_build_object(
    'revenue_total', COALESCE((SELECT SUM(gross_total) FROM cmr_documents WHERE tenant_id=_tenant_id AND doc_type='rechnung'),0),
    'revenue_year', COALESCE((SELECT SUM(gross_total) FROM cmr_documents WHERE tenant_id=_tenant_id AND doc_type='rechnung' AND doc_date >= date_trunc('year', CURRENT_DATE)),0),
    'revenue_month', COALESCE((SELECT SUM(gross_total) FROM cmr_documents WHERE tenant_id=_tenant_id AND doc_type='rechnung' AND doc_date >= date_trunc('month', CURRENT_DATE)),0),
    'open_invoices_count', COALESCE((SELECT COUNT(*) FROM cmr_documents WHERE tenant_id=_tenant_id AND doc_type='rechnung' AND gross_total - paid_total > 0.01),0),
    'open_invoices_amount', COALESCE((SELECT SUM(gross_total - paid_total) FROM cmr_documents WHERE tenant_id=_tenant_id AND doc_type='rechnung' AND gross_total - paid_total > 0.01),0),
    'open_offers_count', COALESCE((SELECT COUNT(*) FROM cmr_documents WHERE tenant_id=_tenant_id AND doc_type='angebot' AND status NOT IN ('angenommen','abgelehnt','storniert')),0),
    'open_offers_amount', COALESCE((SELECT SUM(gross_total) FROM cmr_documents WHERE tenant_id=_tenant_id AND doc_type='angebot' AND status NOT IN ('angenommen','abgelehnt','storniert')),0),
    'running_projects', COALESCE((SELECT COUNT(*) FROM cmr_documents WHERE tenant_id=_tenant_id AND doc_type='auftragsbestaetigung' AND status NOT IN ('abgeschlossen','storniert')),0),
    'active_items', COALESCE((SELECT COUNT(*) FROM cmr_items WHERE tenant_id=_tenant_id AND is_active),0),
    'customers_count', COALESCE((SELECT COUNT(DISTINCT customer_id) FROM cmr_documents WHERE tenant_id=_tenant_id AND customer_id IS NOT NULL),0),
    'new_customers_month', COALESCE((SELECT COUNT(DISTINCT customer_id) FROM cmr_documents WHERE tenant_id=_tenant_id AND customer_id IS NOT NULL AND created_at >= date_trunc('month', now())),0),
    'monthly', COALESCE((SELECT jsonb_agg(m ORDER BY m->>'month') FROM (
        SELECT jsonb_build_object('month', to_char(date_trunc('month', doc_date),'YYYY-MM'), 'amount', SUM(gross_total)) AS m
        FROM cmr_documents WHERE tenant_id=_tenant_id AND doc_type='rechnung' AND doc_date >= (CURRENT_DATE - INTERVAL '12 months')
        GROUP BY 1) s), '[]'::jsonb)
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.cmr_dashboard_kpis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cmr_dashboard_kpis(uuid) TO authenticated, service_role;