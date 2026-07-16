
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.alix_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  primary_email citext NOT NULL UNIQUE,
  email_verified_at timestamptz,
  account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('invited','active','suspended','locked','disabled','deletion_requested')),
  account_type text NOT NULL DEFAULT 'customer'
    CHECK (account_type IN ('customer','partner','student','employee','mixed')),
  preferred_language text NOT NULL DEFAULT 'de',
  display_name text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, UPDATE ON public.alix_identities TO authenticated;
GRANT ALL ON public.alix_identities TO service_role;
ALTER TABLE public.alix_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_select_own ON public.alix_identities FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY ai_update_own ON public.alix_identities FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ai_status ON public.alix_identities(account_status);

CREATE TABLE IF NOT EXISTS public.alix_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_type text NOT NULL DEFAULT 'customer'
    CHECK (organization_type IN ('customer','partner','academy','school','studio','subsidiary','internal_department','supplier','other')),
  legal_name text NOT NULL,
  display_name text,
  customer_number text,
  tenant_id uuid,
  linked_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alix_organizations TO authenticated;
GRANT ALL ON public.alix_organizations TO service_role;
ALTER TABLE public.alix_organizations ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ao_customer_number ON public.alix_organizations(customer_number) WHERE customer_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ao_tenant ON public.alix_organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ao_linked_customer ON public.alix_organizations(linked_customer_id);

CREATE TABLE IF NOT EXISTS public.alix_identity_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES public.alix_identities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.alix_organizations(id) ON DELETE CASCADE,
  relationship_type text NOT NULL
    CHECK (relationship_type IN ('owner','managing_director','employee','billing_contact','technical_contact','student','trainer','partner','service_contact','authorized_representative','other')),
  relationship_status text NOT NULL DEFAULT 'active'
    CHECK (relationship_status IN ('invited','active','suspended','expired','revoked')),
  is_primary boolean NOT NULL DEFAULT false,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identity_id, organization_id, relationship_type)
);
GRANT SELECT ON public.alix_identity_organizations TO authenticated;
GRANT ALL ON public.alix_identity_organizations TO service_role;
ALTER TABLE public.alix_identity_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY aio_select_own ON public.alix_identity_organizations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.alix_identities ai WHERE ai.id = alix_identity_organizations.identity_id AND ai.auth_user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_aio_identity ON public.alix_identity_organizations(identity_id);
CREATE INDEX IF NOT EXISTS idx_aio_org ON public.alix_identity_organizations(organization_id);

CREATE POLICY ao_select_linked ON public.alix_organizations FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.alix_identity_organizations io
  JOIN public.alix_identities ai ON ai.id = io.identity_id
  WHERE io.organization_id = alix_organizations.id AND ai.auth_user_id = auth.uid()
));

CREATE TABLE IF NOT EXISTS public.alix_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key text NOT NULL UNIQUE,
  app_name text NOT NULL,
  description text,
  base_url text,
  icon_url text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  allowed_origins text[] NOT NULL DEFAULT '{}',
  app_status text NOT NULL DEFAULT 'inactive'
    CHECK (app_status IN ('active','inactive','maintenance','restricted','disabled')),
  requires_mfa boolean NOT NULL DEFAULT false,
  session_duration_minutes integer NOT NULL DEFAULT 60,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alix_applications TO authenticated;
GRANT ALL ON public.alix_applications TO service_role;
ALTER TABLE public.alix_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_select_all ON public.alix_applications FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.alix_identity_app_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES public.alix_identities(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.alix_organizations(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.alix_applications(id) ON DELETE CASCADE,
  tenant_id uuid,
  access_status text NOT NULL DEFAULT 'active'
    CHECK (access_status IN ('invited','active','suspended','expired','revoked')),
  app_role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid,
  revoked_at timestamptz,
  revoke_reason text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identity_id, organization_id, application_id)
);
GRANT SELECT ON public.alix_identity_app_access TO authenticated;
GRANT ALL ON public.alix_identity_app_access TO service_role;
ALTER TABLE public.alix_identity_app_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY aiaa_select_own ON public.alix_identity_app_access FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.alix_identities ai WHERE ai.id = alix_identity_app_access.identity_id AND ai.auth_user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_aiaa_identity ON public.alix_identity_app_access(identity_id);
CREATE INDEX IF NOT EXISTS idx_aiaa_app ON public.alix_identity_app_access(application_id);
CREATE INDEX IF NOT EXISTS idx_aiaa_status ON public.alix_identity_app_access(access_status);

CREATE TABLE IF NOT EXISTS public.alix_auth_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES public.alix_identities(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.alix_applications(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.alix_organizations(id) ON DELETE SET NULL,
  authorization_code_hash text NOT NULL UNIQUE,
  code_challenge text,
  code_challenge_method text CHECK (code_challenge_method IN ('S256','plain')),
  redirect_uri text NOT NULL,
  scope text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','consumed','expired','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alix_auth_transactions TO authenticated;
GRANT ALL ON public.alix_auth_transactions TO service_role;
ALTER TABLE public.alix_auth_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY aat_select_own ON public.alix_auth_transactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.alix_identities ai WHERE ai.id = alix_auth_transactions.identity_id AND ai.auth_user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_aat_expires ON public.alix_auth_transactions(expires_at);

CREATE TABLE IF NOT EXISTS public.alix_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid REFERENCES public.alix_identities(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.alix_organizations(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.alix_applications(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error','critical')),
  success boolean NOT NULL DEFAULT true,
  ip_address text,
  user_agent text,
  device_fingerprint_hash text,
  session_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alix_security_events TO authenticated;
GRANT ALL ON public.alix_security_events TO service_role;
ALTER TABLE public.alix_security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ase_select_own ON public.alix_security_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.alix_identities ai WHERE ai.id = alix_security_events.identity_id AND ai.auth_user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_ase_created ON public.alix_security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ase_type ON public.alix_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ase_identity ON public.alix_security_events(identity_id);

CREATE TABLE IF NOT EXISTS public.alix_id_admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  permission text NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, permission)
);
GRANT SELECT ON public.alix_id_admin_permissions TO authenticated;
GRANT ALL ON public.alix_id_admin_permissions TO service_role;
ALTER TABLE public.alix_id_admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY aidap_select_own ON public.alix_id_admin_permissions FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

-- Helpers (has_role takes text in this project)
CREATE OR REPLACE FUNCTION public.has_alix_id_permission(_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.alix_id_admin_permissions WHERE auth_user_id = auth.uid() AND permission = _permission
  ) OR public.has_role('Super Admin');
$$;

CREATE OR REPLACE FUNCTION public.current_alix_identity_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.alix_identities WHERE auth_user_id = auth.uid();
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_updated_at') THEN
    CREATE TRIGGER trg_ai_updated_at BEFORE UPDATE ON public.alix_identities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ao_updated_at') THEN
    CREATE TRIGGER trg_ao_updated_at BEFORE UPDATE ON public.alix_organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_aio_updated_at') THEN
    CREATE TRIGGER trg_aio_updated_at BEFORE UPDATE ON public.alix_identity_organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_aa_updated_at') THEN
    CREATE TRIGGER trg_aa_updated_at BEFORE UPDATE ON public.alix_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_aiaa_updated_at') THEN
    CREATE TRIGGER trg_aiaa_updated_at BEFORE UPDATE ON public.alix_identity_app_access FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO public.alix_applications (app_key, app_name, description, app_status, requires_mfa, session_duration_minutes, sort_order) VALUES
  ('alixwork_customer', 'AlixWork', 'Rechnungen, Angebote, Verträge, Geräte, Service und Tickets.', 'active', false, 60, 10),
  ('alixsmart', 'AlixSmart', 'Geräte, Tickets und technische Unterstützung.', 'inactive', false, 60, 20),
  ('alix_academy', 'Alix Academy', 'Schulungen, Zertifikate und Lerninhalte.', 'inactive', false, 60, 30),
  ('medi_metropole', 'Medi Metropole', 'Kurse, Termine, Unterlagen und Prüfungen.', 'inactive', false, 60, 40),
  ('alix_mediapaket', 'Mein Mediapaket', 'Marketingmaterialien und Mediendaten übermitteln.', 'inactive', false, 60, 50),
  ('alix_studio', 'Alix Studio', 'Terminplanung und Online-Anamnese.', 'inactive', true, 30, 60),
  ('alix_service', 'Alix Service', 'Servicetermine, Techniker und Reparaturen.', 'inactive', false, 60, 70),
  ('eanamnese', 'eAnamnese', 'Digitale Anamnese für Behandlungen.', 'inactive', true, 20, 80),
  ('alix_finance', 'Alix Finance', 'Finanzdaten (nur mit ausdrücklicher Berechtigung).', 'inactive', true, 30, 90)
ON CONFLICT (app_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.alix_id_bootstrap_from_portal_users()
RETURNS TABLE (identities_created integer, organizations_created integer, relationships_created integer, app_access_created integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_identities_created integer := 0;
  v_orgs_created integer := 0;
  v_rels_created integer := 0;
  v_access_created integer := 0;
  v_alixwork_app uuid;
  r record;
  v_identity_id uuid;
  v_org_id uuid;
  v_rowcount integer;
BEGIN
  SELECT id INTO v_alixwork_app FROM public.alix_applications WHERE app_key = 'alixwork_customer';

  FOR r IN
    SELECT cpu.user_id, cpu.customer_id, cpu.status,
           u.email::citext AS email,
           c.company_name, c.contact_name, c.contact_tenant_id
    FROM public.customer_portal_users cpu
    JOIN auth.users u ON u.id = cpu.user_id
    LEFT JOIN public.customers c ON c.id = cpu.customer_id
    WHERE cpu.status IN ('active','invited','suspended')
  LOOP
    SELECT id INTO v_identity_id FROM public.alix_identities WHERE auth_user_id = r.user_id;
    IF v_identity_id IS NULL THEN
      INSERT INTO public.alix_identities (auth_user_id, primary_email, email_verified_at, account_status, account_type, display_name)
      VALUES (r.user_id, r.email, now(),
        CASE r.status WHEN 'active' THEN 'active' WHEN 'invited' THEN 'invited' ELSE 'suspended' END,
        'customer', COALESCE(r.contact_name, r.company_name))
      RETURNING id INTO v_identity_id;
      v_identities_created := v_identities_created + 1;
    END IF;

    IF r.customer_id IS NOT NULL THEN
      SELECT id INTO v_org_id FROM public.alix_organizations WHERE linked_customer_id = r.customer_id;
      IF v_org_id IS NULL THEN
        INSERT INTO public.alix_organizations (organization_type, legal_name, display_name, linked_customer_id, tenant_id, status)
        VALUES ('customer', COALESCE(r.company_name, r.contact_name, 'Kunde'), COALESCE(r.company_name, r.contact_name), r.customer_id, r.contact_tenant_id, 'active')
        RETURNING id INTO v_org_id;
        v_orgs_created := v_orgs_created + 1;
      END IF;

      INSERT INTO public.alix_identity_organizations (identity_id, organization_id, relationship_type, relationship_status, is_primary)
      VALUES (v_identity_id, v_org_id, 'owner', 'active', true)
      ON CONFLICT (identity_id, organization_id, relationship_type) DO NOTHING;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      v_rels_created := v_rels_created + v_rowcount;

      INSERT INTO public.alix_identity_app_access (identity_id, organization_id, application_id, tenant_id, access_status, app_role, permissions)
      VALUES (v_identity_id, v_org_id, v_alixwork_app, r.contact_tenant_id,
        CASE r.status WHEN 'active' THEN 'active' WHEN 'invited' THEN 'invited' ELSE 'suspended' END,
        'customer_owner',
        '["invoices.read","invoices.download","offers.read","offers.act","contracts.read","contracts.sign","devices.read","tickets.create","tickets.reply","documents.read","messages.send","maintenance.request"]'::jsonb)
      ON CONFLICT (identity_id, organization_id, application_id) DO NOTHING;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      v_access_created := v_access_created + v_rowcount;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_identities_created, v_orgs_created, v_rels_created, v_access_created;
END;
$$;

REVOKE ALL ON FUNCTION public.alix_id_bootstrap_from_portal_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alix_id_bootstrap_from_portal_users() TO service_role;
