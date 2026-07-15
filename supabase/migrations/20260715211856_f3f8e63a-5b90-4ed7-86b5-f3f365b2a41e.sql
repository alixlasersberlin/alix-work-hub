
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_portal_users_status_chk') THEN
    ALTER TABLE public.customer_portal_users
      ADD CONSTRAINT customer_portal_users_status_chk
      CHECK (status IN ('invited','active','suspended','disabled'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.current_portal_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id
  FROM public.customer_portal_users
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_portal_customer_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_portal_customer_id() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.customer_portal_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  auth_user_id uuid,
  action text NOT NULL,
  object_type text,
  object_id text,
  success boolean NOT NULL DEFAULT true,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.customer_portal_audit_logs TO authenticated;
GRANT ALL ON public.customer_portal_audit_logs TO service_role;

ALTER TABLE public.customer_portal_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cp_audit_customer_created
  ON public.customer_portal_audit_logs (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_audit_user_created
  ON public.customer_portal_audit_logs (auth_user_id, created_at DESC);

DROP POLICY IF EXISTS "portal_user_insert_own_audit" ON public.customer_portal_audit_logs;
CREATE POLICY "portal_user_insert_own_audit"
  ON public.customer_portal_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    AND (
      customer_id IS NULL
      OR customer_id = public.current_portal_customer_id()
    )
  );

DROP POLICY IF EXISTS "internal_read_audit" ON public.customer_portal_audit_logs;
CREATE POLICY "internal_read_audit"
  ON public.customer_portal_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Buchhaltung')
  );

DROP POLICY IF EXISTS "portal_user_read_own_invoices" ON public.mail_attachments;
CREATE POLICY "portal_user_read_own_invoices"
  ON public.mail_attachments
  FOR SELECT
  TO authenticated
  USING (
    document_type = 'Rechnung'
    AND customer_id IS NOT NULL
    AND customer_id = public.current_portal_customer_id()
  );
