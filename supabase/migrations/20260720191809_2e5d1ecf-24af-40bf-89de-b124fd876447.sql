
DO $$ BEGIN CREATE TYPE public.ac_channel_type AS ENUM ('team','direct','department','website','email','whatsapp','sms','voice','facebook','instagram','telegram'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ac_conversation_status AS ENUM ('open','pending','resolved','closed','snoozed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ac_message_direction AS ENUM ('inbound','outbound','internal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ac_sender_type AS ENUM ('user','contact','bot','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ac_websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  operator TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#D4AF37',
  secondary_color TEXT DEFAULT '#0A0A0A',
  language TEXT DEFAULT 'de',
  welcome_message TEXT,
  business_hours JSONB DEFAULT '{}'::jsonb,
  privacy_url TEXT,
  imprint_url TEXT,
  chat_enabled BOOLEAN DEFAULT TRUE,
  surveys_enabled BOOLEAN DEFAULT TRUE,
  analytics_enabled BOOLEAN DEFAULT TRUE,
  cookieless_analytics BOOLEAN DEFAULT TRUE,
  widget_position TEXT DEFAULT 'bottom-right',
  widget_config JSONB DEFAULT '{}'::jsonb,
  api_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  status TEXT DEFAULT 'active',
  default_department_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_websites TO authenticated;
GRANT ALL ON public.ac_websites TO service_role;
ALTER TABLE public.ac_websites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ac_websites admin manage" ON public.ac_websites;
CREATE POLICY "ac_websites admin manage" ON public.ac_websites FOR ALL TO authenticated USING (has_role('Super Admin') OR has_role('Admin')) WITH CHECK (has_role('Super Admin') OR has_role('Admin'));
DROP POLICY IF EXISTS "ac_websites staff read" ON public.ac_websites;
CREATE POLICY "ac_websites staff read" ON public.ac_websites FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_ac_websites_domain ON public.ac_websites(domain);
CREATE INDEX IF NOT EXISTS idx_ac_websites_api_key ON public.ac_websites(api_key);

CREATE TABLE IF NOT EXISTS public.ac_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  type public.ac_channel_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  department_id UUID,
  website_id UUID REFERENCES public.ac_websites(id) ON DELETE SET NULL,
  external_config JSONB DEFAULT '{}'::jsonb,
  icon TEXT,
  color TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_channels TO authenticated;
GRANT ALL ON public.ac_channels TO service_role;
ALTER TABLE public.ac_channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ac_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.ac_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  last_read_at TIMESTAMPTZ,
  notifications_muted BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (channel_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_channel_members TO authenticated;
GRANT ALL ON public.ac_channel_members TO service_role;
ALTER TABLE public.ac_channel_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ac_channel_members_user ON public.ac_channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ac_channel_members_channel ON public.ac_channel_members(channel_id);

CREATE OR REPLACE FUNCTION public.ac_is_channel_member(_channel UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ac_channel_members WHERE channel_id=_channel AND user_id=_user);
$$;

DROP POLICY IF EXISTS "ac_channels member read" ON public.ac_channels;
CREATE POLICY "ac_channels member read" ON public.ac_channels FOR SELECT TO authenticated USING (NOT is_private OR public.ac_is_channel_member(id, auth.uid()) OR has_role('Super Admin') OR has_role('Admin'));
DROP POLICY IF EXISTS "ac_channels staff create" ON public.ac_channels;
CREATE POLICY "ac_channels staff create" ON public.ac_channels FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ac_channels member update" ON public.ac_channels;
CREATE POLICY "ac_channels member update" ON public.ac_channels FOR UPDATE TO authenticated USING (created_by = auth.uid() OR has_role('Super Admin') OR has_role('Admin'));
DROP POLICY IF EXISTS "ac_channels admin delete" ON public.ac_channels;
CREATE POLICY "ac_channels admin delete" ON public.ac_channels FOR DELETE TO authenticated USING (has_role('Super Admin'));

DROP POLICY IF EXISTS "ac_channel_members read own+channel" ON public.ac_channel_members;
CREATE POLICY "ac_channel_members read own+channel" ON public.ac_channel_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.ac_is_channel_member(channel_id, auth.uid()) OR has_role('Admin') OR has_role('Super Admin'));
DROP POLICY IF EXISTS "ac_channel_members staff insert" ON public.ac_channel_members;
CREATE POLICY "ac_channel_members staff insert" ON public.ac_channel_members FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ac_channel_members self update" ON public.ac_channel_members;
CREATE POLICY "ac_channel_members self update" ON public.ac_channel_members FOR UPDATE TO authenticated USING (user_id = auth.uid() OR has_role('Admin'));
DROP POLICY IF EXISTS "ac_channel_members admin delete" ON public.ac_channel_members;
CREATE POLICY "ac_channel_members admin delete" ON public.ac_channel_members FOR DELETE TO authenticated USING (user_id = auth.uid() OR has_role('Admin') OR has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.ac_channels(id) ON DELETE SET NULL,
  website_id UUID REFERENCES public.ac_websites(id) ON DELETE SET NULL,
  channel_type public.ac_channel_type NOT NULL,
  status public.ac_conversation_status NOT NULL DEFAULT 'open',
  subject TEXT,
  contact_id UUID,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_department_id UUID,
  priority TEXT DEFAULT 'normal',
  tags TEXT[] DEFAULT '{}',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT,
  unread_count INT DEFAULT 0,
  external_thread_id TEXT,
  external_meta JSONB DEFAULT '{}'::jsonb,
  visitor_meta JSONB DEFAULT '{}'::jsonb,
  ai_summary TEXT,
  ai_sentiment TEXT,
  csat_score INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_conversations TO authenticated;
GRANT ALL ON public.ac_conversations TO service_role;
ALTER TABLE public.ac_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ac_conv_status ON public.ac_conversations(status);
CREATE INDEX IF NOT EXISTS idx_ac_conv_assigned ON public.ac_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ac_conv_customer ON public.ac_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_ac_conv_last_msg ON public.ac_conversations(last_message_at DESC);
DROP POLICY IF EXISTS "ac_conv staff read" ON public.ac_conversations;
CREATE POLICY "ac_conv staff read" ON public.ac_conversations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ac_conv staff insert" ON public.ac_conversations;
CREATE POLICY "ac_conv staff insert" ON public.ac_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ac_conv staff update" ON public.ac_conversations;
CREATE POLICY "ac_conv staff update" ON public.ac_conversations FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ac_conv admin delete" ON public.ac_conversations;
CREATE POLICY "ac_conv admin delete" ON public.ac_conversations FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.ac_channels(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ac_conversations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.ac_messages(id) ON DELETE CASCADE,
  direction public.ac_message_direction NOT NULL DEFAULT 'internal',
  sender_type public.ac_sender_type NOT NULL DEFAULT 'user',
  sender_user_id UUID REFERENCES auth.users(id),
  sender_contact_id UUID,
  sender_name TEXT,
  body TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  mentions UUID[] DEFAULT '{}',
  reactions JSONB DEFAULT '{}'::jsonb,
  is_internal_note BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  read_by JSONB DEFAULT '[]'::jsonb,
  external_message_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (channel_id IS NOT NULL OR conversation_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_messages TO authenticated;
GRANT ALL ON public.ac_messages TO service_role;
ALTER TABLE public.ac_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ac_messages_channel ON public.ac_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_messages_conv ON public.ac_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_messages_parent ON public.ac_messages(parent_id);
DROP POLICY IF EXISTS "ac_messages channel member read" ON public.ac_messages;
CREATE POLICY "ac_messages channel member read" ON public.ac_messages FOR SELECT TO authenticated USING ((channel_id IS NOT NULL AND public.ac_is_channel_member(channel_id, auth.uid())) OR conversation_id IS NOT NULL OR has_role('Admin') OR has_role('Super Admin'));
DROP POLICY IF EXISTS "ac_messages authenticated insert" ON public.ac_messages;
CREATE POLICY "ac_messages authenticated insert" ON public.ac_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND (channel_id IS NULL OR public.ac_is_channel_member(channel_id, auth.uid()) OR has_role('Admin') OR has_role('Super Admin')));
DROP POLICY IF EXISTS "ac_messages sender update" ON public.ac_messages;
CREATE POLICY "ac_messages sender update" ON public.ac_messages FOR UPDATE TO authenticated USING (sender_user_id = auth.uid() OR has_role('Admin') OR has_role('Super Admin'));
DROP POLICY IF EXISTS "ac_messages admin delete" ON public.ac_messages;
CREATE POLICY "ac_messages admin delete" ON public.ac_messages FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline',
  custom_status TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_user_presence TO authenticated;
GRANT ALL ON public.ac_user_presence TO service_role;
ALTER TABLE public.ac_user_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ac_presence read all authed" ON public.ac_user_presence;
CREATE POLICY "ac_presence read all authed" ON public.ac_user_presence FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ac_presence self upsert" ON public.ac_user_presence;
CREATE POLICY "ac_presence self upsert" ON public.ac_user_presence FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "ac_presence self update" ON public.ac_user_presence;
CREATE POLICY "ac_presence self update" ON public.ac_user_presence FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ac_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  language TEXT DEFAULT 'de',
  country TEXT,
  city TEXT,
  external_ids JSONB DEFAULT '{}'::jsonb,
  visitor_fingerprint TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_contacts TO authenticated;
GRANT ALL ON public.ac_contacts TO service_role;
ALTER TABLE public.ac_contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ac_contacts_email ON public.ac_contacts(email);
CREATE INDEX IF NOT EXISTS idx_ac_contacts_fp ON public.ac_contacts(visitor_fingerprint);
DROP POLICY IF EXISTS "ac_contacts staff read" ON public.ac_contacts;
CREATE POLICY "ac_contacts staff read" ON public.ac_contacts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ac_contacts staff insert" ON public.ac_contacts;
CREATE POLICY "ac_contacts staff insert" ON public.ac_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ac_contacts staff update" ON public.ac_contacts;
CREATE POLICY "ac_contacts staff update" ON public.ac_contacts FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ac_contacts admin delete" ON public.ac_contacts;
CREATE POLICY "ac_contacts admin delete" ON public.ac_contacts FOR DELETE TO authenticated USING (has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.ac_analytics_events (
  id BIGSERIAL PRIMARY KEY,
  website_id UUID REFERENCES public.ac_websites(id) ON DELETE CASCADE,
  tenant_id UUID,
  session_hash TEXT,
  visitor_hash TEXT,
  event_type TEXT NOT NULL,
  page_url TEXT,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  language TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  screen_size TEXT,
  duration_ms INT,
  scroll_depth INT,
  is_bot BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT ON public.ac_analytics_events TO authenticated;
GRANT ALL ON public.ac_analytics_events TO service_role;
ALTER TABLE public.ac_analytics_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ac_events_site_time ON public.ac_analytics_events(website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_events_session ON public.ac_analytics_events(session_hash);
CREATE INDEX IF NOT EXISTS idx_ac_events_type ON public.ac_analytics_events(event_type);
DROP POLICY IF EXISTS "ac_events staff read" ON public.ac_analytics_events;
CREATE POLICY "ac_events staff read" ON public.ac_analytics_events FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.ac_touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_ac_websites_upd ON public.ac_websites;
CREATE TRIGGER trg_ac_websites_upd BEFORE UPDATE ON public.ac_websites FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ac_channels_upd ON public.ac_channels;
CREATE TRIGGER trg_ac_channels_upd BEFORE UPDATE ON public.ac_channels FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ac_conv_upd ON public.ac_conversations;
CREATE TRIGGER trg_ac_conv_upd BEFORE UPDATE ON public.ac_conversations FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ac_messages_upd ON public.ac_messages;
CREATE TRIGGER trg_ac_messages_upd BEFORE UPDATE ON public.ac_messages FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ac_contacts_upd ON public.ac_contacts;
CREATE TRIGGER trg_ac_contacts_upd BEFORE UPDATE ON public.ac_contacts FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ac_presence_upd ON public.ac_user_presence;
CREATE TRIGGER trg_ac_presence_upd BEFORE UPDATE ON public.ac_user_presence FOR EACH ROW EXECUTE FUNCTION public.ac_touch_updated_at();

CREATE OR REPLACE FUNCTION public.ac_bump_conversation() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.ac_conversations
       SET last_message_at = NEW.created_at,
           last_message_preview = LEFT(COALESCE(NEW.body,''), 200),
           unread_count = CASE WHEN NEW.direction='inbound' THEN unread_count+1 ELSE unread_count END
     WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ac_messages_bump ON public.ac_messages;
CREATE TRIGGER trg_ac_messages_bump AFTER INSERT ON public.ac_messages FOR EACH ROW EXECUTE FUNCTION public.ac_bump_conversation();

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_conversations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_user_presence; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_channels; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.ac_messages REPLICA IDENTITY FULL;
ALTER TABLE public.ac_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.ac_user_presence REPLICA IDENTITY FULL;
