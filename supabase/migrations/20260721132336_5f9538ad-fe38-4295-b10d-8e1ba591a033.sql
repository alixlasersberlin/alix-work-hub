
ALTER TABLE public.ac_journeys
  ADD COLUMN IF NOT EXISTS graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS ab_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analytics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.ac_journey_runs
  ADD COLUMN IF NOT EXISTS current_node_id text,
  ADD COLUMN IF NOT EXISTS variant text,
  ADD COLUMN IF NOT EXISTS path jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ac_journey_runs_next_action
  ON public.ac_journey_runs (status, next_action_at)
  WHERE status IN ('active','waiting');
