
ALTER TABLE public.mail_messages
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS mailbox text,
  ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS thread_id text;

CREATE INDEX IF NOT EXISTS mail_messages_mailbox_idx ON public.mail_messages(mailbox);
CREATE INDEX IF NOT EXISTS mail_messages_direction_idx ON public.mail_messages(direction);
CREATE INDEX IF NOT EXISTS mail_messages_assigned_idx ON public.mail_messages(assigned_to);

CREATE OR REPLACE FUNCTION public.user_mailboxes()
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text[] := ARRAY[]::text[];
BEGIN
  IF public.is_admin() OR public.has_role('Geschäftsführung') THEN
    RETURN ARRAY['finance','vertrieb','service','marketing','personal'];
  END IF;
  IF public.has_role('Finance') THEN result := array_append(result, 'finance'); END IF;
  IF public.has_role('Vertrieb') OR public.has_role('Order') THEN result := array_append(result, 'vertrieb'); END IF;
  IF public.has_role('Technik') OR public.has_role('Kundenservice') OR public.has_role('Reparaturannahme') THEN result := array_append(result, 'service'); END IF;
  IF public.has_role('Marketing') THEN result := array_append(result, 'marketing'); END IF;
  result := array_append(result, 'personal');
  RETURN result;
END;
$$;

CREATE TABLE IF NOT EXISTS public.mail_internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_user_id uuid,
  recipient_department text,
  subject text,
  body text NOT NULL,
  customer_id uuid,
  order_id uuid,
  message_id uuid,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mail_internal_messages TO authenticated;
GRANT ALL ON public.mail_internal_messages TO service_role;
ALTER TABLE public.mail_internal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_msg_select" ON public.mail_internal_messages
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_role('Geschäftsführung')
    OR sender_id = auth.uid()
    OR recipient_user_id = auth.uid()
    OR (recipient_department IS NOT NULL AND recipient_department = ANY(public.user_mailboxes()))
  );
CREATE POLICY "internal_msg_insert" ON public.mail_internal_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_mail());
CREATE POLICY "internal_msg_update" ON public.mail_internal_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR recipient_user_id = auth.uid() OR sender_id = auth.uid());
CREATE POLICY "internal_msg_delete" ON public.mail_internal_messages
  FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER set_internal_msg_updated_at
  BEFORE UPDATE ON public.mail_internal_messages
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

CREATE TABLE IF NOT EXISTS public.mail_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid,
  customer_id uuid,
  body text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mail_notes TO authenticated;
GRANT ALL ON public.mail_notes TO service_role;
ALTER TABLE public.mail_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_notes_select" ON public.mail_notes
  FOR SELECT TO authenticated USING (public.can_access_mail());
CREATE POLICY "mail_notes_insert" ON public.mail_notes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_access_mail());
CREATE POLICY "mail_notes_update" ON public.mail_notes
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "mail_notes_delete" ON public.mail_notes
  FOR DELETE TO authenticated
  USING (public.has_role('Super Admin') OR created_by = auth.uid());

CREATE TRIGGER set_mail_notes_updated_at
  BEFORE UPDATE ON public.mail_notes
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

CREATE TABLE IF NOT EXISTS public.mail_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_notifications_user_idx
  ON public.mail_notifications(user_id, is_read, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_notifications TO authenticated;
GRANT ALL ON public.mail_notifications TO service_role;
ALTER TABLE public.mail_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_notif_select" ON public.mail_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "mail_notif_insert" ON public.mail_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "mail_notif_update" ON public.mail_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "mail_notif_delete" ON public.mail_notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role('Super Admin'));
