
CREATE OR REPLACE FUNCTION public.med_can_write()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role('Super Admin') OR has_role('Admin') OR has_role('Geschäftsführung') OR has_role('Medical');
$$;

CREATE TABLE public.med_item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.med_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  category_id uuid REFERENCES public.med_item_categories(id) ON DELETE SET NULL,
  sku text,
  name text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'Stk',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  tax_rate numeric NOT NULL DEFAULT 19,
  udi_di text,
  mdr_class text,
  ce_number text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.med_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  doc_type text NOT NULL,
  doc_number text,
  status text NOT NULL DEFAULT 'entwurf',
  customer_id uuid,
  customer_name text,
  customer_email text,
  billing_address text,
  shipping_address text,
  doc_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  currency text NOT NULL DEFAULT 'EUR',
  tax_rate numeric NOT NULL DEFAULT 19,
  net_total numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  gross_total numeric NOT NULL DEFAULT 0,
  paid_total numeric NOT NULL DEFAULT 0,
  reference text,
  notes text,
  internal_notes text,
  parent_document_id uuid REFERENCES public.med_documents(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.med_document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.med_documents(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.med_items(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'Stk',
  unit_price numeric NOT NULL DEFAULT 0,
  discount_pct numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 19,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.med_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  document_id uuid REFERENCES public.med_documents(id) ON DELETE CASCADE,
  customer_id uuid,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  method text,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.med_number_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  doc_type text NOT NULL,
  prefix text NOT NULL DEFAULT 'MED',
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  padding integer NOT NULL DEFAULT 4,
  next_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, doc_type, year)
);

CREATE TABLE public.med_compliance_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  doc_kind text NOT NULL,
  title text NOT NULL,
  reference text,
  item_id uuid REFERENCES public.med_items(id) ON DELETE SET NULL,
  valid_from date,
  valid_until date,
  status text NOT NULL DEFAULT 'aktiv',
  file_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_med_items_tenant ON public.med_items(tenant_id);
CREATE INDEX idx_med_documents_tenant_type ON public.med_documents(tenant_id, doc_type, doc_date DESC);
CREATE INDEX idx_med_document_items_doc ON public.med_document_items(document_id);
CREATE INDEX idx_med_payments_doc ON public.med_payments(document_id);
CREATE INDEX idx_med_compliance_tenant ON public.med_compliance_docs(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.med_item_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.med_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.med_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.med_document_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.med_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.med_number_ranges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.med_compliance_docs TO authenticated;
GRANT ALL ON public.med_item_categories, public.med_items, public.med_documents,
  public.med_document_items, public.med_payments, public.med_number_ranges,
  public.med_compliance_docs TO service_role;

ALTER TABLE public.med_item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.med_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.med_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.med_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.med_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.med_number_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.med_compliance_docs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['med_item_categories','med_items','med_documents','med_payments','med_number_ranges','med_compliance_docs'] LOOP
    EXECUTE format('CREATE POLICY %1$s_read ON public.%1$s FOR SELECT TO authenticated USING (has_tenant_access(tenant_id))', t);
    EXECUTE format('CREATE POLICY %1$s_insert ON public.%1$s FOR INSERT TO authenticated WITH CHECK (has_tenant_access(tenant_id) AND med_can_write())', t);
    EXECUTE format('CREATE POLICY %1$s_update ON public.%1$s FOR UPDATE TO authenticated USING (has_tenant_access(tenant_id) AND med_can_write()) WITH CHECK (has_tenant_access(tenant_id) AND med_can_write())', t);
    EXECUTE format('CREATE POLICY %1$s_delete ON public.%1$s FOR DELETE TO authenticated USING (has_role(''Super Admin''))', t);
  END LOOP;
END $$;

CREATE POLICY med_document_items_read ON public.med_document_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.med_documents d WHERE d.id = document_id AND has_tenant_access(d.tenant_id)));
CREATE POLICY med_document_items_insert ON public.med_document_items FOR INSERT TO authenticated
WITH CHECK (med_can_write() AND EXISTS (SELECT 1 FROM public.med_documents d WHERE d.id = document_id AND has_tenant_access(d.tenant_id)));
CREATE POLICY med_document_items_update ON public.med_document_items FOR UPDATE TO authenticated
USING (med_can_write() AND EXISTS (SELECT 1 FROM public.med_documents d WHERE d.id = document_id AND has_tenant_access(d.tenant_id)))
WITH CHECK (med_can_write() AND EXISTS (SELECT 1 FROM public.med_documents d WHERE d.id = document_id AND has_tenant_access(d.tenant_id)));
CREATE POLICY med_document_items_delete ON public.med_document_items FOR DELETE TO authenticated
USING (has_role('Super Admin'));

CREATE TRIGGER trg_med_item_categories_updated BEFORE UPDATE ON public.med_item_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_med_items_updated BEFORE UPDATE ON public.med_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_med_documents_updated BEFORE UPDATE ON public.med_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_med_document_items_updated BEFORE UPDATE ON public.med_document_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_med_payments_updated BEFORE UPDATE ON public.med_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_med_number_ranges_updated BEFORE UPDATE ON public.med_number_ranges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_med_compliance_updated BEFORE UPDATE ON public.med_compliance_docs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.med_number_ranges (tenant_id, doc_type, prefix, year, padding, next_number)
SELECT t.id, x.doc_type, x.prefix, EXTRACT(YEAR FROM now())::int, 4, 1
FROM public.tenants t
CROSS JOIN (VALUES ('angebot','MED-AN'),('auftragsbestaetigung','MED-AB'),('rechnung','MED-RE'),
  ('gutschrift','MED-GS'),('lieferschein','MED-LS'),('serviceauftrag','MED-SV'),('wartung','MED-WA')) AS x(doc_type, prefix)
WHERE t.code = 'MED';
