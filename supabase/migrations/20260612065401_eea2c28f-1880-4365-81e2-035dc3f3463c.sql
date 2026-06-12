
-- 1) alix_sign_requests --------------------------------------------------
CREATE TABLE public.alix_sign_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number text NOT NULL,
  offer_payload jsonb NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email text,
  customer_name text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'erstellt'
    CHECK (status IN ('erstellt','gesendet','geöffnet','unterschrieben','abgelehnt','abgelaufen','umgewandelt')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  opened_at timestamptz,
  signed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alix_sign_requests_token ON public.alix_sign_requests(token);
CREATE INDEX idx_alix_sign_requests_offer_number ON public.alix_sign_requests(offer_number);
CREATE INDEX idx_alix_sign_requests_status ON public.alix_sign_requests(status);
CREATE INDEX idx_alix_sign_requests_customer_id ON public.alix_sign_requests(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alix_sign_requests TO authenticated;
GRANT ALL ON public.alix_sign_requests TO service_role;

ALTER TABLE public.alix_sign_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_use_alix_sign()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin()
      OR public.has_role('Order')
      OR public.has_role('Vertrieb')
      OR public.has_role('Finance')
      OR public.has_role('Geschäftsführung');
$$;

CREATE POLICY "alix_sign_requests_select" ON public.alix_sign_requests
  FOR SELECT TO authenticated USING (public.can_use_alix_sign());
CREATE POLICY "alix_sign_requests_insert" ON public.alix_sign_requests
  FOR INSERT TO authenticated WITH CHECK (public.can_use_alix_sign());
CREATE POLICY "alix_sign_requests_update" ON public.alix_sign_requests
  FOR UPDATE TO authenticated USING (public.can_use_alix_sign())
  WITH CHECK (public.can_use_alix_sign());
CREATE POLICY "alix_sign_requests_delete" ON public.alix_sign_requests
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_alix_sign_requests_updated_at
  BEFORE UPDATE ON public.alix_sign_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2) alix_sign_signatures ------------------------------------------------
CREATE TABLE public.alix_sign_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sign_request_id uuid NOT NULL REFERENCES public.alix_sign_requests(id) ON DELETE CASCADE,
  offer_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  signer_location text,
  signature_image_data text,   -- base64 data URL (PNG)
  ip_address inet,
  user_agent text,
  accepted_offer boolean NOT NULL DEFAULT false,
  accepted_terms boolean NOT NULL DEFAULT false,
  accepted_privacy boolean NOT NULL DEFAULT false,
  accepted_electronic_signature boolean NOT NULL DEFAULT false,
  accepted_credit_check boolean,
  pdf_data bytea,              -- signiertes PDF
  pdf_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alix_sign_signatures_request ON public.alix_sign_signatures(sign_request_id);
CREATE INDEX idx_alix_sign_signatures_offer_number ON public.alix_sign_signatures(offer_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alix_sign_signatures TO authenticated;
GRANT ALL ON public.alix_sign_signatures TO service_role;

ALTER TABLE public.alix_sign_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alix_sign_signatures_select" ON public.alix_sign_signatures
  FOR SELECT TO authenticated USING (public.can_use_alix_sign());
CREATE POLICY "alix_sign_signatures_insert" ON public.alix_sign_signatures
  FOR INSERT TO authenticated WITH CHECK (public.can_use_alix_sign());
CREATE POLICY "alix_sign_signatures_update" ON public.alix_sign_signatures
  FOR UPDATE TO authenticated USING (public.can_use_alix_sign())
  WITH CHECK (public.can_use_alix_sign());
CREATE POLICY "alix_sign_signatures_delete" ON public.alix_sign_signatures
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));


-- 3) alix_sign_audit_log -------------------------------------------------
CREATE TABLE public.alix_sign_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sign_request_id uuid REFERENCES public.alix_sign_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alix_sign_audit_log_request ON public.alix_sign_audit_log(sign_request_id);
CREATE INDEX idx_alix_sign_audit_log_action ON public.alix_sign_audit_log(action);

GRANT SELECT, INSERT ON public.alix_sign_audit_log TO authenticated;
GRANT ALL ON public.alix_sign_audit_log TO service_role;

ALTER TABLE public.alix_sign_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alix_sign_audit_select" ON public.alix_sign_audit_log
  FOR SELECT TO authenticated USING (public.can_use_alix_sign());
CREATE POLICY "alix_sign_audit_insert" ON public.alix_sign_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.can_use_alix_sign());
CREATE POLICY "alix_sign_audit_delete" ON public.alix_sign_audit_log
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
