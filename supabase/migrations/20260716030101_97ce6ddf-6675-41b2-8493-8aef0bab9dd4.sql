
-- =====================================================================
-- Customer Portal Phase 2+ Foundation
-- =====================================================================

-- Helper: does current auth user belong to a portal customer? (already exists as current_portal_customer_id)
-- We add a small helper to check "same customer" cleanly.
CREATE OR REPLACE FUNCTION public.is_portal_customer(_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _customer_id IS NOT NULL
     AND _customer_id = public.current_portal_customer_id();
$$;
REVOKE ALL ON FUNCTION public.is_portal_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_portal_customer(uuid) TO authenticated, service_role;

-- =====================================================================
-- 1) Add visibility / portal columns on existing tables
-- =====================================================================
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS customer_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS portal_pdf_hash text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_name text,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_reason text;

ALTER TABLE public.finance_contracts
  ADD COLUMN IF NOT EXISTS customer_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_status text,
  ADD COLUMN IF NOT EXISTS signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS contract_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.device_maintenance
  ADD COLUMN IF NOT EXISTS customer_visible boolean NOT NULL DEFAULT false;

ALTER TABLE public.warranty_records
  ADD COLUMN IF NOT EXISTS customer_visible boolean NOT NULL DEFAULT false;

ALTER TABLE public.warranty_decisions
  ADD COLUMN IF NOT EXISTS customer_visible boolean NOT NULL DEFAULT false;

-- =====================================================================
-- 2) Portal SELECT policies on existing tables (customer-visible only)
-- =====================================================================
DROP POLICY IF EXISTS portal_customer_select_own_offers ON public.offers;
CREATE POLICY portal_customer_select_own_offers ON public.offers
FOR SELECT TO authenticated
USING (customer_visible = true AND customer_id = public.current_portal_customer_id());

DROP POLICY IF EXISTS portal_customer_update_own_offers ON public.offers;
CREATE POLICY portal_customer_update_own_offers ON public.offers
FOR UPDATE TO authenticated
USING (customer_visible = true AND customer_id = public.current_portal_customer_id())
WITH CHECK (customer_visible = true AND customer_id = public.current_portal_customer_id());

DROP POLICY IF EXISTS portal_customer_select_own_warranty ON public.warranty_records;
CREATE POLICY portal_customer_select_own_warranty ON public.warranty_records
FOR SELECT TO authenticated
USING (customer_visible = true AND customer_id = public.current_portal_customer_id());

DROP POLICY IF EXISTS portal_customer_select_own_warranty_decisions ON public.warranty_decisions;
CREATE POLICY portal_customer_select_own_warranty_decisions ON public.warranty_decisions
FOR SELECT TO authenticated
USING (customer_visible = true AND customer_id = public.current_portal_customer_id());

-- Restrict existing device_maintenance portal read to only customer_visible rows.
DROP POLICY IF EXISTS portal_customer_select_own_maintenance ON public.device_maintenance;
CREATE POLICY portal_customer_select_own_maintenance ON public.device_maintenance
FOR SELECT TO authenticated
USING (customer_visible = true AND customer_id = public.current_portal_customer_id());

-- =====================================================================
-- 3) customer_portal_offer_acceptances (immutable proof)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_offer_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE RESTRICT,
  offer_version integer NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL,
  accepted_by_name text NOT NULL,
  accepted_by_role text,
  consent_text text NOT NULL,
  pdf_hash text,
  ip_address text,
  user_agent text,
  action text NOT NULL DEFAULT 'accepted' CHECK (action IN ('accepted','declined')),
  decline_reason text,
  decline_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_portal_offer_acceptances TO authenticated;
GRANT ALL ON public.customer_portal_offer_acceptances TO service_role;
ALTER TABLE public.customer_portal_offer_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpoa_select_own ON public.customer_portal_offer_acceptances
FOR SELECT TO authenticated
USING (customer_id = public.current_portal_customer_id());

-- INSERT only via portal-offer-accept / portal-offer-decline edge functions (service_role).
-- Keep a WITH CHECK that also allows the customer themselves iff they own the offer AND
-- pass their own auth.uid()+customer_id. Client should still prefer the edge function.
CREATE POLICY cpoa_insert_own ON public.customer_portal_offer_acceptances
FOR INSERT TO authenticated
WITH CHECK (
  customer_id = public.current_portal_customer_id()
  AND auth_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_id
      AND o.customer_id = customer_id
      AND o.customer_visible = true
  )
);

-- No UPDATE / DELETE for anyone but service_role (immutable).

-- =====================================================================
-- 4) customer_portal_contract_signatures (immutable proof)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.finance_contracts(id) ON DELETE RESTRICT,
  contract_version integer NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL,
  signed_by_name text NOT NULL,
  signed_by_role text,
  signature_storage_path text,
  pdf_hash text,
  otp_challenge_id uuid,
  consents jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_portal_contract_signatures TO authenticated;
GRANT ALL ON public.customer_portal_contract_signatures TO service_role;
ALTER TABLE public.customer_portal_contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpcs_select_own ON public.customer_portal_contract_signatures
FOR SELECT TO authenticated
USING (customer_id = public.current_portal_customer_id());

-- Insert allowed only through edge function (service_role) — deny for authenticated by omitting policy.
-- Explicit deny not needed; without WITH CHECK policy INSERT is blocked for authenticated.

-- =====================================================================
-- 5) Secure messages (threads + messages)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  department text NOT NULL CHECK (department IN ('service','accounting','sales','contracts','training','privacy')),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','archived')),
  archived_by_customer boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customer_portal_message_threads TO authenticated;
GRANT ALL ON public.customer_portal_message_threads TO service_role;
ALTER TABLE public.customer_portal_message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpmt_select_own ON public.customer_portal_message_threads
FOR SELECT TO authenticated
USING (customer_id = public.current_portal_customer_id());

CREATE POLICY cpmt_insert_own ON public.customer_portal_message_threads
FOR INSERT TO authenticated
WITH CHECK (customer_id = public.current_portal_customer_id() AND created_by = auth.uid());

-- Only allow updating archived_by_customer flag (implicit via UPDATE, checked by app logic).
CREATE POLICY cpmt_update_own_archive ON public.customer_portal_message_threads
FOR UPDATE TO authenticated
USING (customer_id = public.current_portal_customer_id())
WITH CHECK (customer_id = public.current_portal_customer_id());

CREATE TABLE IF NOT EXISTS public.customer_portal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.customer_portal_message_threads(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  from_role text NOT NULL CHECK (from_role IN ('customer','staff','system')),
  author_id uuid,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customer_portal_messages TO authenticated;
GRANT ALL ON public.customer_portal_messages TO service_role;
ALTER TABLE public.customer_portal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpm_select_own ON public.customer_portal_messages
FOR SELECT TO authenticated
USING (customer_id = public.current_portal_customer_id());

CREATE POLICY cpm_insert_own ON public.customer_portal_messages
FOR INSERT TO authenticated
WITH CHECK (
  customer_id = public.current_portal_customer_id()
  AND from_role = 'customer'
  AND author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.customer_portal_message_threads t
    WHERE t.id = thread_id AND t.customer_id = customer_id
  )
);

CREATE POLICY cpm_update_own_read ON public.customer_portal_messages
FOR UPDATE TO authenticated
USING (customer_id = public.current_portal_customer_id())
WITH CHECK (customer_id = public.current_portal_customer_id());

-- =====================================================================
-- 6) customer_portal_documents (curated document library)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  device_serial text,
  document_type text NOT NULL,
  document_number text,
  title text NOT NULL,
  description text,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  file_hash text,
  version integer NOT NULL DEFAULT 1,
  customer_visible boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  expires_at timestamptz,
  download_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_portal_documents TO authenticated;
GRANT ALL ON public.customer_portal_documents TO service_role;
ALTER TABLE public.customer_portal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpd_select_own_visible ON public.customer_portal_documents
FOR SELECT TO authenticated
USING (
  customer_visible = true
  AND customer_id = public.current_portal_customer_id()
  AND (expires_at IS NULL OR expires_at > now())
);

-- =====================================================================
-- 7) customer_portal_notifications
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text,
  target_route text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  category text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.customer_portal_notifications TO authenticated;
GRANT ALL ON public.customer_portal_notifications TO service_role;
ALTER TABLE public.customer_portal_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpn_select_own ON public.customer_portal_notifications
FOR SELECT TO authenticated
USING (customer_id = public.current_portal_customer_id());

CREATE POLICY cpn_update_own_read ON public.customer_portal_notifications
FOR UPDATE TO authenticated
USING (customer_id = public.current_portal_customer_id())
WITH CHECK (customer_id = public.current_portal_customer_id());

-- =====================================================================
-- 8) customer_portal_maintenance_requests
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  device_serial text,
  device_name text,
  preferred_period text,
  preferred_weekday text,
  preferred_time text,
  site_address text,
  contact_name text,
  contact_phone text,
  issue_description text NOT NULL,
  device_operable boolean,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_note text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','scheduled','done','cancelled')),
  linked_ticket_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_portal_maintenance_requests TO authenticated;
GRANT ALL ON public.customer_portal_maintenance_requests TO service_role;
ALTER TABLE public.customer_portal_maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpmr_select_own ON public.customer_portal_maintenance_requests
FOR SELECT TO authenticated
USING (customer_id = public.current_portal_customer_id());

CREATE POLICY cpmr_insert_own ON public.customer_portal_maintenance_requests
FOR INSERT TO authenticated
WITH CHECK (customer_id = public.current_portal_customer_id() AND created_by = auth.uid());

-- =====================================================================
-- 9) customer_portal_data_requests (GDPR)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('access','correction','deletion','portability','objection','other')),
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','answered','rejected','closed')),
  handled_by uuid,
  handled_at timestamptz,
  handler_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_portal_data_requests TO authenticated;
GRANT ALL ON public.customer_portal_data_requests TO service_role;
ALTER TABLE public.customer_portal_data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpdr_select_own ON public.customer_portal_data_requests
FOR SELECT TO authenticated
USING (customer_id = public.current_portal_customer_id() AND auth_user_id = auth.uid());

CREATE POLICY cpdr_insert_own ON public.customer_portal_data_requests
FOR INSERT TO authenticated
WITH CHECK (customer_id = public.current_portal_customer_id() AND auth_user_id = auth.uid());

-- =====================================================================
-- 10) updated_at triggers
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $f$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $f$ LANGUAGE plpgsql SET search_path = public;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_cpmt_updated_at') THEN
    CREATE TRIGGER trg_cpmt_updated_at BEFORE UPDATE ON public.customer_portal_message_threads
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_cpd_updated_at') THEN
    CREATE TRIGGER trg_cpd_updated_at BEFORE UPDATE ON public.customer_portal_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_cpmr_updated_at') THEN
    CREATE TRIGGER trg_cpmr_updated_at BEFORE UPDATE ON public.customer_portal_maintenance_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_cpdr_updated_at') THEN
    CREATE TRIGGER trg_cpdr_updated_at BEFORE UPDATE ON public.customer_portal_data_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- =====================================================================
-- 11) Helpful indexes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_cpoa_customer_id  ON public.customer_portal_offer_acceptances(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpoa_offer_id     ON public.customer_portal_offer_acceptances(offer_id);
CREATE INDEX IF NOT EXISTS idx_cpcs_customer_id  ON public.customer_portal_contract_signatures(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpcs_contract_id  ON public.customer_portal_contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_cpmt_customer_id  ON public.customer_portal_message_threads(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpm_thread_id     ON public.customer_portal_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_cpm_customer_id   ON public.customer_portal_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpd_customer_id   ON public.customer_portal_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpn_customer_id   ON public.customer_portal_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpmr_customer_id  ON public.customer_portal_maintenance_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpdr_customer_id  ON public.customer_portal_data_requests(customer_id);
