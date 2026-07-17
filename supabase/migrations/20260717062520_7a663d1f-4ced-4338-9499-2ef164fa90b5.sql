
ALTER TABLE public.sig_templates
  ADD COLUMN IF NOT EXISTS default_expiry_days integer DEFAULT 14,
  ADD COLUMN IF NOT EXISTS default_message text,
  ADD COLUMN IF NOT EXISTS preview_thumb_url text,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS sample_pdf_path text;

CREATE TABLE IF NOT EXISTS public.sig_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.sig_templates(id) ON DELETE CASCADE,
  page_index integer NOT NULL DEFAULT 0,
  x numeric NOT NULL, y numeric NOT NULL, width numeric NOT NULL, height numeric NOT NULL,
  field_type text NOT NULL,
  signer_index integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT true,
  default_value text, label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_template_fields TO authenticated;
GRANT ALL ON public.sig_template_fields TO service_role;
ALTER TABLE public.sig_template_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tpl_fields_read" ON public.sig_template_fields;
CREATE POLICY "tpl_fields_read" ON public.sig_template_fields FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tpl_fields_write_admin" ON public.sig_template_fields;
CREATE POLICY "tpl_fields_write_admin" ON public.sig_template_fields FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE INDEX IF NOT EXISTS idx_sig_template_fields_tpl ON public.sig_template_fields(template_id);

ALTER TABLE public.sig_audit_log
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS entry_hash text;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.sig_audit_log_chain()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE last_hash text; payload text;
BEGIN
  SELECT entry_hash INTO last_hash FROM public.sig_audit_log
  WHERE (NEW.document_id IS NULL OR document_id = NEW.document_id)
  ORDER BY created_at DESC, id DESC LIMIT 1;
  NEW.prev_hash := COALESCE(last_hash, '');
  payload := COALESCE(NEW.prev_hash,'') || '|' || NEW.event || '|' ||
             COALESCE(NEW.document_id::text,'') || '|' || COALESCE(NEW.request_id::text,'') || '|' ||
             COALESCE(NEW.signer_id::text,'') || '|' || COALESCE(NEW.actor_email,'') || '|' ||
             COALESCE(NEW.ip_address,'') || '|' || COALESCE(NEW.details::text,'{}');
  NEW.entry_hash := encode(digest(payload::bytea, 'sha256'), 'hex');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_sig_audit_log_chain ON public.sig_audit_log;
CREATE TRIGGER trg_sig_audit_log_chain BEFORE INSERT ON public.sig_audit_log
FOR EACH ROW EXECUTE FUNCTION public.sig_audit_log_chain();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS signature_status text, ADD COLUMN IF NOT EXISTS signature_signed_at timestamptz, ADD COLUMN IF NOT EXISTS signature_document_id uuid;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS signature_status text, ADD COLUMN IF NOT EXISTS signature_signed_at timestamptz, ADD COLUMN IF NOT EXISTS signature_document_id uuid;
ALTER TABLE public.repair_orders ADD COLUMN IF NOT EXISTS signature_status text, ADD COLUMN IF NOT EXISTS signature_signed_at timestamptz, ADD COLUMN IF NOT EXISTS signature_document_id uuid;
ALTER TABLE public.maintenance_confirmations ADD COLUMN IF NOT EXISTS signature_status text, ADD COLUMN IF NOT EXISTS signature_signed_at timestamptz, ADD COLUMN IF NOT EXISTS signature_document_id uuid;
ALTER TABLE public.finance_incoming_invoices ADD COLUMN IF NOT EXISTS signature_status text, ADD COLUMN IF NOT EXISTS signature_signed_at timestamptz, ADD COLUMN IF NOT EXISTS signature_document_id uuid;

CREATE OR REPLACE FUNCTION public.is_portal_customer(_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.customer_portal_users WHERE customer_id = _customer_id AND user_id = auth.uid());
$$;

DROP POLICY IF EXISTS "sig_docs_portal_read" ON public.sig_documents;
CREATE POLICY "sig_docs_portal_read" ON public.sig_documents FOR SELECT TO authenticated
  USING (customer_id IS NOT NULL AND public.is_portal_customer(customer_id));
DROP POLICY IF EXISTS "sig_requests_portal_read" ON public.sig_requests;
CREATE POLICY "sig_requests_portal_read" ON public.sig_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sig_documents d WHERE d.id = sig_requests.document_id AND d.customer_id IS NOT NULL AND public.is_portal_customer(d.customer_id)));
DROP POLICY IF EXISTS "sig_signatures_portal_read" ON public.sig_signatures;
CREATE POLICY "sig_signatures_portal_read" ON public.sig_signatures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sig_requests r JOIN public.sig_documents d ON d.id = r.document_id
                 WHERE r.id = sig_signatures.request_id AND d.customer_id IS NOT NULL AND public.is_portal_customer(d.customer_id)));

INSERT INTO public.app_settings (key, value)
SELECT 'sig_tsa_config', jsonb_build_object('enabled', false, 'url', '', 'auth_header', '')
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'sig_tsa_config');
