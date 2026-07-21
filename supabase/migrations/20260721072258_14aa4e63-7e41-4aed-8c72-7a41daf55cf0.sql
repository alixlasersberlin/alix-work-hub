
-- KB Approval Workflow
ALTER TABLE public.ac_kb_articles
  ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Journey Segments
CREATE TABLE IF NOT EXISTS public.ac_journey_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  member_count INT NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_journey_segments TO authenticated;
GRANT ALL ON public.ac_journey_segments TO service_role;

ALTER TABLE public.ac_journey_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journey_segments_read"
  ON public.ac_journey_segments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "journey_segments_manage"
  ON public.ac_journey_segments FOR ALL
  TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE TRIGGER trg_ac_journey_segments_updated_at
  BEFORE UPDATE ON public.ac_journey_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Portal Multichannel Handoff
ALTER TABLE public.ac_portal_chat_sessions
  ADD COLUMN IF NOT EXISTS ticket_id UUID,
  ADD COLUMN IF NOT EXISTS handoff_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS handoff_completed_at TIMESTAMPTZ;
