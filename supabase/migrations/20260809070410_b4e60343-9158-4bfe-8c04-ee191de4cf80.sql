CREATE TABLE public.delivery_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  warehouse_status text NOT NULL DEFAULT 'open',
  warehouse_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  warehouse_comment text,
  warehouse_by uuid,
  warehouse_by_name text,
  warehouse_at timestamptz,
  warehouse_ip text,
  warehouse_signature text,
  warehouse_reminded_at timestamptz,
  warehouse_escalated_at timestamptz,
  accounting_status text NOT NULL DEFAULT 'open',
  accounting_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  accounting_comment text,
  accounting_by uuid,
  accounting_by_name text,
  accounting_at timestamptz,
  accounting_ip text,
  accounting_signature text,
  accounting_reminded_at timestamptz,
  accounting_escalated_at timestamptz,
  dispatch_status text NOT NULL DEFAULT 'open',
  dispatch_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  dispatch_comment text,
  dispatch_by uuid,
  dispatch_by_name text,
  dispatch_at timestamptz,
  dispatch_ip text,
  dispatch_signature text,
  dispatch_reminded_at timestamptz,
  dispatch_escalated_at timestamptz,
  overall_status text NOT NULL DEFAULT 'blocked',
  released_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  unlocked_by uuid,
  unlocked_at timestamptz,
  unlock_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_approvals TO authenticated;
GRANT ALL ON public.delivery_approvals TO service_role;
ALTER TABLE public.delivery_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "da_select_auth" ON public.delivery_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "da_insert_auth" ON public.delivery_approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "da_update_auth" ON public.delivery_approvals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "da_delete_superadmin" ON public.delivery_approvals FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX idx_delivery_approvals_order ON public.delivery_approvals(order_id);
CREATE INDEX idx_delivery_approvals_overall ON public.delivery_approvals(overall_status);

CREATE TABLE public.delivery_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid REFERENCES public.delivery_approvals(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  stage text NOT NULL,
  old_status text,
  new_status text,
  user_id uuid,
  user_name text,
  comment text,
  ip_address text,
  signature text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.delivery_approval_events TO authenticated;
GRANT ALL ON public.delivery_approval_events TO service_role;
ALTER TABLE public.delivery_approval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dae_select_auth" ON public.delivery_approval_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "dae_insert_auth" ON public.delivery_approval_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_dae_order ON public.delivery_approval_events(order_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.delivery_approvals_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.warehouse_status = 'approved' AND NEW.accounting_status = 'approved' AND NEW.dispatch_status = 'approved' THEN
    IF NEW.overall_status NOT IN ('delivered','completed') THEN
      NEW.overall_status := 'released';
      IF NEW.released_at IS NULL THEN NEW.released_at := now(); END IF;
    END IF;
  ELSIF NEW.warehouse_status <> 'open' OR NEW.accounting_status <> 'open' OR NEW.dispatch_status <> 'open' THEN
    IF NEW.overall_status NOT IN ('delivered','completed') THEN
      NEW.overall_status := 'waiting';
      NEW.released_at := NULL;
    END IF;
  ELSE
    NEW.overall_status := 'blocked';
    NEW.released_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_delivery_approvals_touch
BEFORE INSERT OR UPDATE ON public.delivery_approvals
FOR EACH ROW EXECUTE FUNCTION public.delivery_approvals_touch();