
ALTER TABLE public.ac_campaigns
  ADD COLUMN IF NOT EXISTS is_ab_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS winner_metric text,
  ADD COLUMN IF NOT EXISTS segment_id uuid,
  ADD COLUMN IF NOT EXISTS journey_id uuid;

ALTER TABLE public.ac_campaign_recipients
  ADD COLUMN IF NOT EXISTS variant text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ac_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_count integer NOT NULL DEFAULT 0,
  last_computed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_segments TO authenticated;
GRANT ALL ON public.ac_segments TO service_role;
ALTER TABLE public.ac_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seg_read_auth" ON public.ac_segments FOR SELECT TO authenticated USING (true);
CREATE POLICY "seg_write_admin" ON public.ac_segments FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_event text NOT NULL,
  trigger_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_journeys TO authenticated;
GRANT ALL ON public.ac_journeys TO service_role;
ALTER TABLE public.ac_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jny_read_auth" ON public.ac_journeys FOR SELECT TO authenticated USING (true);
CREATE POLICY "jny_write_admin" ON public.ac_journeys FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_journey_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.ac_journeys(id) ON DELETE CASCADE,
  position integer NOT NULL,
  kind text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ac_journey_steps_journey_idx ON public.ac_journey_steps(journey_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_journey_steps TO authenticated;
GRANT ALL ON public.ac_journey_steps TO service_role;
ALTER TABLE public.ac_journey_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jnys_read_auth" ON public.ac_journey_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "jnys_write_admin" ON public.ac_journey_steps FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_journey_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.ac_journeys(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  next_action_at timestamptz NOT NULL DEFAULT now(),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ac_journey_runs_due_idx ON public.ac_journey_runs(status, next_action_at);
CREATE INDEX IF NOT EXISTS ac_journey_runs_contact_idx ON public.ac_journey_runs(contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_journey_runs TO authenticated;
GRANT ALL ON public.ac_journey_runs TO service_role;
ALTER TABLE public.ac_journey_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jnyr_read_auth" ON public.ac_journey_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "jnyr_write_admin" ON public.ac_journey_runs FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.ac_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_ac_segments_touch ON public.ac_segments;
CREATE TRIGGER trg_ac_segments_touch BEFORE UPDATE ON public.ac_segments
  FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ac_journeys_touch ON public.ac_journeys;
CREATE TRIGGER trg_ac_journeys_touch BEFORE UPDATE ON public.ac_journeys
  FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ac_journey_steps_touch ON public.ac_journey_steps;
CREATE TRIGGER trg_ac_journey_steps_touch BEFORE UPDATE ON public.ac_journey_steps
  FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ac_journey_runs_touch ON public.ac_journey_runs;
CREATE TRIGGER trg_ac_journey_runs_touch BEFORE UPDATE ON public.ac_journey_runs
  FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();
