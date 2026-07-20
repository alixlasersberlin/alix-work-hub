
CREATE TABLE IF NOT EXISTS public.ac_web_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  website_id uuid NOT NULL REFERENCES public.ac_websites(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('no_traffic','visitor_spike','goal_completed','daily_summary')),
  threshold integer NOT NULL DEFAULT 0,
  window_minutes integer NOT NULL DEFAULT 60,
  cooldown_minutes integer NOT NULL DEFAULT 240,
  recipient_email text NOT NULL,
  goal_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  last_checked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_web_alerts TO authenticated;
GRANT ALL ON public.ac_web_alerts TO service_role;

ALTER TABLE public.ac_web_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ac_web_alerts_admin_all"
  ON public.ac_web_alerts FOR ALL TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin'))
  WITH CHECK (public.has_role('Super Admin') OR public.has_role('Admin'));

CREATE POLICY "ac_web_alerts_tenant_read"
  ON public.ac_web_alerts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ac_websites w
    WHERE w.id = ac_web_alerts.website_id
      AND (w.tenant_id IS NULL OR EXISTS (
        SELECT 1 FROM public.user_tenant_access u
        WHERE u.user_id = auth.uid() AND u.tenant_id = w.tenant_id
      ))
  ));

CREATE INDEX IF NOT EXISTS idx_ac_web_alerts_website ON public.ac_web_alerts(website_id) WHERE is_active;

CREATE TRIGGER trg_ac_web_alerts_updated
  BEFORE UPDATE ON public.ac_web_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
