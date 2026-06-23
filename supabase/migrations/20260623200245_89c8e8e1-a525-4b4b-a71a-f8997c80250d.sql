
-- 1) Tabelle: offer_followup_tasks
CREATE TABLE public.offer_followup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number text NOT NULL,
  customer_id uuid NULL,
  owner_user_id uuid NULL,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 5),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','erledigt','übersprungen','inaktiv','eskaliert')),
  priority text NOT NULL DEFAULT 'gruen' CHECK (priority IN ('gruen','gelb','orange','rot')),
  title text NOT NULL,
  channel_done text NULL CHECK (channel_done IS NULL OR channel_done IN ('email','sms','call','note')),
  ai_score smallint NULL,
  reminder_sent_at timestamptz NULL,
  done_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_number, stage)
);
CREATE INDEX idx_offer_followup_tasks_due ON public.offer_followup_tasks(due_at);
CREATE INDEX idx_offer_followup_tasks_owner ON public.offer_followup_tasks(owner_user_id);
CREATE INDEX idx_offer_followup_tasks_status ON public.offer_followup_tasks(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_followup_tasks TO authenticated;
GRANT ALL ON public.offer_followup_tasks TO service_role;
ALTER TABLE public.offer_followup_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followup_tasks_select" ON public.offer_followup_tasks FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
    OR owner_user_id = auth.uid()
  );
CREATE POLICY "followup_tasks_insert" ON public.offer_followup_tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
  );
CREATE POLICY "followup_tasks_update" ON public.offer_followup_tasks FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
    OR owner_user_id = auth.uid()
  );
CREATE POLICY "followup_tasks_delete" ON public.offer_followup_tasks FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_offer_followup_tasks_updated_at
  BEFORE UPDATE ON public.offer_followup_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Tabelle: offer_contact_log
CREATE TABLE public.offer_contact_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number text NOT NULL,
  customer_id uuid NULL,
  user_id uuid NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms','call','note')),
  subject text NULL,
  body text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_offer_contact_log_offer ON public.offer_contact_log(offer_number);

GRANT SELECT, INSERT ON public.offer_contact_log TO authenticated;
GRANT ALL ON public.offer_contact_log TO service_role;
ALTER TABLE public.offer_contact_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_log_select" ON public.offer_contact_log FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
    OR user_id = auth.uid()
  );
CREATE POLICY "contact_log_insert" ON public.offer_contact_log FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
  );
CREATE POLICY "contact_log_delete" ON public.offer_contact_log FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 3) Tabelle: offer_outcomes
CREATE TABLE public.offer_outcomes (
  offer_number text PRIMARY KEY,
  outcome text NOT NULL DEFAULT 'offen' CHECK (outcome IN ('offen','gewonnen','verloren','inaktiv')),
  reason text NULL,
  decided_by uuid NULL,
  decided_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_outcomes TO authenticated;
GRANT ALL ON public.offer_outcomes TO service_role;
ALTER TABLE public.offer_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outcomes_select" ON public.offer_outcomes FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Finance')
  );
CREATE POLICY "outcomes_write" ON public.offer_outcomes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
  );
CREATE POLICY "outcomes_update" ON public.offer_outcomes FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Vertrieb') OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order') OR public.has_role('SACHBEARBEITUNG')
  );
CREATE POLICY "outcomes_delete" ON public.offer_outcomes FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_offer_outcomes_updated_at
  BEFORE UPDATE ON public.offer_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Tabelle: offer_followup_settings (single-row config)
CREATE TABLE public.offer_followup_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  stage_days int[] NOT NULL DEFAULT ARRAY[2,4,7,14,21]::int[],
  customer_email_enabled boolean NOT NULL DEFAULT false,
  customer_sms_enabled boolean NOT NULL DEFAULT false,
  escalation_amount numeric NOT NULL DEFAULT 10000,
  escalation_days int NOT NULL DEFAULT 14,
  escalation_role_names text[] NOT NULL DEFAULT ARRAY['Vertriebsleitung','Head of Operations','Geschäftsführung']::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.offer_followup_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.offer_followup_settings TO authenticated;
GRANT ALL ON public.offer_followup_settings TO service_role;
ALTER TABLE public.offer_followup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select" ON public.offer_followup_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_update" ON public.offer_followup_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_offer_followup_settings_updated_at
  BEFORE UPDATE ON public.offer_followup_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.offer_followup_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.offer_outcomes;
