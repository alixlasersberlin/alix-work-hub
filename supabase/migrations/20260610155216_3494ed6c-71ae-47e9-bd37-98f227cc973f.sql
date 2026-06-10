
-- =====================================================
-- Phase 11: Finance Automations & Workflows
-- =====================================================

-- 1) finance_automations: Regel-basierte Engine
CREATE TABLE IF NOT EXISTS public.finance_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,            -- 'incoming_invoice_created' | 'invoice_threshold' | 'anomaly_detected' | 'forecast_deviation' | 'reminder_stage_reached' | 'payment_matched'
  condition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_type text NOT NULL,             -- 'set_status' | 'assign_approver' | 'notify' | 'send_email' | 'propose_sepa_run' | 'trigger_ai_insight'
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_automations TO authenticated;
GRANT ALL ON public.finance_automations TO service_role;
ALTER TABLE public.finance_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_automations_read"
  ON public.finance_automations FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY "finance_automations_insert"
  ON public.finance_automations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "finance_automations_update"
  ON public.finance_automations FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "finance_automations_delete"
  ON public.finance_automations FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_finance_automations_updated_at
  BEFORE UPDATE ON public.finance_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) finance_automation_runs: Audit/History of executed automations
CREATE TABLE IF NOT EXISTS public.finance_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES public.finance_automations(id) ON DELETE CASCADE,
  trigger_event text NOT NULL,
  target_entity text,                    -- e.g. 'finance_incoming_invoices'
  target_id text,
  status text NOT NULL DEFAULT 'success',-- 'success' | 'skipped' | 'failed'
  message text,
  payload jsonb,
  executed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.finance_automation_runs TO authenticated;
GRANT ALL ON public.finance_automation_runs TO service_role;
ALTER TABLE public.finance_automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_runs_read"
  ON public.finance_automation_runs FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY "automation_runs_insert"
  ON public.finance_automation_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "automation_runs_delete"
  ON public.finance_automation_runs FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_finance_automation_runs_automation
  ON public.finance_automation_runs(automation_id, executed_at DESC);

-- 3) finance_approvals: einheitliche Genehmigungs-Inbox
CREATE TABLE IF NOT EXISTS public.finance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,             -- 'incoming_invoice' | 'sepa_run' | 'reminder_batch' | 'year_end_run'
  entity_id uuid NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  amount numeric(14,2),
  currency text DEFAULT 'EUR',
  threshold_amount numeric(14,2),
  requires_dual_approval boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',-- 'pending' | 'approved' | 'rejected' | 'cancelled'
  assigned_to uuid,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  second_approver_id uuid,
  second_approved_at timestamptz,
  rejection_reason text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_approvals TO authenticated;
GRANT ALL ON public.finance_approvals TO service_role;
ALTER TABLE public.finance_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals_read"
  ON public.finance_approvals FOR SELECT TO authenticated
  USING (public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY "approvals_insert"
  ON public.finance_approvals FOR INSERT TO authenticated
  WITH CHECK (public.can_access_finance());
CREATE POLICY "approvals_update"
  ON public.finance_approvals FOR UPDATE TO authenticated
  USING (public.can_access_finance() OR public.has_role('Geschäftsführung'))
  WITH CHECK (public.can_access_finance() OR public.has_role('Geschäftsführung'));
CREATE POLICY "approvals_delete"
  ON public.finance_approvals FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE TRIGGER trg_finance_approvals_updated_at
  BEFORE UPDATE ON public.finance_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_finance_approvals_status
  ON public.finance_approvals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_approvals_entity
  ON public.finance_approvals(entity_type, entity_id);

-- 4) Trigger: bei neuer Eingangsrechnung automatisch Genehmigung anlegen,
--    wenn amount_gross >= threshold (default 1000 EUR, Einstellung in app_settings)
CREATE OR REPLACE FUNCTION public.create_invoice_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold numeric := 1000;
  v_dual_threshold numeric := 10000;
  v_setting text;
BEGIN
  SELECT value INTO v_setting FROM public.app_settings WHERE key = 'finance.approval.threshold' LIMIT 1;
  IF v_setting IS NOT NULL THEN
    BEGIN v_threshold := v_setting::numeric; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  SELECT value INTO v_setting FROM public.app_settings WHERE key = 'finance.approval.dual_threshold' LIMIT 1;
  IF v_setting IS NOT NULL THEN
    BEGIN v_dual_threshold := v_setting::numeric; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  IF COALESCE(NEW.amount_gross, 0) >= v_threshold THEN
    INSERT INTO public.finance_approvals (
      entity_type, entity_id, tenant_id, title, description, amount, currency,
      threshold_amount, requires_dual_approval, requested_by
    ) VALUES (
      'incoming_invoice', NEW.id, NEW.tenant_id,
      'Eingangsrechnung ' || COALESCE(NEW.invoice_number, NEW.internal_number),
      COALESCE(NEW.supplier_name, '') || ' – ' || COALESCE(NEW.description, ''),
      NEW.amount_gross, COALESCE(NEW.currency, 'EUR'),
      v_threshold, COALESCE(NEW.amount_gross, 0) >= v_dual_threshold,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_invoice_approval ON public.finance_incoming_invoices;
CREATE TRIGGER trg_create_invoice_approval
  AFTER INSERT ON public.finance_incoming_invoices
  FOR EACH ROW EXECUTE FUNCTION public.create_invoice_approval();

-- 5) Default-Settings für Schwellwerte (idempotent)
INSERT INTO public.app_settings (key, value)
VALUES
  ('finance.approval.threshold', '1000'),
  ('finance.approval.dual_threshold', '10000')
ON CONFLICT (key) DO NOTHING;
