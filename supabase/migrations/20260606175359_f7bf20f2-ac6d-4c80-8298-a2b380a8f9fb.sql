
-- whatsapp_sc_conversations
CREATE TABLE public.whatsapp_sc_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL UNIQUE,
  customer_name text,
  linked_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  linked_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  assigned_department text NOT NULL DEFAULT 'service',
  assigned_to uuid,
  unread_count int NOT NULL DEFAULT 0,
  opt_out boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sc_conversations TO authenticated;
GRANT ALL ON public.whatsapp_sc_conversations TO service_role;
ALTER TABLE public.whatsapp_sc_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wasc_conv_read" ON public.whatsapp_sc_conversations FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.has_role('Kundenservice')
  OR (public.has_role('Technik') AND assigned_department = 'technik')
  OR (public.has_role('Finance') AND assigned_department = 'finance')
  OR (public.has_role('Tourenplanung') AND assigned_department = 'tourenplanung')
);
CREATE POLICY "wasc_conv_insert" ON public.whatsapp_sc_conversations FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Kundenservice'));
CREATE POLICY "wasc_conv_update" ON public.whatsapp_sc_conversations FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('Kundenservice'))
WITH CHECK (public.is_admin() OR public.has_role('Kundenservice'));
CREATE POLICY "wasc_conv_delete" ON public.whatsapp_sc_conversations FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_wasc_conv_updated BEFORE UPDATE ON public.whatsapp_sc_conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- whatsapp_sc_messages
CREATE TABLE public.whatsapp_sc_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_sc_conversations(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  sender_name text,
  sender_phone text,
  message_text text,
  media_url text,
  media_type text,
  whatsapp_message_id text UNIQUE,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sc_messages TO authenticated;
GRANT ALL ON public.whatsapp_sc_messages TO service_role;
ALTER TABLE public.whatsapp_sc_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wasc_msg_read" ON public.whatsapp_sc_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_sc_conversations c
    WHERE c.id = whatsapp_sc_messages.conversation_id
      AND (
        public.is_admin()
        OR public.has_role('Kundenservice')
        OR (public.has_role('Technik') AND c.assigned_department = 'technik')
        OR (public.has_role('Finance') AND c.assigned_department = 'finance')
        OR (public.has_role('Tourenplanung') AND c.assigned_department = 'tourenplanung')
      )
  )
);
CREATE POLICY "wasc_msg_insert" ON public.whatsapp_sc_messages FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_role('Kundenservice'));
CREATE POLICY "wasc_msg_delete" ON public.whatsapp_sc_messages FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE INDEX idx_wasc_msg_conv ON public.whatsapp_sc_messages(conversation_id, created_at DESC);

-- whatsapp_sync_logs
CREATE TABLE public.whatsapp_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  status text NOT NULL,
  error_message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_sync_logs TO authenticated;
GRANT ALL ON public.whatsapp_sync_logs TO service_role;
ALTER TABLE public.whatsapp_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_logs_read" ON public.whatsapp_sync_logs FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Kundenservice'));
CREATE POLICY "wa_logs_delete" ON public.whatsapp_sync_logs FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

-- whatsapp_sc_templates (Service-Center Standardantworten)
CREATE TABLE public.whatsapp_sc_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  language text NOT NULL DEFAULT 'de',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sc_templates TO authenticated;
GRANT ALL ON public.whatsapp_sc_templates TO service_role;
ALTER TABLE public.whatsapp_sc_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wasc_tpl_read" ON public.whatsapp_sc_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "wasc_tpl_write" ON public.whatsapp_sc_templates FOR INSERT TO authenticated
WITH CHECK (public.is_admin());
CREATE POLICY "wasc_tpl_update" ON public.whatsapp_sc_templates FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "wasc_tpl_delete" ON public.whatsapp_sc_templates FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_wasc_tpl_updated BEFORE UPDATE ON public.whatsapp_sc_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.whatsapp_sc_templates (key, title, body) VALUES
  ('ticket_received','Ticket eingegangen','Hallo, vielen Dank für Ihre Nachricht. Ihr Anliegen wurde erfasst und wir melden uns in Kürze.'),
  ('request_serial','Bitte Seriennummer senden','Bitte senden Sie uns die Seriennummer Ihres Geräts, damit wir es zuordnen können.'),
  ('request_media','Bitte Foto oder Video senden','Könnten Sie uns ein kurzes Foto oder Video des Problems senden? Das hilft uns bei der Diagnose.'),
  ('technician_check','Techniker prüft den Fall','Unser Techniker prüft Ihren Fall und meldet sich schnellstmöglich bei Ihnen zurück.'),
  ('part_check','Ersatzteil wird geprüft','Wir prüfen aktuell die Verfügbarkeit des passenden Ersatzteils und informieren Sie zeitnah.'),
  ('repair_done','Reparatur abgeschlossen','Ihre Reparatur ist abgeschlossen. Sie erhalten in Kürze Informationen zur Rücksendung bzw. Abholung.'),
  ('appointment','Termin wird geplant','Wir planen einen Termin für Sie und melden uns mit einem Vorschlag.');
