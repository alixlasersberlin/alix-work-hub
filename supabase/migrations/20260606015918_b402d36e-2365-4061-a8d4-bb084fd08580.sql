
-- =====================================================================
-- 1. Kundenportal-Benutzer
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','disabled')),
  invited_at timestamptz,
  accepted_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_portal_users TO authenticated;
GRANT ALL ON public.customer_portal_users TO service_role;
ALTER TABLE public.customer_portal_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpu_select_self" ON public.customer_portal_users
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "cpu_admin_manage_insert" ON public.customer_portal_users
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "cpu_admin_manage_update" ON public.customer_portal_users
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "cpu_admin_manage_delete" ON public.customer_portal_users
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_cpu_customer ON public.customer_portal_users(customer_id);
CREATE TRIGGER trg_cpu_updated_at BEFORE UPDATE ON public.customer_portal_users
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- =====================================================================
-- 2. Helper: aktive Kunden-ID aus Portal-Session
-- =====================================================================
CREATE OR REPLACE FUNCTION public.current_portal_customer_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id
    FROM public.customer_portal_users
   WHERE user_id = auth.uid()
     AND status = 'active'
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_portal_customer()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.customer_portal_users
     WHERE user_id = auth.uid() AND status = 'active'
  )
$$;

-- =====================================================================
-- 3. Angebotsannahmen / -ablehnungen
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_quote_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  response text NOT NULL CHECK (response IN ('accepted','rejected')),
  signed_name text,
  note text,
  ip_address text,
  user_agent text,
  responded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_portal_quote_responses TO authenticated;
GRANT ALL ON public.customer_portal_quote_responses TO service_role;
ALTER TABLE public.customer_portal_quote_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpqr_select" ON public.customer_portal_quote_responses
  FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id() OR public.can_access_orders());
CREATE POLICY "cpqr_insert_customer" ON public.customer_portal_quote_responses
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = public.current_portal_customer_id());
CREATE POLICY "cpqr_admin_delete" ON public.customer_portal_quote_responses
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_cpqr_customer ON public.customer_portal_quote_responses(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpqr_order ON public.customer_portal_quote_responses(order_id);

-- =====================================================================
-- 4. Support-Tickets aus dem Kundenportal
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text DEFAULT 'Allgemein',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  priority text NOT NULL DEFAULT 'Normal'
    CHECK (priority IN ('Niedrig','Normal','Hoch','Kritisch')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.customer_portal_tickets TO authenticated;
GRANT DELETE ON public.customer_portal_tickets TO authenticated;
GRANT ALL ON public.customer_portal_tickets TO service_role;
ALTER TABLE public.customer_portal_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpt_select" ON public.customer_portal_tickets
  FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id() OR public.can_access_mail());
CREATE POLICY "cpt_insert_customer" ON public.customer_portal_tickets
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = public.current_portal_customer_id());
CREATE POLICY "cpt_update_staff" ON public.customer_portal_tickets
  FOR UPDATE TO authenticated
  USING (public.can_access_mail() OR customer_id = public.current_portal_customer_id());
CREATE POLICY "cpt_delete_admin" ON public.customer_portal_tickets
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_cpt_customer ON public.customer_portal_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpt_status ON public.customer_portal_tickets(status);
CREATE TRIGGER trg_cpt_updated_at BEFORE UPDATE ON public.customer_portal_tickets
  FOR EACH ROW EXECUTE FUNCTION public.mail_set_updated_at();

-- =====================================================================
-- 5. Ticket-Nachrichten
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.customer_portal_tickets(id) ON DELETE CASCADE,
  from_role text NOT NULL CHECK (from_role IN ('customer','staff')),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  attachment_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_portal_ticket_messages TO authenticated;
GRANT ALL ON public.customer_portal_ticket_messages TO service_role;
ALTER TABLE public.customer_portal_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cptm_select" ON public.customer_portal_ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_portal_tickets t
       WHERE t.id = ticket_id
         AND (t.customer_id = public.current_portal_customer_id() OR public.can_access_mail())
    )
  );
CREATE POLICY "cptm_insert" ON public.customer_portal_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customer_portal_tickets t
       WHERE t.id = ticket_id
         AND (
           (from_role = 'customer' AND t.customer_id = public.current_portal_customer_id())
           OR (from_role = 'staff' AND public.can_access_mail())
         )
    )
  );

CREATE INDEX IF NOT EXISTS idx_cptm_ticket ON public.customer_portal_ticket_messages(ticket_id);

-- =====================================================================
-- 6. Download-Protokoll
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customer_portal_document_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  attachment_id uuid REFERENCES public.mail_attachments(id) ON DELETE SET NULL,
  document_type text,
  storage_bucket text,
  storage_path text,
  ip_address text,
  user_agent text,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_portal_document_downloads TO authenticated;
GRANT ALL ON public.customer_portal_document_downloads TO service_role;
ALTER TABLE public.customer_portal_document_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpdd_select" ON public.customer_portal_document_downloads
  FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id() OR public.can_access_mail());
CREATE POLICY "cpdd_insert_customer" ON public.customer_portal_document_downloads
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = public.current_portal_customer_id());

CREATE INDEX IF NOT EXISTS idx_cpdd_customer ON public.customer_portal_document_downloads(customer_id);

-- =====================================================================
-- 7. Zusätzliche SELECT-Policies für eingeloggte Portal-Kunden
--    (additiv – bestehende Mitarbeiter-Policies bleiben unverändert)
-- =====================================================================
CREATE POLICY "portal_customer_select_own"
  ON public.customers FOR SELECT TO authenticated
  USING (id = public.current_portal_customer_id());

CREATE POLICY "portal_customer_select_own_orders"
  ON public.orders FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id());

CREATE POLICY "portal_customer_select_own_production"
  ON public.production_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = production_orders.order_id
         AND o.customer_id = public.current_portal_customer_id()
    )
  );

CREATE POLICY "portal_customer_select_own_repairs"
  ON public.repair_orders FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id());

CREATE POLICY "portal_customer_select_own_mail"
  ON public.mail_messages FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id());

CREATE POLICY "portal_customer_select_own_attachments"
  ON public.mail_attachments FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id());

CREATE POLICY "portal_customer_select_own_reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (customer_id = public.current_portal_customer_id());
