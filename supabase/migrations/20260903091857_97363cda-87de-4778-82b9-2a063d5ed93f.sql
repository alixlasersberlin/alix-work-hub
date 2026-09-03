-- 1) Erweiterungen an bestehenden ac_* Tabellen (nicht destruktiv)
ALTER TABLE public.ac_conversations
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS assigned_department TEXT,
  ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_agent_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_match_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ac_channels
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

-- 2) Zuweisungshistorie
CREATE TABLE IF NOT EXISTS public.ac_conversation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ac_conversations(id) ON DELETE CASCADE,
  assigned_to_user_id UUID NOT NULL,
  assigned_by_user_id UUID,
  assignment_type TEXT NOT NULL DEFAULT 'MANUAL',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ac_conversation_assignments TO authenticated;
GRANT ALL ON public.ac_conversation_assignments TO service_role;
ALTER TABLE public.ac_conversation_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_assign staff read" ON public.ac_conversation_assignments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "ac_assign staff insert" ON public.ac_conversation_assignments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ac_assign staff update" ON public.ac_conversation_assignments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "ac_assign admin delete" ON public.ac_conversation_assignments FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 3) Audit-Events
CREATE TABLE IF NOT EXISTS public.ac_conversation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ac_conversations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ac_conversation_events TO authenticated;
GRANT ALL ON public.ac_conversation_events TO service_role;
ALTER TABLE public.ac_conversation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_events staff read" ON public.ac_conversation_events FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "ac_events staff insert" ON public.ac_conversation_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ac_events admin delete" ON public.ac_conversation_events FOR DELETE TO authenticated USING (has_role('Super Admin'));

-- 4) Idempotenz eingehender Provider-Nachrichten
CREATE UNIQUE INDEX IF NOT EXISTS uq_ac_messages_external_id
  ON public.ac_messages (external_message_id)
  WHERE external_message_id IS NOT NULL;

-- 5) Performance-Indizes
CREATE INDEX IF NOT EXISTS idx_ac_conv_last_message_at ON public.ac_conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_conv_status ON public.ac_conversations (status);
CREATE INDEX IF NOT EXISTS idx_ac_conv_priority ON public.ac_conversations (priority);
CREATE INDEX IF NOT EXISTS idx_ac_conv_assigned_to ON public.ac_conversations (assigned_to);
CREATE INDEX IF NOT EXISTS idx_ac_conv_customer ON public.ac_conversations (customer_id);
CREATE INDEX IF NOT EXISTS idx_ac_conv_channel ON public.ac_conversations (channel_id);
CREATE INDEX IF NOT EXISTS idx_ac_msg_conv_created ON public.ac_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_assign_conv ON public.ac_conversation_assignments (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ac_events_conv ON public.ac_conversation_events (conversation_id, created_at DESC);

-- 6) Realtime
ALTER TABLE public.ac_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.ac_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;