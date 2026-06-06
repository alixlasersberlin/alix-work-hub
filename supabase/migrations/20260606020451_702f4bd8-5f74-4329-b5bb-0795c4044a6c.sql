-- =====================================================================
-- WhatsApp Business & Omnichannel Communication Tables
-- =====================================================================

-- Helper function: can manage WhatsApp (send messages)
CREATE OR REPLACE FUNCTION public.can_send_whatsapp()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Geschäftsführung')
    OR public.has_role('Finance')
    OR public.has_role('Vertrieb')
    OR public.has_role('Marketing')
    OR public.has_role('Technik')
    OR public.has_role('Kundenservice')
    OR public.has_role('Reparaturannahme')
    OR public.has_role('Order');
$$;

-- Helper function: can manage WhatsApp automations + consents
CREATE OR REPLACE FUNCTION public.can_manage_whatsapp_automation()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Geschäftsführung')
    OR public.has_role('Marketing')
    OR public.has_role('Finance');
$$;

-- =====================================================================
-- whatsapp_templates
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  language text NOT NULL DEFAULT 'de',
  category text NOT NULL DEFAULT 'utility', -- utility | marketing | authentication
  department text, -- finance | vertrieb | service | marketing
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta_template_name text,
  meta_template_status text,
  status text NOT NULL DEFAULT 'active', -- active | inactive | pending
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_templates_select" ON public.whatsapp_templates
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "wa_templates_insert" ON public.whatsapp_templates
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_mail_templates());
CREATE POLICY "wa_templates_update" ON public.whatsapp_templates
  FOR UPDATE TO authenticated USING (public.can_manage_mail_templates()) WITH CHECK (public.can_manage_mail_templates());
CREATE POLICY "wa_templates_delete" ON public.whatsapp_templates
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_wa_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- =====================================================================
-- whatsapp_messages
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  order_id uuid,
  repair_order_id uuid,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  status text NOT NULL DEFAULT 'queued', -- queued|sent|delivered|read|failed|received
  phone_number text NOT NULL,
  body text,
  media_url text,
  media_type text,
  template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  department text,
  meta_message_id text,
  error_message text,
  sent_by uuid,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_customer ON public.whatsapp_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created ON public.whatsapp_messages(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_messages_select_staff" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "wa_messages_select_portal" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (
    public.is_portal_customer()
    AND customer_id = public.current_portal_customer_id()
  );
CREATE POLICY "wa_messages_insert" ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (public.can_send_whatsapp());
CREATE POLICY "wa_messages_update" ON public.whatsapp_messages
  FOR UPDATE TO authenticated USING (public.can_send_whatsapp()) WITH CHECK (public.can_send_whatsapp());
CREATE POLICY "wa_messages_delete" ON public.whatsapp_messages
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_wa_messages_updated_at BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- =====================================================================
-- whatsapp_consents
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  phone_number text NOT NULL,
  consent_marketing boolean NOT NULL DEFAULT false,
  consent_service boolean NOT NULL DEFAULT true,
  consent_transactional boolean NOT NULL DEFAULT true,
  source text, -- portal|form|verbal|import|webshop
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip_address text,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_number)
);

CREATE INDEX IF NOT EXISTS idx_wa_consents_customer ON public.whatsapp_consents(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_consents TO authenticated;
GRANT ALL ON public.whatsapp_consents TO service_role;

ALTER TABLE public.whatsapp_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_consents_select" ON public.whatsapp_consents
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "wa_consents_insert" ON public.whatsapp_consents
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_whatsapp_automation());
CREATE POLICY "wa_consents_update" ON public.whatsapp_consents
  FOR UPDATE TO authenticated USING (public.can_manage_whatsapp_automation()) WITH CHECK (public.can_manage_whatsapp_automation());
CREATE POLICY "wa_consents_delete" ON public.whatsapp_consents
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_wa_consents_updated_at BEFORE UPDATE ON public.whatsapp_consents
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- =====================================================================
-- whatsapp_automations
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_event text NOT NULL, -- repair_status_changed | order_delivered | invoice_overdue | quote_opened | repair_completed
  trigger_value text, -- e.g. specific status name
  template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  department text,
  requires_consent text NOT NULL DEFAULT 'service', -- service | marketing | transactional
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_automations TO authenticated;
GRANT ALL ON public.whatsapp_automations TO service_role;

ALTER TABLE public.whatsapp_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_auto_select" ON public.whatsapp_automations
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "wa_auto_insert" ON public.whatsapp_automations
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_whatsapp_automation());
CREATE POLICY "wa_auto_update" ON public.whatsapp_automations
  FOR UPDATE TO authenticated USING (public.can_manage_whatsapp_automation()) WITH CHECK (public.can_manage_whatsapp_automation());
CREATE POLICY "wa_auto_delete" ON public.whatsapp_automations
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_wa_auto_updated_at BEFORE UPDATE ON public.whatsapp_automations
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- =====================================================================
-- customer_communication_log (Omnichannel Timeline)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_communication_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  order_id uuid,
  repair_order_id uuid,
  channel text NOT NULL, -- email | whatsapp | ticket | internal_note | phone_call | document
  direction text, -- inbound | outbound | internal
  subject text,
  preview text,
  reference_table text,
  reference_id uuid,
  department text,
  created_by uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccl_customer_time ON public.customer_communication_log(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ccl_channel ON public.customer_communication_log(channel);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_communication_log TO authenticated;
GRANT ALL ON public.customer_communication_log TO service_role;

ALTER TABLE public.customer_communication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccl_select_staff" ON public.customer_communication_log
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "ccl_select_portal" ON public.customer_communication_log
  FOR SELECT TO authenticated USING (
    public.is_portal_customer()
    AND customer_id = public.current_portal_customer_id()
    AND channel <> 'internal_note'
  );
CREATE POLICY "ccl_insert" ON public.customer_communication_log
  FOR INSERT TO authenticated WITH CHECK (public.can_access_mail());
CREATE POLICY "ccl_update" ON public.customer_communication_log
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "ccl_delete" ON public.customer_communication_log
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));
