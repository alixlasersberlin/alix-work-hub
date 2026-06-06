
-- ============================================================
-- Tickets-Modul (AlixSmart-Integration)
-- ============================================================

-- Helper: Zugriff auf Tickets
CREATE OR REPLACE FUNCTION public.can_access_tickets()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Kundenservice')
    OR public.has_role('Technik')
    OR public.has_role('Finance')
    OR public.has_role('Tourenplanung');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_tickets()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Kundenservice')
    OR public.has_role('Technik');
$$;

-- ------------------------------------------------------------
-- tickets
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ticket_id text UNIQUE,
  source_system text NOT NULL DEFAULT 'alixsmart',
  customer_name text,
  company_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  order_number text,
  device_name text,
  serial_number text,
  title text,
  description text,
  status text NOT NULL DEFAULT 'offen',
  priority text NOT NULL DEFAULT 'normal',
  department text NOT NULL DEFAULT 'service',
  assigned_to uuid NULL,
  customer_visible_status text NOT NULL DEFAULT 'Ticket eingegangen',
  internal_note text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select_admin_service_technik"
ON public.tickets FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('Kundenservice') OR public.has_role('Technik'));

CREATE POLICY "tickets_select_finance"
ON public.tickets FOR SELECT TO authenticated
USING (public.has_role('Finance') AND department = 'finance');

CREATE POLICY "tickets_select_tourenplanung"
ON public.tickets FOR SELECT TO authenticated
USING (public.has_role('Tourenplanung') AND department IN ('lieferung','abholung','austausch','tourenplanung'));

CREATE POLICY "tickets_insert_manage"
ON public.tickets FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tickets());

CREATE POLICY "tickets_update_manage"
ON public.tickets FOR UPDATE TO authenticated
USING (public.can_manage_tickets())
WITH CHECK (public.can_manage_tickets());

-- nur Super Admin darf löschen (globale Regel)
CREATE POLICY "tickets_delete_super_admin"
ON public.tickets FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_department ON public.tickets(department);
CREATE INDEX IF NOT EXISTS idx_tickets_source ON public.tickets(source_system);
CREATE INDEX IF NOT EXISTS idx_tickets_external_id ON public.tickets(external_ticket_id);

-- ------------------------------------------------------------
-- ticket_messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  external_message_id text,
  sender_type text,
  sender_name text,
  sender_email text,
  message text,
  is_internal boolean NOT NULL DEFAULT false,
  source_system text NOT NULL DEFAULT 'alixsmart',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_messages_select"
ON public.ticket_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (
        public.is_admin()
        OR public.has_role('Kundenservice')
        OR public.has_role('Technik')
        OR (public.has_role('Finance') AND t.department = 'finance')
        OR (public.has_role('Tourenplanung') AND t.department IN ('lieferung','abholung','austausch','tourenplanung'))
      )
  )
);

CREATE POLICY "ticket_messages_insert"
ON public.ticket_messages FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tickets());

CREATE POLICY "ticket_messages_update"
ON public.ticket_messages FOR UPDATE TO authenticated
USING (public.can_manage_tickets())
WITH CHECK (public.can_manage_tickets());

CREATE POLICY "ticket_messages_delete"
ON public.ticket_messages FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);

-- ------------------------------------------------------------
-- ticket_attachments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_url text,
  file_name text,
  file_type text,
  file_size bigint,
  source_system text NOT NULL DEFAULT 'alixsmart',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.ticket_attachments TO service_role;

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_attachments_select"
ON public.ticket_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_attachments.ticket_id
      AND (
        public.is_admin()
        OR public.has_role('Kundenservice')
        OR public.has_role('Technik')
        OR (public.has_role('Finance') AND t.department = 'finance')
        OR (public.has_role('Tourenplanung') AND t.department IN ('lieferung','abholung','austausch','tourenplanung'))
      )
  )
);

CREATE POLICY "ticket_attachments_insert"
ON public.ticket_attachments FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tickets());

CREATE POLICY "ticket_attachments_update"
ON public.ticket_attachments FOR UPDATE TO authenticated
USING (public.can_manage_tickets())
WITH CHECK (public.can_manage_tickets());

CREATE POLICY "ticket_attachments_delete"
ON public.ticket_attachments FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON public.ticket_attachments(ticket_id);

-- ------------------------------------------------------------
-- ticket_sync_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ticket_id text,
  direction text,
  action text,
  status text,
  error_message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ticket_sync_logs TO authenticated;
GRANT ALL ON public.ticket_sync_logs TO service_role;

ALTER TABLE public.ticket_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_sync_logs_select_admin"
ON public.ticket_sync_logs FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "ticket_sync_logs_delete_super_admin"
ON public.ticket_sync_logs FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_ticket_sync_logs_external ON public.ticket_sync_logs(external_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_sync_logs_created ON public.ticket_sync_logs(created_at DESC);
