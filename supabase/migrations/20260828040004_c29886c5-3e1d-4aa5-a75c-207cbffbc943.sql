CREATE TABLE IF NOT EXISTS public.order_delivery_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  phase text NOT NULL DEFAULT 'order_received',
  sub_status text,
  production_started_at date,
  production_end_planned date,
  qc_started_at date,
  qc_completed_at date,
  production_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  qc_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  eta_earliest date,
  eta_planned date,
  eta_latest date,
  eta_confirmed boolean NOT NULL DEFAULT false,
  tour_id uuid,
  time_window_start time,
  time_window_end time,
  is_delayed boolean NOT NULL DEFAULT false,
  delay_reason_internal text,
  customer_delay_reason text,
  partial_delivery boolean NOT NULL DEFAULT false,
  customer_note text,
  notify_customer boolean NOT NULL DEFAULT true,
  last_status_change timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_delivery_status TO authenticated;
GRANT ALL ON public.order_delivery_status TO service_role;
ALTER TABLE public.order_delivery_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ods_select_auth" ON public.order_delivery_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "ods_insert_auth" ON public.order_delivery_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ods_update_auth" ON public.order_delivery_status FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ods_delete_superadmin" ON public.order_delivery_status FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_ods_order_id ON public.order_delivery_status(order_id);

CREATE TABLE IF NOT EXISTS public.order_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'status_change',
  title text NOT NULL,
  description text,
  visible_to_customer boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_delivery_events TO authenticated;
GRANT ALL ON public.order_delivery_events TO service_role;
ALTER TABLE public.order_delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ode_select_auth" ON public.order_delivery_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "ode_insert_auth" ON public.order_delivery_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ode_update_auth" ON public.order_delivery_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ode_delete_superadmin" ON public.order_delivery_events FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_ode_order_id ON public.order_delivery_events(order_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.order_delivery_status_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND (NEW.phase IS DISTINCT FROM OLD.phase
      OR NEW.eta_planned IS DISTINCT FROM OLD.eta_planned
      OR NEW.is_delayed IS DISTINCT FROM OLD.is_delayed) THEN
    NEW.last_status_change := now();
    INSERT INTO public.order_delivery_events(order_id, event_type, title, description, visible_to_customer, created_by)
    VALUES (
      NEW.order_id,
      CASE WHEN NEW.phase IS DISTINCT FROM OLD.phase THEN 'phase_change'
           WHEN NEW.is_delayed IS DISTINCT FROM OLD.is_delayed THEN 'delay'
           ELSE 'eta_change' END,
      CASE WHEN NEW.phase IS DISTINCT FROM OLD.phase THEN 'Statusaktualisierung'
           WHEN NEW.is_delayed AND NOT OLD.is_delayed THEN 'Aktualisierung zu Ihrer Lieferung'
           ELSE 'Liefertermin aktualisiert' END,
      COALESCE(NEW.customer_note, NEW.customer_delay_reason),
      true,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_delivery_status_touch ON public.order_delivery_status;
CREATE TRIGGER trg_order_delivery_status_touch
BEFORE UPDATE ON public.order_delivery_status
FOR EACH ROW EXECUTE FUNCTION public.order_delivery_status_touch();