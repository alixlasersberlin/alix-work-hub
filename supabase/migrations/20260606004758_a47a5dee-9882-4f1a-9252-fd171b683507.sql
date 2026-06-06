
-- =========================================================================
-- Alix MailCenter — Datenbankstruktur (Schritt 2)
-- Keine bestehenden Tabellen/Funktionen werden verändert.
-- =========================================================================

-- ----- Helper-Funktionen (nur neue, keine Überschreibung bestehender) -----

CREATE OR REPLACE FUNCTION public.can_access_mail()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Geschäftsführung')
    OR public.has_role('Marketing')
    OR public.has_role('Finance')
    OR public.has_role('Technik')
    OR public.has_role('Kundenservice')
    OR public.has_role('Vertrieb')
    OR public.has_role('Reparaturannahme')
    OR public.has_role('Tourenplanung')
    OR public.has_role('Bestellwesen')
    OR public.has_role('Order')
    OR public.has_role('Read Only')
    OR public.has_role('Read Only Audit');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_mail_campaigns()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Marketing');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_mail_templates()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Marketing')
    OR public.has_role('Finance')
    OR public.has_role('Technik')
    OR public.has_role('Kundenservice');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_mail_domains()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role('Super Admin');
$$;

CREATE OR REPLACE FUNCTION public.can_view_mail_audit()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Geschäftsführung');
$$;

-- Trigger-Funktion: updated_at
CREATE OR REPLACE FUNCTION public.mail_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger-Funktion: Audit-Log
CREATE OR REPLACE FUNCTION public.mail_audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_entity_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(NEW) = to_jsonb(OLD) THEN
      RETURN NEW;
    END IF;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_entity_id := OLD.id;
  END IF;

  BEGIN
    INSERT INTO public.mail_audit_logs(user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, v_entity_id, v_old, v_new);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =========================================================================
-- 1. mail_templates
-- =========================================================================
CREATE TABLE public.mail_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  category text,
  department text,
  language text NOT NULL DEFAULT 'de',
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_templates TO authenticated;
GRANT ALL ON public.mail_templates TO service_role;
ALTER TABLE public.mail_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_templates_select" ON public.mail_templates
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mail_templates_insert" ON public.mail_templates
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_mail_templates());
CREATE POLICY "mail_templates_update" ON public.mail_templates
  FOR UPDATE TO authenticated USING (public.can_manage_mail_templates()) WITH CHECK (public.can_manage_mail_templates());
CREATE POLICY "mail_templates_delete" ON public.mail_templates
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_mail_templates_category ON public.mail_templates(category);
CREATE INDEX idx_mail_templates_department ON public.mail_templates(department);
CREATE INDEX idx_mail_templates_status ON public.mail_templates(status);
CREATE INDEX idx_mail_templates_created_at ON public.mail_templates(created_at DESC);

CREATE TRIGGER trg_mail_templates_updated_at BEFORE UPDATE ON public.mail_templates
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();
CREATE TRIGGER trg_mail_templates_audit AFTER INSERT OR UPDATE OR DELETE ON public.mail_templates
  FOR EACH ROW EXECUTE FUNCTION public.mail_audit_trigger_fn();

-- =========================================================================
-- 2. mail_campaigns
-- =========================================================================
CREATE TABLE public.mail_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  template_id uuid REFERENCES public.mail_templates(id) ON DELETE SET NULL,
  segment_id uuid,
  sender_name text,
  sender_email text,
  reply_to text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_campaigns TO authenticated;
GRANT ALL ON public.mail_campaigns TO service_role;
ALTER TABLE public.mail_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_campaigns_select" ON public.mail_campaigns
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mail_campaigns_insert" ON public.mail_campaigns
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_mail_campaigns());
CREATE POLICY "mail_campaigns_update" ON public.mail_campaigns
  FOR UPDATE TO authenticated USING (public.can_manage_mail_campaigns()) WITH CHECK (public.can_manage_mail_campaigns());
CREATE POLICY "mail_campaigns_delete" ON public.mail_campaigns
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_mail_campaigns_status ON public.mail_campaigns(status);
CREATE INDEX idx_mail_campaigns_scheduled_at ON public.mail_campaigns(scheduled_at);
CREATE INDEX idx_mail_campaigns_created_at ON public.mail_campaigns(created_at DESC);
CREATE INDEX idx_mail_campaigns_template_id ON public.mail_campaigns(template_id);

CREATE TRIGGER trg_mail_campaigns_updated_at BEFORE UPDATE ON public.mail_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();
CREATE TRIGGER trg_mail_campaigns_audit AFTER INSERT OR UPDATE OR DELETE ON public.mail_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.mail_audit_trigger_fn();

-- =========================================================================
-- 3. mail_recipients
-- =========================================================================
CREATE TABLE public.mail_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.mail_campaigns(id) ON DELETE CASCADE,
  customer_id uuid,
  email text NOT NULL,
  name text,
  company text,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_recipients TO authenticated;
GRANT ALL ON public.mail_recipients TO service_role;
ALTER TABLE public.mail_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_recipients_select" ON public.mail_recipients
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mail_recipients_insert" ON public.mail_recipients
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_mail_campaigns());
CREATE POLICY "mail_recipients_update" ON public.mail_recipients
  FOR UPDATE TO authenticated USING (public.can_manage_mail_campaigns()) WITH CHECK (public.can_manage_mail_campaigns());
CREATE POLICY "mail_recipients_delete" ON public.mail_recipients
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_mail_recipients_campaign_id ON public.mail_recipients(campaign_id);
CREATE INDEX idx_mail_recipients_customer_id ON public.mail_recipients(customer_id);
CREATE INDEX idx_mail_recipients_email ON public.mail_recipients(email);
CREATE INDEX idx_mail_recipients_status ON public.mail_recipients(status);
CREATE INDEX idx_mail_recipients_created_at ON public.mail_recipients(created_at DESC);

CREATE TRIGGER trg_mail_recipients_updated_at BEFORE UPDATE ON public.mail_recipients
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- =========================================================================
-- 4. mail_events
-- =========================================================================
CREATE TABLE public.mail_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES public.mail_recipients(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.mail_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('sent','delivered','opened','clicked','bounced','failed','unsubscribed','spam_complaint')),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  status text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.mail_events TO authenticated;
GRANT ALL ON public.mail_events TO service_role;
ALTER TABLE public.mail_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_events_select" ON public.mail_events
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mail_events_insert" ON public.mail_events
  FOR INSERT TO authenticated WITH CHECK (public.can_access_mail());
CREATE POLICY "mail_events_delete" ON public.mail_events
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_mail_events_recipient_id ON public.mail_events(recipient_id);
CREATE INDEX idx_mail_events_campaign_id ON public.mail_events(campaign_id);
CREATE INDEX idx_mail_events_event_type ON public.mail_events(event_type);
CREATE INDEX idx_mail_events_created_at ON public.mail_events(created_at DESC);

-- =========================================================================
-- 5. mail_unsubscribes
-- =========================================================================
CREATE TABLE public.mail_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  customer_id uuid,
  reason text,
  source text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_unsubscribes TO authenticated;
GRANT ALL ON public.mail_unsubscribes TO service_role;
ALTER TABLE public.mail_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_unsubscribes_select" ON public.mail_unsubscribes
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mail_unsubscribes_insert" ON public.mail_unsubscribes
  FOR INSERT TO authenticated WITH CHECK (public.can_access_mail());
CREATE POLICY "mail_unsubscribes_update" ON public.mail_unsubscribes
  FOR UPDATE TO authenticated USING (public.can_manage_mail_campaigns()) WITH CHECK (public.can_manage_mail_campaigns());
CREATE POLICY "mail_unsubscribes_delete" ON public.mail_unsubscribes
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_mail_unsubscribes_email ON public.mail_unsubscribes(email);
CREATE INDEX idx_mail_unsubscribes_customer_id ON public.mail_unsubscribes(customer_id);
CREATE INDEX idx_mail_unsubscribes_created_at ON public.mail_unsubscribes(created_at DESC);

CREATE TRIGGER trg_mail_unsubscribes_updated_at BEFORE UPDATE ON public.mail_unsubscribes
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- =========================================================================
-- 6. mail_domains  (sensible Spalten — eingeschränkter Zugriff)
-- =========================================================================
CREATE TABLE public.mail_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  sender_email text,
  sender_name text,
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password_encrypted text,
  dkim_status text,
  spf_status text,
  dmarc_status text,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_domains TO authenticated;
GRANT ALL ON public.mail_domains TO service_role;
ALTER TABLE public.mail_domains ENABLE ROW LEVEL SECURITY;

-- Nur Super Admin darf SMTP-Daten überhaupt sehen oder ändern
CREATE POLICY "mail_domains_select" ON public.mail_domains
  FOR SELECT TO authenticated USING (public.can_manage_mail_domains());
CREATE POLICY "mail_domains_insert" ON public.mail_domains
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_mail_domains());
CREATE POLICY "mail_domains_update" ON public.mail_domains
  FOR UPDATE TO authenticated USING (public.can_manage_mail_domains()) WITH CHECK (public.can_manage_mail_domains());
CREATE POLICY "mail_domains_delete" ON public.mail_domains
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_mail_domains_status ON public.mail_domains(status);
CREATE INDEX idx_mail_domains_created_at ON public.mail_domains(created_at DESC);

CREATE TRIGGER trg_mail_domains_updated_at BEFORE UPDATE ON public.mail_domains
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();
CREATE TRIGGER trg_mail_domains_audit AFTER INSERT OR UPDATE OR DELETE ON public.mail_domains
  FOR EACH ROW EXECUTE FUNCTION public.mail_audit_trigger_fn();

-- =========================================================================
-- 7. mail_automations
-- =========================================================================
CREATE TABLE public.mail_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_id uuid REFERENCES public.mail_templates(id) ON DELETE SET NULL,
  delay_minutes integer NOT NULL DEFAULT 0,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_automations TO authenticated;
GRANT ALL ON public.mail_automations TO service_role;
ALTER TABLE public.mail_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_automations_select" ON public.mail_automations
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mail_automations_insert" ON public.mail_automations
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_mail_campaigns());
CREATE POLICY "mail_automations_update" ON public.mail_automations
  FOR UPDATE TO authenticated USING (public.can_manage_mail_campaigns()) WITH CHECK (public.can_manage_mail_campaigns());
CREATE POLICY "mail_automations_delete" ON public.mail_automations
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_mail_automations_trigger_type ON public.mail_automations(trigger_type);
CREATE INDEX idx_mail_automations_status ON public.mail_automations(status);
CREATE INDEX idx_mail_automations_created_at ON public.mail_automations(created_at DESC);

CREATE TRIGGER trg_mail_automations_updated_at BEFORE UPDATE ON public.mail_automations
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();
CREATE TRIGGER trg_mail_automations_audit AFTER INSERT OR UPDATE OR DELETE ON public.mail_automations
  FOR EACH ROW EXECUTE FUNCTION public.mail_audit_trigger_fn();

-- =========================================================================
-- 8. mail_audit_logs
-- =========================================================================
CREATE TABLE public.mail_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  status text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.mail_audit_logs TO authenticated;
GRANT ALL ON public.mail_audit_logs TO service_role;
ALTER TABLE public.mail_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_audit_logs_select" ON public.mail_audit_logs
  FOR SELECT TO authenticated USING (public.can_view_mail_audit());
CREATE POLICY "mail_audit_logs_insert" ON public.mail_audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mail_audit_logs_delete" ON public.mail_audit_logs
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_mail_audit_logs_entity ON public.mail_audit_logs(entity_type, entity_id);
CREATE INDEX idx_mail_audit_logs_user_id ON public.mail_audit_logs(user_id);
CREATE INDEX idx_mail_audit_logs_created_at ON public.mail_audit_logs(created_at DESC);
