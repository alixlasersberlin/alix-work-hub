
CREATE TYPE public.sig_doc_status AS ENUM (
  'neu','in_bearbeitung','versendet','geoeffnet','teilweise_signiert',
  'signiert','abgelehnt','abgelaufen','archiviert','ungueltig'
);
CREATE TYPE public.sig_channel AS ENUM ('email','portal','link','qr','sms');
CREATE TYPE public.sig_field_type AS ENUM ('signature','initials','date','place','stamp','text','checkbox');
CREATE TYPE public.sig_signer_role AS ENUM (
  'kunde','techniker','verkaeufer','geschaeftsfuehrer','zeuge','partner','lieferant','sonstiges'
);

CREATE OR REPLACE FUNCTION public.sig_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.sig_can_send()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Service')
    OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('After Sales')
    OR public.has_role('Kundenservice');
$$;

CREATE OR REPLACE FUNCTION public.sig_is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin');
$$;

-- 1. sig_stamps
CREATE TABLE public.sig_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('signature','initials','company_stamp','name_stamp')),
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_company_wide boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_stamps TO authenticated;
GRANT ALL ON public.sig_stamps TO service_role;
ALTER TABLE public.sig_stamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_stamps_select" ON public.sig_stamps FOR SELECT TO authenticated
  USING (public.sig_is_admin() OR owner_user_id = auth.uid() OR is_company_wide);
CREATE POLICY "sig_stamps_insert" ON public.sig_stamps FOR INSERT TO authenticated
  WITH CHECK (public.sig_is_admin() OR owner_user_id = auth.uid());
CREATE POLICY "sig_stamps_update" ON public.sig_stamps FOR UPDATE TO authenticated
  USING (public.sig_is_admin() OR owner_user_id = auth.uid())
  WITH CHECK (public.sig_is_admin() OR owner_user_id = auth.uid());
CREATE POLICY "sig_stamps_delete" ON public.sig_stamps FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER sig_stamps_touch BEFORE UPDATE ON public.sig_stamps
  FOR EACH ROW EXECUTE FUNCTION public.sig_touch_updated_at();

-- 2. sig_templates
CREATE TABLE public.sig_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document_type text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_signers jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_templates TO authenticated;
GRANT ALL ON public.sig_templates TO service_role;
ALTER TABLE public.sig_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_templates_read" ON public.sig_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "sig_templates_write" ON public.sig_templates FOR INSERT TO authenticated
  WITH CHECK (public.sig_is_admin());
CREATE POLICY "sig_templates_update" ON public.sig_templates FOR UPDATE TO authenticated
  USING (public.sig_is_admin()) WITH CHECK (public.sig_is_admin());
CREATE POLICY "sig_templates_delete" ON public.sig_templates FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER sig_templates_touch BEFORE UPDATE ON public.sig_templates
  FOR EACH ROW EXECUTE FUNCTION public.sig_touch_updated_at();

-- 3. sig_documents
CREATE TABLE public.sig_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  document_type text NOT NULL,
  entity_type text,
  entity_id text,
  customer_id uuid,
  storage_path text NOT NULL,
  sha256 text,
  version integer NOT NULL DEFAULT 1,
  status public.sig_doc_status NOT NULL DEFAULT 'neu',
  template_id uuid REFERENCES public.sig_templates(id) ON DELETE SET NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  locked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_documents TO authenticated;
GRANT ALL ON public.sig_documents TO service_role;
ALTER TABLE public.sig_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_documents_select" ON public.sig_documents FOR SELECT TO authenticated
  USING (public.sig_is_admin() OR created_by = auth.uid() OR public.sig_can_send());
CREATE POLICY "sig_documents_insert" ON public.sig_documents FOR INSERT TO authenticated
  WITH CHECK (public.sig_can_send() AND created_by = auth.uid());
CREATE POLICY "sig_documents_update" ON public.sig_documents FOR UPDATE TO authenticated
  USING (public.sig_is_admin() OR (created_by = auth.uid() AND locked_at IS NULL))
  WITH CHECK (public.sig_is_admin() OR (created_by = auth.uid() AND locked_at IS NULL));
CREATE POLICY "sig_documents_delete" ON public.sig_documents FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE INDEX sig_documents_status_idx ON public.sig_documents (status);
CREATE INDEX sig_documents_entity_idx ON public.sig_documents (entity_type, entity_id);
CREATE INDEX sig_documents_customer_idx ON public.sig_documents (customer_id);
CREATE TRIGGER sig_documents_touch BEFORE UPDATE ON public.sig_documents
  FOR EACH ROW EXECUTE FUNCTION public.sig_touch_updated_at();

-- 4. sig_document_versions
CREATE TABLE public.sig_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.sig_documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  is_signed_version boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);
GRANT SELECT, INSERT ON public.sig_document_versions TO authenticated;
GRANT ALL ON public.sig_document_versions TO service_role;
ALTER TABLE public.sig_document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_versions_select" ON public.sig_document_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sig_documents d WHERE d.id = document_id
    AND (public.sig_is_admin() OR d.created_by = auth.uid())));
CREATE POLICY "sig_versions_insert" ON public.sig_document_versions FOR INSERT TO authenticated
  WITH CHECK (public.sig_is_admin() OR EXISTS (SELECT 1 FROM public.sig_documents d
    WHERE d.id = document_id AND d.created_by = auth.uid()));

-- 5. sig_requests
CREATE TABLE public.sig_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.sig_documents(id) ON DELETE CASCADE,
  channel public.sig_channel NOT NULL DEFAULT 'email',
  token text NOT NULL UNIQUE,
  otp_required boolean NOT NULL DEFAULT true,
  status public.sig_doc_status NOT NULL DEFAULT 'versendet',
  expires_at timestamptz NOT NULL,
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sig_requests TO authenticated;
GRANT ALL ON public.sig_requests TO service_role;
ALTER TABLE public.sig_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_requests_select" ON public.sig_requests FOR SELECT TO authenticated
  USING (public.sig_is_admin() OR created_by = auth.uid());
CREATE POLICY "sig_requests_insert" ON public.sig_requests FOR INSERT TO authenticated
  WITH CHECK (public.sig_can_send() AND created_by = auth.uid());
CREATE POLICY "sig_requests_update" ON public.sig_requests FOR UPDATE TO authenticated
  USING (public.sig_is_admin() OR created_by = auth.uid())
  WITH CHECK (public.sig_is_admin() OR created_by = auth.uid());
CREATE INDEX sig_requests_document_idx ON public.sig_requests (document_id);
CREATE INDEX sig_requests_status_idx ON public.sig_requests (status);
CREATE TRIGGER sig_requests_touch BEFORE UPDATE ON public.sig_requests
  FOR EACH ROW EXECUTE FUNCTION public.sig_touch_updated_at();

-- 6. sig_signers
CREATE TABLE public.sig_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.sig_requests(id) ON DELETE CASCADE,
  signer_role public.sig_signer_role NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  name text,
  email text,
  phone text,
  is_required boolean NOT NULL DEFAULT true,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sig_signers TO authenticated;
GRANT ALL ON public.sig_signers TO service_role;
ALTER TABLE public.sig_signers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_signers_select" ON public.sig_signers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sig_requests r WHERE r.id = request_id
    AND (public.sig_is_admin() OR r.created_by = auth.uid())));
CREATE POLICY "sig_signers_write" ON public.sig_signers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sig_requests r WHERE r.id = request_id
    AND (public.sig_is_admin() OR r.created_by = auth.uid())));
CREATE POLICY "sig_signers_update" ON public.sig_signers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sig_requests r WHERE r.id = request_id
    AND (public.sig_is_admin() OR r.created_by = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sig_requests r WHERE r.id = request_id
    AND (public.sig_is_admin() OR r.created_by = auth.uid())));
CREATE INDEX sig_signers_request_idx ON public.sig_signers (request_id);

-- 7. sig_signatures
CREATE TABLE public.sig_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.sig_requests(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL REFERENCES public.sig_signers(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_type public.sig_field_type NOT NULL,
  vector_data jsonb,
  png_data text,
  page integer NOT NULL DEFAULT 1,
  x numeric NOT NULL,
  y numeric NOT NULL,
  width numeric NOT NULL,
  height numeric NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  os text,
  country text,
  hash text,
  otp_verified boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT ON public.sig_signatures TO authenticated;
GRANT ALL ON public.sig_signatures TO service_role;
ALTER TABLE public.sig_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_signatures_select" ON public.sig_signatures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sig_requests r WHERE r.id = request_id
    AND (public.sig_is_admin() OR r.created_by = auth.uid())));
CREATE POLICY "sig_signatures_insert_admin" ON public.sig_signatures FOR INSERT TO authenticated
  WITH CHECK (public.sig_is_admin());
CREATE INDEX sig_signatures_request_idx ON public.sig_signatures (request_id);

-- 8. sig_audit_log
CREATE TABLE public.sig_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.sig_documents(id) ON DELETE SET NULL,
  request_id uuid REFERENCES public.sig_requests(id) ON DELETE SET NULL,
  signer_id uuid REFERENCES public.sig_signers(id) ON DELETE SET NULL,
  event text NOT NULL,
  actor_user_id uuid,
  actor_email text,
  ip_address text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sig_audit_log TO authenticated;
GRANT ALL ON public.sig_audit_log TO service_role;
ALTER TABLE public.sig_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_audit_select" ON public.sig_audit_log FOR SELECT TO authenticated
  USING (public.sig_is_admin());
CREATE POLICY "sig_audit_insert" ON public.sig_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.sig_audit_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'sig_audit_log is append-only'; END;
$$;
CREATE TRIGGER sig_audit_no_update BEFORE UPDATE ON public.sig_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.sig_audit_block_mutation();
CREATE TRIGGER sig_audit_no_delete BEFORE DELETE ON public.sig_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.sig_audit_block_mutation();
CREATE INDEX sig_audit_document_idx ON public.sig_audit_log (document_id);
CREATE INDEX sig_audit_request_idx ON public.sig_audit_log (request_id);
CREATE INDEX sig_audit_created_idx ON public.sig_audit_log (created_at DESC);

-- 9. sig_otp_challenges
CREATE TABLE public.sig_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.sig_requests(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL REFERENCES public.sig_signers(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sig_otp_challenges TO authenticated;
GRANT ALL ON public.sig_otp_challenges TO service_role;
ALTER TABLE public.sig_otp_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_otp_admin" ON public.sig_otp_challenges FOR ALL TO authenticated
  USING (public.sig_is_admin()) WITH CHECK (public.sig_is_admin());
CREATE INDEX sig_otp_request_idx ON public.sig_otp_challenges (request_id);

-- 10. sig_reminder_rules
CREATE TABLE public.sig_reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text,
  offsets_hours integer[] NOT NULL DEFAULT ARRAY[24,72,168],
  escalate_to_role text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_reminder_rules TO authenticated;
GRANT ALL ON public.sig_reminder_rules TO service_role;
ALTER TABLE public.sig_reminder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_reminder_rules_read" ON public.sig_reminder_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "sig_reminder_rules_admin" ON public.sig_reminder_rules FOR INSERT TO authenticated
  WITH CHECK (public.sig_is_admin());
CREATE POLICY "sig_reminder_rules_upd" ON public.sig_reminder_rules FOR UPDATE TO authenticated
  USING (public.sig_is_admin()) WITH CHECK (public.sig_is_admin());
CREATE POLICY "sig_reminder_rules_del" ON public.sig_reminder_rules FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));
CREATE TRIGGER sig_reminder_rules_touch BEFORE UPDATE ON public.sig_reminder_rules
  FOR EACH ROW EXECUTE FUNCTION public.sig_touch_updated_at();

-- 11. sig_webhooks
CREATE TABLE public.sig_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['signature.completed'],
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sig_webhooks TO authenticated;
GRANT ALL ON public.sig_webhooks TO service_role;
ALTER TABLE public.sig_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_webhooks_admin" ON public.sig_webhooks FOR ALL TO authenticated
  USING (public.sig_is_admin()) WITH CHECK (public.sig_is_admin());
CREATE TRIGGER sig_webhooks_touch BEFORE UPDATE ON public.sig_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.sig_touch_updated_at();

CREATE TABLE public.sig_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.sig_webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  response_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.sig_webhook_deliveries TO authenticated;
GRANT ALL ON public.sig_webhook_deliveries TO service_role;
ALTER TABLE public.sig_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_webhook_deliveries_admin" ON public.sig_webhook_deliveries FOR ALL TO authenticated
  USING (public.sig_is_admin()) WITH CHECK (public.sig_is_admin());
CREATE INDEX sig_webhook_deliveries_status_idx ON public.sig_webhook_deliveries (status);
