
ALTER TABLE public.ac_contacts
  ADD COLUMN IF NOT EXISTS sms_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_opt_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifetime_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;

ALTER TABLE public.ac_messages
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_reason text;

ALTER TABLE public.mail_messages
  ADD COLUMN IF NOT EXISTS ac_contact_id uuid,
  ADD COLUMN IF NOT EXISTS linked_order_id uuid,
  ADD COLUMN IF NOT EXISTS linked_ticket_id uuid;

CREATE INDEX IF NOT EXISTS idx_mail_messages_ac_contact ON public.mail_messages(ac_contact_id);

CREATE TABLE IF NOT EXISTS public.ac_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{read}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_api_keys TO authenticated;
GRANT ALL ON public.ac_api_keys TO service_role;
ALTER TABLE public.ac_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage api keys" ON public.ac_api_keys FOR ALL TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'))
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));

CREATE TABLE IF NOT EXISTS public.ac_webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ac_webhook_subscriptions TO authenticated;
GRANT ALL ON public.ac_webhook_subscriptions TO service_role;
ALTER TABLE public.ac_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage webhooks" ON public.ac_webhook_subscriptions FOR ALL TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'))
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));

CREATE TABLE IF NOT EXISTS public.ac_event_bus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  subscription_id uuid REFERENCES public.ac_webhook_subscriptions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_response_code integer,
  last_response_body text,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.ac_event_bus TO authenticated;
GRANT ALL ON public.ac_event_bus TO service_role;
ALTER TABLE public.ac_event_bus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read events" ON public.ac_event_bus FOR SELECT TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));
CREATE INDEX IF NOT EXISTS idx_ac_event_bus_status ON public.ac_event_bus(status, next_retry_at);

CREATE TABLE IF NOT EXISTS public.ac_customer_scores (
  contact_id uuid PRIMARY KEY REFERENCES public.ac_contacts(id) ON DELETE CASCADE,
  churn_score numeric NOT NULL DEFAULT 0,
  engagement_score numeric NOT NULL DEFAULT 0,
  segment text,
  next_best_action text,
  reasoning text,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ac_customer_scores TO authenticated;
GRANT ALL ON public.ac_customer_scores TO service_role;
ALTER TABLE public.ac_customer_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read scores" ON public.ac_customer_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff upsert scores" ON public.ac_customer_scores FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin'));
CREATE POLICY "staff update scores" ON public.ac_customer_scores FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin'));
