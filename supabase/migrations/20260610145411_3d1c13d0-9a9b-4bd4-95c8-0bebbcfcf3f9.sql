
-- ============== FINANCE DOCUMENTS (GoBD Belegarchiv) ==============
CREATE TABLE IF NOT EXISTS public.finance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('Rechnung','Gutschrift','Lieferschein','Mahnung','Lastschriftavis','Kontoauszug','SteuerExport','DATEVExport','XRechnung','ZUGFeRD','Eingangsrechnung','Sonstiges')),
  tenant_id uuid REFERENCES public.tenants(id),
  source_system text,
  customer_id uuid REFERENCES public.customers(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  reference text,
  document_date date NOT NULL DEFAULT current_date,
  amount numeric(14,2),
  currency text DEFAULT 'EUR',
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  hash_sha256 text,
  retention_until date NOT NULL DEFAULT (current_date + interval '10 years'),
  meta jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_documents TO authenticated;
GRANT ALL ON public.finance_documents TO service_role;
ALTER TABLE public.finance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fdocs_select" ON public.finance_documents FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "fdocs_insert" ON public.finance_documents FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fdocs_update" ON public.finance_documents FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Finance'))
WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "fdocs_delete" ON public.finance_documents FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_fdocs_type ON public.finance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_fdocs_customer ON public.finance_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_fdocs_date ON public.finance_documents(document_date DESC);
CREATE INDEX IF NOT EXISTS idx_fdocs_reference ON public.finance_documents(reference);

-- ============== INCOMING INVOICES (Kreditoren Light) ==============
CREATE TABLE IF NOT EXISTS public.finance_incoming_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_number text NOT NULL UNIQUE,
  tenant_id uuid REFERENCES public.tenants(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  supplier_name text NOT NULL,
  supplier_vat_id text,
  supplier_iban text,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  due_date date,
  amount_gross numeric(14,2) NOT NULL,
  amount_net numeric(14,2),
  amount_tax numeric(14,2),
  tax_rate numeric(5,2),
  currency text DEFAULT 'EUR',
  description text,
  status text NOT NULL DEFAULT 'erfasst' CHECK (status IN ('erfasst','geprueft','freigegeben','bezahlt','abgelehnt','storniert')),
  file_path text,
  xml_path text,
  is_einvoice boolean NOT NULL DEFAULT false,
  einvoice_format text,
  parsed_data jsonb,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  paid_at date,
  payment_reference text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_incoming_invoices TO authenticated;
GRANT ALL ON public.finance_incoming_invoices TO service_role;
ALTER TABLE public.finance_incoming_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finc_select" ON public.finance_incoming_invoices FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "finc_insert" ON public.finance_incoming_invoices FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Finance'));
CREATE POLICY "finc_update" ON public.finance_incoming_invoices FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'))
WITH CHECK (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'));
CREATE POLICY "finc_delete" ON public.finance_incoming_invoices FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_finc_updated_at BEFORE UPDATE ON public.finance_incoming_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_finc_status ON public.finance_incoming_invoices(status);
CREATE INDEX IF NOT EXISTS idx_finc_supplier ON public.finance_incoming_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_finc_due ON public.finance_incoming_invoices(due_date);

CREATE SEQUENCE IF NOT EXISTS public.finance_incoming_invoice_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_incoming_invoice_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.internal_number IS NULL OR length(trim(NEW.internal_number)) = 0 THEN
    NEW.internal_number := 'ER-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.finance_incoming_invoice_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_finc_assign_number BEFORE INSERT ON public.finance_incoming_invoices
FOR EACH ROW EXECUTE FUNCTION public.assign_incoming_invoice_number();

-- ============== STORAGE POLICIES (bucket created separately) ==============
CREATE POLICY "fdocs_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'finance-documents' AND (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung')));

CREATE POLICY "fdocs_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'finance-documents' AND (public.is_admin() OR public.has_role('Finance')));

CREATE POLICY "fdocs_storage_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'finance-documents' AND (public.is_admin() OR public.has_role('Finance')));

CREATE POLICY "fdocs_storage_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'finance-documents' AND public.has_role('Super Admin'));
