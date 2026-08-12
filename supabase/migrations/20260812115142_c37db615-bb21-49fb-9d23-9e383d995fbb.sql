-- ALIX: Wiederkehrende Zahler – Erinnerungs- & Sammelversandsystem (additiv)
CREATE TABLE IF NOT EXISTS public.rz_reminder_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  auto_enabled boolean NOT NULL DEFAULT true,
  lead_days integer NOT NULL DEFAULT 3,
  extra_lead_days integer[] NOT NULL DEFAULT '{}',
  bcc text[] NOT NULL DEFAULT ARRAY['k.trinh@alix-operation.de'],
  subject text NOT NULL DEFAULT 'Ihre monatliche Rechnung',
  language text NOT NULL DEFAULT 'de',
  shop_url text NOT NULL DEFAULT 'https://alixsmart.de',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rz_reminder_settings TO authenticated;
GRANT ALL ON public.rz_reminder_settings TO service_role;
ALTER TABLE public.rz_reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY rz_settings_select ON public.rz_reminder_settings FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH'));
CREATE POLICY rz_settings_insert ON public.rz_reminder_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin'));
CREATE POLICY rz_settings_update ON public.rz_reminder_settings FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin'));

INSERT INTO public.rz_reminder_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rz_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  profile_id uuid,
  zoho_recurring_invoice_id text,
  source_system text,
  customer_id text,
  customer_number text,
  customer_name text,
  salutation text,
  first_name text,
  last_name text,
  contract_number text,
  invoice_number text,
  invoice_id text,
  payment_method text NOT NULL DEFAULT 'self',
  frequency text,
  due_date date NOT NULL,
  send_date date NOT NULL,
  last_payment_date date,
  amount numeric,
  currency text NOT NULL DEFAULT 'EUR',
  email text,
  status text NOT NULL DEFAULT 'pending',
  send_mode text,
  sent_at timestamptz,
  sent_by uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rz_reminders_send_date ON public.rz_reminders (send_date, status);
CREATE INDEX IF NOT EXISTS idx_rz_reminders_due ON public.rz_reminders (due_date);
CREATE INDEX IF NOT EXISTS idx_rz_reminders_customer ON public.rz_reminders (customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rz_reminders TO authenticated;
GRANT ALL ON public.rz_reminders TO service_role;
ALTER TABLE public.rz_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY rz_reminders_select ON public.rz_reminders FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH'));
CREATE POLICY rz_reminders_insert ON public.rz_reminders FOR INSERT TO authenticated
  WITH CHECK (public.can_access_finance() OR public.has_role('Buchhaltung Admin'));
CREATE POLICY rz_reminders_update ON public.rz_reminders FOR UPDATE TO authenticated
  USING (public.can_access_finance() OR public.has_role('Buchhaltung Admin'));
CREATE POLICY rz_reminders_delete ON public.rz_reminders FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.rz_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid REFERENCES public.rz_reminders(id) ON DELETE SET NULL,
  customer_id text,
  customer_name text,
  invoice_number text,
  email text,
  due_date date,
  amount numeric,
  currency text,
  payment_method text,
  channel text NOT NULL DEFAULT 'email',
  mode text NOT NULL DEFAULT 'manual',
  success boolean NOT NULL DEFAULT true,
  error text,
  user_id uuid,
  user_email text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rz_log_sent_at ON public.rz_reminder_log (sent_at DESC);
GRANT SELECT, INSERT, DELETE ON public.rz_reminder_log TO authenticated;
GRANT ALL ON public.rz_reminder_log TO service_role;
ALTER TABLE public.rz_reminder_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY rz_log_select ON public.rz_reminder_log FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU') OR public.has_role('Buchhaltung CH'));
CREATE POLICY rz_log_insert ON public.rz_reminder_log FOR INSERT TO authenticated
  WITH CHECK (public.can_access_finance() OR public.has_role('Buchhaltung Admin'));
CREATE POLICY rz_log_delete ON public.rz_reminder_log FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.rz_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_rz_reminders_touch BEFORE UPDATE ON public.rz_reminders
  FOR EACH ROW EXECUTE FUNCTION public.rz_touch_updated_at();
CREATE TRIGGER trg_rz_settings_touch BEFORE UPDATE ON public.rz_reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.rz_touch_updated_at();