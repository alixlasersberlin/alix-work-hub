
ALTER TABLE public.ac_calls
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transcript_language text,
  ADD COLUMN IF NOT EXISTS sentiment text,
  ADD COLUMN IF NOT EXISTS sentiment_score numeric,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS action_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_ac_calls_transcript_status ON public.ac_calls(transcript_status);
CREATE INDEX IF NOT EXISTS idx_ac_calls_sentiment ON public.ac_calls(sentiment);

CREATE TABLE IF NOT EXISTS public.ac_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  granularity text NOT NULL DEFAULT 'day',
  channel text NOT NULL DEFAULT 'all',
  kpis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_report_snapshots TO authenticated;
GRANT ALL ON public.ac_report_snapshots TO service_role;
ALTER TABLE public.ac_report_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage report snapshots" ON public.ac_report_snapshots
  FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE INDEX IF NOT EXISTS idx_ac_report_period ON public.ac_report_snapshots(period_start DESC);

CREATE TABLE IF NOT EXISTS public.ac_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  host_user_id uuid NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  room_code text NOT NULL DEFAULT lower(substr(encode(gen_random_bytes(6),'hex'),1,10)),
  recording_url text,
  transcript text,
  ai_summary text,
  action_items jsonb DEFAULT '[]'::jsonb,
  customer_id uuid,
  ticket_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ac_meetings_room_code ON public.ac_meetings(room_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_meetings TO authenticated;
GRANT ALL ON public.ac_meetings TO service_role;
ALTER TABLE public.ac_meetings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ac_meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.ac_meetings(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text,
  role text NOT NULL DEFAULT 'participant',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_meeting_participants_meeting ON public.ac_meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ac_meeting_participants_user ON public.ac_meeting_participants(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_meeting_participants TO authenticated;
GRANT ALL ON public.ac_meeting_participants TO service_role;
ALTER TABLE public.ac_meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ac_meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.ac_meetings(id) ON DELETE CASCADE,
  author_user_id uuid,
  kind text NOT NULL DEFAULT 'note',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_meeting_notes_meeting ON public.ac_meeting_notes(meeting_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_meeting_notes TO authenticated;
GRANT ALL ON public.ac_meeting_notes TO service_role;
ALTER TABLE public.ac_meeting_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_ac_meeting_member(_meeting_id uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ac_meetings m WHERE m.id = _meeting_id AND m.host_user_id = _user)
      OR EXISTS (SELECT 1 FROM public.ac_meeting_participants p WHERE p.meeting_id = _meeting_id AND p.user_id = _user);
$$;

CREATE POLICY "hosts & members read meetings" ON public.ac_meetings FOR SELECT TO authenticated
  USING (host_user_id = auth.uid() OR public.is_ac_meeting_member(id, auth.uid())
    OR public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "authenticated create meetings" ON public.ac_meetings FOR INSERT TO authenticated
  WITH CHECK (host_user_id = auth.uid());
CREATE POLICY "host or admin update meetings" ON public.ac_meetings FOR UPDATE TO authenticated
  USING (host_user_id = auth.uid() OR public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "super admin delete meetings" ON public.ac_meetings FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE POLICY "members read participants" ON public.ac_meeting_participants FOR SELECT TO authenticated
  USING (public.is_ac_meeting_member(meeting_id, auth.uid())
    OR public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "join meeting" ON public.ac_meeting_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_ac_meeting_member(meeting_id, auth.uid()));
CREATE POLICY "self or host update participant" ON public.ac_meeting_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_ac_meeting_member(meeting_id, auth.uid()));
CREATE POLICY "self or host delete participant" ON public.ac_meeting_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_ac_meeting_member(meeting_id, auth.uid()) OR public.has_role('Super Admin'));

CREATE POLICY "members read notes" ON public.ac_meeting_notes FOR SELECT TO authenticated
  USING (public.is_ac_meeting_member(meeting_id, auth.uid())
    OR public.has_role('Admin') OR public.has_role('Super Admin'));
CREATE POLICY "members insert notes" ON public.ac_meeting_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_ac_meeting_member(meeting_id, auth.uid()));
CREATE POLICY "author or host update notes" ON public.ac_meeting_notes FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid() OR public.is_ac_meeting_member(meeting_id, auth.uid()));
CREATE POLICY "author or host delete notes" ON public.ac_meeting_notes FOR DELETE TO authenticated
  USING (author_user_id = auth.uid() OR public.is_ac_meeting_member(meeting_id, auth.uid()) OR public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.ac_meetings_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_ac_meetings_touch ON public.ac_meetings;
CREATE TRIGGER trg_ac_meetings_touch BEFORE UPDATE ON public.ac_meetings
  FOR EACH ROW EXECUTE FUNCTION public.ac_meetings_touch();
