
CREATE TABLE IF NOT EXISTS public.customer_sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  document_id uuid,
  document_type text,
  document_number text,
  recipient_name text,
  phone text NOT NULL,
  message_text text NOT NULL,
  link_url text,
  twilio_sid text,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.customer_sms_logs TO authenticated;
GRANT ALL ON public.customer_sms_logs TO service_role;

ALTER TABLE public.customer_sms_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_send_customer_sms()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.has_role('Vertrieb')
      OR public.has_role('Kundenservice')
      OR public.has_role('Finance')
      OR public.has_role('Service')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Technik');
$$;

CREATE POLICY "sms_logs_select" ON public.customer_sms_logs
  FOR SELECT TO authenticated
  USING (public.can_send_customer_sms());

CREATE POLICY "sms_logs_insert" ON public.customer_sms_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_send_customer_sms() AND (sent_by IS NULL OR sent_by = auth.uid()));

CREATE POLICY "sms_logs_update_admin" ON public.customer_sms_logs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_customer_sms_logs_customer ON public.customer_sms_logs(customer_id, sent_at DESC);
