
-- Sales Leads (Zoho Forms Anfragen)
CREATE TABLE public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  external_id text,
  source text NOT NULL DEFAULT 'zoho_forms',
  form_name text,
  first_name text,
  last_name text,
  company text,
  email text,
  phone text,
  street text,
  zip text,
  city text,
  country text,
  requested_products text,
  message text,
  lead_status text NOT NULL DEFAULT 'Importiert - Angebot offen',
  assigned_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_offer_id uuid,
  converted_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT sales_leads_external_unique UNIQUE (source, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_leads TO authenticated;
GRANT ALL ON public.sales_leads TO service_role;

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_leads_select ON public.sales_leads FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'));

CREATE POLICY sales_leads_insert ON public.sales_leads FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'));

CREATE POLICY sales_leads_update ON public.sales_leads FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'));

CREATE POLICY sales_leads_delete ON public.sales_leads FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TRIGGER sales_leads_set_updated_at BEFORE UPDATE ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_sales_leads_status ON public.sales_leads(lead_status);
CREATE INDEX idx_sales_leads_email ON public.sales_leads(lower(email));
CREATE INDEX idx_sales_leads_phone ON public.sales_leads(phone);
CREATE INDEX idx_sales_leads_created ON public.sales_leads(created_at DESC);

-- History
CREATE TABLE public.sales_lead_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  action text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sales_lead_history TO authenticated;
GRANT ALL ON public.sales_lead_history TO service_role;
ALTER TABLE public.sales_lead_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_lead_history_select ON public.sales_lead_history FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'));
CREATE POLICY sales_lead_history_insert ON public.sales_lead_history FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'));
CREATE POLICY sales_lead_history_delete ON public.sales_lead_history FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));
CREATE INDEX idx_sales_lead_history_lead ON public.sales_lead_history(lead_id, created_at DESC);

-- Auto-history on status change
CREATE OR REPLACE FUNCTION public.sales_leads_log_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sales_lead_history(lead_id, action, user_id, note)
    VALUES (NEW.id, 'created', auth.uid(), 'Lead angelegt (Status: '||NEW.lead_status||')');
  ELSIF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    INSERT INTO public.sales_lead_history(lead_id, action, user_id, note)
    VALUES (NEW.id, 'status_change', auth.uid(), OLD.lead_status||' → '||NEW.lead_status);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sales_leads_history
AFTER INSERT OR UPDATE OF lead_status ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.sales_leads_log_status();

-- Followups
CREATE TABLE public.sales_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lead_id uuid REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'Rückruf', -- Rückruf | Termin | Wiedervorlage | Erinnerung
  title text NOT NULL,
  description text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'offen', -- offen | erledigt
  assigned_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  done_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_followups TO authenticated;
GRANT ALL ON public.sales_followups TO service_role;
ALTER TABLE public.sales_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_followups_select ON public.sales_followups FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'));
CREATE POLICY sales_followups_insert ON public.sales_followups FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'));
CREATE POLICY sales_followups_update ON public.sales_followups FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung') OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG'));
CREATE POLICY sales_followups_delete ON public.sales_followups FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));
CREATE TRIGGER sales_followups_set_updated_at BEFORE UPDATE ON public.sales_followups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_sales_followups_due ON public.sales_followups(status, due_at);

-- Integration logs
CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  event text NOT NULL,
  external_id text,
  status text NOT NULL DEFAULT 'ok',
  message text,
  payload jsonb,
  user_id uuid
);
GRANT SELECT, INSERT ON public.integration_logs TO authenticated;
GRANT ALL ON public.integration_logs TO service_role;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_logs_select ON public.integration_logs FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Vertriebsleitung'));
CREATE POLICY integration_logs_insert ON public.integration_logs FOR INSERT TO authenticated
WITH CHECK (true);
CREATE POLICY integration_logs_delete ON public.integration_logs FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));
CREATE INDEX idx_integration_logs_created ON public.integration_logs(created_at DESC);
