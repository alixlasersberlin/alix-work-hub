-- 1) ac_messages Erweiterungen (additiv)
ALTER TABLE public.ac_messages
  ADD COLUMN IF NOT EXISTS client_message_id uuid,
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.ac_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ac_messages_client_msg
  ON public.ac_messages(client_message_id) WHERE client_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ac_messages_provider_msg
  ON public.ac_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- 2) Schnellantworten
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text,
  department text,
  channel_type text NOT NULL DEFAULT 'WHATSAPP',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_replies TO authenticated;
GRANT ALL ON public.quick_replies TO service_role;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qr_read ON public.quick_replies;
CREATE POLICY qr_read ON public.quick_replies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS qr_admin_write ON public.quick_replies;
CREATE POLICY qr_admin_write ON public.quick_replies FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.quick_reply_favorites (
  user_id uuid NOT NULL,
  quick_reply_id uuid NOT NULL REFERENCES public.quick_replies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quick_reply_id)
);
GRANT SELECT, INSERT, DELETE ON public.quick_reply_favorites TO authenticated;
GRANT ALL ON public.quick_reply_favorites TO service_role;
ALTER TABLE public.quick_reply_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qrf_own ON public.quick_reply_favorites;
CREATE POLICY qrf_own ON public.quick_reply_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3) Chat <-> Gerät
CREATE TABLE IF NOT EXISTS public.conversation_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ac_conversations(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.lager_devices(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_devices TO authenticated;
GRANT ALL ON public.conversation_devices TO service_role;
ALTER TABLE public.conversation_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_staff ON public.conversation_devices;
CREATE POLICY cd_staff ON public.conversation_devices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ac_conversations c WHERE c.id = conversation_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ac_conversations c WHERE c.id = conversation_id));

-- 4) Chat <-> Ticket
CREATE TABLE IF NOT EXISTS public.conversation_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ac_conversations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, ticket_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_tickets TO authenticated;
GRANT ALL ON public.conversation_tickets TO service_role;
ALTER TABLE public.conversation_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ct_staff ON public.conversation_tickets;
CREATE POLICY ct_staff ON public.conversation_tickets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ac_conversations c WHERE c.id = conversation_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ac_conversations c WHERE c.id = conversation_id));

-- 5) WhatsApp Templates erweitern
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.ac_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_template_id text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS body_preview text;

-- 6) Kanal-Diagnosefelder
ALTER TABLE public.ac_channels
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_phone_number text;

-- 7) Feature Flags
INSERT INTO public.app_settings(key, value) VALUES
  ('whatsapp_inbound_enabled','true'),
  ('whatsapp_outbound_enabled','false'),
  ('media_send_enabled','true'),
  ('ticket_from_chat_enabled','true'),
  ('voice_messages_enabled','false'),
  ('templates_enabled','true')
ON CONFLICT (key) DO NOTHING;

-- 8) Standard-Schnellantworten
INSERT INTO public.quick_replies (title, body, category, sort_order) VALUES
  ('Eingang bestätigt','Guten Tag {{customer_name}}, vielen Dank für Ihre Nachricht. Wir prüfen Ihr Anliegen und melden uns zeitnah zurück.','ALLGEMEIN',10),
  ('Technik Rückfrage','Guten Tag {{customer_name}}, für die Prüfung benötigen wir bitte die Seriennummer Ihres Geräts sowie ein Foto der Fehlermeldung.','TECHNIK',20),
  ('Ticket aufgenommen','Vielen Dank. Ihr Anliegen wurde unter der Ticketnummer {{ticket_number}} aufgenommen. Unser Team meldet sich.','TECHNIK',30),
  ('Termin Vorschlag','Guten Tag {{customer_name}}, wir können Ihnen einen Termin anbieten. Passt Ihnen der genannte Zeitraum?','TERMIN',40),
  ('Rechnung Rückfrage','Guten Tag {{customer_name}}, wir prüfen Ihre Rechnungsanfrage und senden Ihnen kurzfristig eine Rückmeldung.','RECHNUNG',50)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.quick_replies_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_quick_replies_touch ON public.quick_replies;
CREATE TRIGGER trg_quick_replies_touch BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.quick_replies_touch();