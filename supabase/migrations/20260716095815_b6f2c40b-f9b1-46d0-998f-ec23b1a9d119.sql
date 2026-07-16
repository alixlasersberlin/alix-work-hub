DO $$ BEGIN
  CREATE TYPE public.pdf_import_status AS ENUM (
    'uploaded','analyzing','analyzed','review','committed','cancelled','duplicate','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pdf_import_doc_type AS ENUM (
    'purchase_order','sales_contract','rental_contract','leasing_contract',
    'order_confirmation','offer','financing_order','device_order','service_order','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pdf_order_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  uploaded_by UUID NOT NULL,
  source_filename TEXT NOT NULL,
  source_storage_path TEXT NOT NULL,
  source_size_bytes BIGINT,
  source_mime TEXT,
  document_type public.pdf_import_doc_type NOT NULL DEFAULT 'other',
  document_hash TEXT NOT NULL,
  detected_language TEXT,
  parser_version TEXT,
  ai_model TEXT,
  status public.pdf_import_status NOT NULL DEFAULT 'uploaded',
  overall_confidence NUMERIC(5,2),
  duplicate_risk NUMERIC(5,2),
  duplicate_order_id UUID,
  raw_extraction_json JSONB,
  corrected_extraction_json JSONB,
  warnings_json JSONB,
  validation_results_json JSONB,
  error_message TEXT,
  created_customer_id UUID,
  created_order_id UUID,
  auto_followups JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  analyzed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  imported_at TIMESTAMPTZ,
  imported_by UUID,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_order_imports TO authenticated;
GRANT ALL ON public.pdf_order_imports TO service_role;
ALTER TABLE public.pdf_order_imports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pdfoi_uploaded_by ON public.pdf_order_imports(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_pdfoi_status ON public.pdf_order_imports(status);
CREATE INDEX IF NOT EXISTS idx_pdfoi_hash ON public.pdf_order_imports(document_hash);
CREATE INDEX IF NOT EXISTS idx_pdfoi_created_order ON public.pdf_order_imports(created_order_id);
CREATE INDEX IF NOT EXISTS idx_pdfoi_tenant ON public.pdf_order_imports(tenant_id);

CREATE POLICY "pdfoi_select" ON public.pdf_order_imports FOR SELECT TO authenticated USING (
  uploaded_by = auth.uid()
  OR public.has_role('Super Admin') OR public.has_role('Admin')
  OR public.has_role('Geschäftsführung') OR public.has_role('Order')
);
CREATE POLICY "pdfoi_insert" ON public.pdf_order_imports FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid() AND (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('Geschäftsführung') OR public.has_role('Order')
    OR public.has_role('Vertrieb')
  )
);
CREATE POLICY "pdfoi_update" ON public.pdf_order_imports FOR UPDATE TO authenticated USING (
  uploaded_by = auth.uid()
  OR public.has_role('Super Admin') OR public.has_role('Admin')
  OR public.has_role('Geschäftsführung') OR public.has_role('Order')
);
CREATE POLICY "pdfoi_delete" ON public.pdf_order_imports FOR DELETE TO authenticated USING (
  public.has_role('Super Admin')
);

CREATE OR REPLACE FUNCTION public.can_access_pdf_import(p_import_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pdf_order_imports oi
    WHERE oi.id = p_import_id
      AND (oi.uploaded_by = auth.uid()
        OR public.has_role('Super Admin') OR public.has_role('Admin')
        OR public.has_role('Geschäftsführung') OR public.has_role('Order'))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_pdf_import(p_import_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pdf_order_imports oi
    WHERE oi.id = p_import_id
      AND (oi.uploaded_by = auth.uid()
        OR public.has_role('Super Admin') OR public.has_role('Admin')
        OR public.has_role('Geschäftsführung') OR public.has_role('Order')
        OR public.has_role('Vertrieb'))
  );
$$;

CREATE TABLE IF NOT EXISTS public.pdf_order_import_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_import_id UUID NOT NULL REFERENCES public.pdf_order_imports(id) ON DELETE CASCADE,
  field_group TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT,
  confidence NUMERIC(5,2),
  source_page INT,
  source_text TEXT,
  bounding_box_json JSONB,
  validation_status TEXT,
  manually_changed BOOLEAN NOT NULL DEFAULT false,
  changed_by UUID,
  changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_order_import_fields TO authenticated;
GRANT ALL ON public.pdf_order_import_fields TO service_role;
ALTER TABLE public.pdf_order_import_fields ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pdfoif_import ON public.pdf_order_import_fields(order_import_id);

CREATE POLICY "pdfoif_select" ON public.pdf_order_import_fields FOR SELECT TO authenticated
  USING (public.can_read_pdf_import(order_import_id));
CREATE POLICY "pdfoif_write" ON public.pdf_order_import_fields FOR ALL TO authenticated
  USING (public.can_access_pdf_import(order_import_id))
  WITH CHECK (public.can_access_pdf_import(order_import_id));

CREATE TABLE IF NOT EXISTS public.pdf_order_import_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_import_id UUID NOT NULL REFERENCES public.pdf_order_imports(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  detected_product_name TEXT,
  detected_sku TEXT,
  detected_serial_number TEXT,
  detected_quantity NUMERIC(14,3),
  detected_unit_price NUMERIC(14,2),
  detected_total_price NUMERIC(14,2),
  detected_discount NUMERIC(14,2),
  detected_tax_rate NUMERIC(6,2),
  matched_catalog_item_id UUID,
  match_confidence NUMERIC(5,2),
  match_status TEXT,
  manually_confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_order_import_items TO authenticated;
GRANT ALL ON public.pdf_order_import_items TO service_role;
ALTER TABLE public.pdf_order_import_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pdfoii_import ON public.pdf_order_import_items(order_import_id);

CREATE POLICY "pdfoii_select" ON public.pdf_order_import_items FOR SELECT TO authenticated
  USING (public.can_read_pdf_import(order_import_id));
CREATE POLICY "pdfoii_write" ON public.pdf_order_import_items FOR ALL TO authenticated
  USING (public.can_access_pdf_import(order_import_id))
  WITH CHECK (public.can_access_pdf_import(order_import_id));

CREATE TABLE IF NOT EXISTS public.pdf_order_import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_import_id UUID NOT NULL REFERENCES public.pdf_order_imports(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value_json JSONB,
  new_value_json JSONB,
  user_id UUID,
  ip_address TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pdf_order_import_logs TO authenticated;
GRANT ALL ON public.pdf_order_import_logs TO service_role;
ALTER TABLE public.pdf_order_import_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pdfoil_import ON public.pdf_order_import_logs(order_import_id);

CREATE POLICY "pdfoil_select" ON public.pdf_order_import_logs FOR SELECT TO authenticated
  USING (public.can_read_pdf_import(order_import_id));
CREATE POLICY "pdfoil_insert" ON public.pdf_order_import_logs FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pdf_import(order_import_id));

CREATE OR REPLACE FUNCTION public.set_pdf_import_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_pdfoi_updated_at ON public.pdf_order_imports;
CREATE TRIGGER trg_pdfoi_updated_at BEFORE UPDATE ON public.pdf_order_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_pdf_import_updated_at();

DROP TRIGGER IF EXISTS trg_pdfoii_updated_at ON public.pdf_order_import_items;
CREATE TRIGGER trg_pdfoii_updated_at BEFORE UPDATE ON public.pdf_order_import_items
  FOR EACH ROW EXECUTE FUNCTION public.set_pdf_import_updated_at();

CREATE POLICY "order_imports_storage_select" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'order-imports' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('Geschäftsführung') OR public.has_role('Order')
  )
);
CREATE POLICY "order_imports_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'order-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('Geschäftsführung') OR public.has_role('Order')
    OR public.has_role('Vertrieb')
  )
);
CREATE POLICY "order_imports_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'order-imports' AND public.has_role('Super Admin')
);