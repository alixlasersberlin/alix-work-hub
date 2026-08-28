
ALTER TABLE public.order_delivery_status
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS eta_state text,
  ADD COLUMN IF NOT EXISTS traffic_light text,
  ADD COLUMN IF NOT EXISTS owner_overall uuid,
  ADD COLUMN IF NOT EXISTS owner_production uuid,
  ADD COLUMN IF NOT EXISTS owner_qc uuid,
  ADD COLUMN IF NOT EXISTS owner_provisioning uuid,
  ADD COLUMN IF NOT EXISTS owner_accounting uuid,
  ADD COLUMN IF NOT EXISTS owner_dispatch uuid,
  ADD COLUMN IF NOT EXISTS address_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS address_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onsite_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reschedule_preference jsonb,
  ADD COLUMN IF NOT EXISTS confirm_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirm_reminder_last_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirm_due_date date,
  ADD COLUMN IF NOT EXISTS show_contact_to_customer boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.order_delivery_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  blocker_type text NOT NULL,
  blocker_status text NOT NULL DEFAULT 'open',
  severity text NOT NULL DEFAULT 'medium',
  internal_note text,
  customer_visible_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_delivery_blockers TO authenticated;
GRANT ALL ON public.order_delivery_blockers TO service_role;
ALTER TABLE public.order_delivery_blockers ENABLE ROW LEVEL SECURITY;
CREATE POLICY odb_select_auth ON public.order_delivery_blockers FOR SELECT TO authenticated USING (true);
CREATE POLICY odb_insert_auth ON public.order_delivery_blockers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY odb_update_auth ON public.order_delivery_blockers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY odb_delete_superadmin ON public.order_delivery_blockers FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
CREATE INDEX IF NOT EXISTS idx_odb_order ON public.order_delivery_blockers(order_id);
CREATE INDEX IF NOT EXISTS idx_odb_status ON public.order_delivery_blockers(blocker_status);

CREATE TABLE IF NOT EXISTS public.order_delivery_eta_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  old_date date,
  new_date date,
  old_state text,
  new_state text,
  reason text,
  source text NOT NULL DEFAULT 'manual',
  customer_informed boolean NOT NULL DEFAULT false,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_delivery_eta_history TO authenticated;
GRANT ALL ON public.order_delivery_eta_history TO service_role;
ALTER TABLE public.order_delivery_eta_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY odeh_select_auth ON public.order_delivery_eta_history FOR SELECT TO authenticated USING (true);
CREATE POLICY odeh_insert_auth ON public.order_delivery_eta_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY odeh_delete_superadmin ON public.order_delivery_eta_history FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
CREATE INDEX IF NOT EXISTS idx_odeh_order ON public.order_delivery_eta_history(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_delivery_comms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  channel text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  event_key text,
  subject text,
  body text,
  recipient text,
  success boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_delivery_comms TO authenticated;
GRANT ALL ON public.order_delivery_comms TO service_role;
ALTER TABLE public.order_delivery_comms ENABLE ROW LEVEL SECURITY;
CREATE POLICY odc_select_auth ON public.order_delivery_comms FOR SELECT TO authenticated USING (true);
CREATE POLICY odc_insert_auth ON public.order_delivery_comms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY odc_delete_superadmin ON public.order_delivery_comms FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
CREATE INDEX IF NOT EXISTS idx_odc_order ON public.order_delivery_comms(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_delivery_address_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  proposed jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  status text NOT NULL DEFAULT 'open',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.order_delivery_address_requests TO authenticated;
GRANT ALL ON public.order_delivery_address_requests TO service_role;
ALTER TABLE public.order_delivery_address_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY odar_select_auth ON public.order_delivery_address_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY odar_insert_auth ON public.order_delivery_address_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY odar_update_auth ON public.order_delivery_address_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY odar_delete_superadmin ON public.order_delivery_address_requests FOR DELETE TO authenticated USING (has_role('Super Admin'::text));
CREATE INDEX IF NOT EXISTS idx_odar_order ON public.order_delivery_address_requests(order_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_delivery_eta_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.eta_planned IS DISTINCT FROM OLD.eta_planned
      OR NEW.eta_state IS DISTINCT FROM OLD.eta_state) THEN
    INSERT INTO public.order_delivery_eta_history
      (order_id, old_date, new_date, old_state, new_state, reason, source, changed_by)
    VALUES (NEW.order_id, OLD.eta_planned, NEW.eta_planned, OLD.eta_state, NEW.eta_state,
            NEW.delay_reason_internal, 'manual', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_delivery_eta_change ON public.order_delivery_status;
CREATE TRIGGER trg_log_delivery_eta_change
  AFTER UPDATE ON public.order_delivery_status
  FOR EACH ROW EXECUTE FUNCTION public.log_delivery_eta_change();
