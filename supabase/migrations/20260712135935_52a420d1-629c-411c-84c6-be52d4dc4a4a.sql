
-- 1) Participants
CREATE TABLE IF NOT EXISTS public.ticket_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('collaborator','observer','department_lead','escalation')),
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE (ticket_id, user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_participants TO authenticated;
GRANT ALL ON public.ticket_participants TO service_role;
ALTER TABLE public.ticket_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_participants read authenticated"
  ON public.ticket_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_participants insert authenticated"
  ON public.ticket_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_participants update authenticated"
  ON public.ticket_participants FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_participants delete assigner or super admin"
  ON public.ticket_participants FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS ticket_participants_ticket_idx ON public.ticket_participants(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_participants_user_idx ON public.ticket_participants(user_id);

-- 2) Notifications
CREATE TABLE IF NOT EXISTS public.ticket_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('mention','handover','participant_added','assigned','escalation','overdue','new_customer_message')),
  title text,
  message text,
  actor_id uuid,
  actor_name text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_notifications TO authenticated;
GRANT ALL ON public.ticket_notifications TO service_role;
ALTER TABLE public.ticket_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_notifications read own"
  ON public.ticket_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Super Admin'));
CREATE POLICY "ticket_notifications insert authenticated"
  ON public.ticket_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_notifications update own"
  ON public.ticket_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ticket_notifications delete own"
  ON public.ticket_notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS ticket_notifications_user_unread_idx
  ON public.ticket_notifications(user_id, is_read, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_notifications;
