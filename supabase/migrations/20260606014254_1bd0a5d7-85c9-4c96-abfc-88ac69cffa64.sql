
ALTER TABLE public.mail_automations
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

CREATE TABLE IF NOT EXISTS public.mail_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.mail_automations(id) ON DELETE CASCADE,
  customer_id uuid,
  order_id uuid,
  invoice_id uuid,
  ticket_id uuid,
  repair_id uuid,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  message_id uuid,
  executed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mail_automation_runs_unique
  ON public.mail_automation_runs(
    automation_id,
    COALESCE(order_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(invoice_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(repair_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(ticket_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(customer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS mail_automation_runs_automation_idx
  ON public.mail_automation_runs(automation_id, executed_at DESC);

GRANT SELECT ON public.mail_automation_runs TO authenticated;
GRANT ALL ON public.mail_automation_runs TO service_role;

ALTER TABLE public.mail_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_automation_runs_select"
  ON public.mail_automation_runs FOR SELECT
  TO authenticated
  USING (public.can_access_mail());

CREATE POLICY "mail_automation_runs_delete"
  ON public.mail_automation_runs FOR DELETE
  TO authenticated
  USING (public.has_role('Super Admin'));
