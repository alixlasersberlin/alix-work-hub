
CREATE TABLE IF NOT EXISTS public.ac_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid,
  customer_id uuid,
  kind text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  risk_level text,
  reason text,
  suggested_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ac_predictions TO authenticated;
GRANT ALL ON public.ac_predictions TO service_role;
ALTER TABLE public.ac_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_predictions_read_staff" ON public.ac_predictions
  FOR SELECT TO authenticated USING (
    public.has_role('Super Admin') OR public.has_role('Admin')
    OR public.has_role('Order') OR public.has_role('QM')
  );
CREATE INDEX IF NOT EXISTS idx_ac_predictions_contact ON public.ac_predictions(contact_id, kind, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_predictions_kind_score ON public.ac_predictions(kind, score DESC);

CREATE TABLE IF NOT EXISTS public.ac_outreach_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  event_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel text NOT NULL DEFAULT 'email',
  template_id text,
  message_template text,
  send_hour_local int DEFAULT 10,
  throttle_per_customer_days int DEFAULT 30,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_outreach_triggers TO authenticated;
GRANT ALL ON public.ac_outreach_triggers TO service_role;
ALTER TABLE public.ac_outreach_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_outreach_triggers_admin_all" ON public.ac_outreach_triggers
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE TABLE IF NOT EXISTS public.ac_outreach_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id uuid REFERENCES public.ac_outreach_triggers(id) ON DELETE SET NULL,
  contact_id uuid,
  customer_id uuid,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  scheduled_for timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ac_outreach_runs TO authenticated;
GRANT ALL ON public.ac_outreach_runs TO service_role;
ALTER TABLE public.ac_outreach_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_outreach_runs_read_staff" ON public.ac_outreach_runs
  FOR SELECT TO authenticated USING (
    public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Order')
  );
CREATE POLICY "ac_outreach_runs_admin_write" ON public.ac_outreach_runs
  FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));
CREATE INDEX IF NOT EXISTS idx_ac_outreach_runs_status ON public.ac_outreach_runs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_ac_outreach_runs_customer ON public.ac_outreach_runs(customer_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.ac_revenue_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  customer_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'EUR',
  order_date timestamptz,
  model text NOT NULL,
  channel text,
  campaign_id uuid,
  journey_id uuid,
  touchpoint_id uuid,
  weight numeric NOT NULL DEFAULT 0,
  attributed_amount numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ac_revenue_attributions TO authenticated;
GRANT ALL ON public.ac_revenue_attributions TO service_role;
ALTER TABLE public.ac_revenue_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_rev_attr_read_admin" ON public.ac_revenue_attributions
  FOR SELECT TO authenticated USING (
    public.has_role('Super Admin') OR public.has_role('Admin')
  );
CREATE INDEX IF NOT EXISTS idx_ac_rev_attr_order ON public.ac_revenue_attributions(order_id);
CREATE INDEX IF NOT EXISTS idx_ac_rev_attr_channel ON public.ac_revenue_attributions(model, channel, order_date DESC);

DROP TRIGGER IF EXISTS trg_ac_outreach_triggers_updated ON public.ac_outreach_triggers;
CREATE TRIGGER trg_ac_outreach_triggers_updated
  BEFORE UPDATE ON public.ac_outreach_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
