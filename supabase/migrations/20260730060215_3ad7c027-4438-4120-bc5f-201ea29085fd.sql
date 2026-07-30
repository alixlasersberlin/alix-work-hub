CREATE TABLE public.finance_tax_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id uuid REFERENCES public.finance_tax_filings(id) ON DELETE SET NULL,
  tenant_id uuid,
  accounting_region public.accounting_region NOT NULL DEFAULT 'EU',
  filing_type text,
  period_value text,
  due_date date NOT NULL DEFAULT (current_date),
  amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  paid_date date,
  payment_reference text,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tax_payments TO authenticated;
GRANT ALL ON public.finance_tax_payments TO service_role;

ALTER TABLE public.finance_tax_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY ftp_select ON public.finance_tax_payments FOR SELECT TO authenticated
USING ((is_admin() OR can_access_finance() OR has_role('Geschäftsführung')) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));

CREATE POLICY ftp_insert ON public.finance_tax_payments FOR INSERT TO authenticated
WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));

CREATE POLICY ftp_update ON public.finance_tax_payments FOR UPDATE TO authenticated
USING ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)))
WITH CHECK ((is_admin() OR can_access_finance()) AND (tenant_id IS NULL OR has_tenant_access(tenant_id)));

CREATE POLICY ftp_delete ON public.finance_tax_payments FOR DELETE TO authenticated
USING (has_role('Super Admin'));

CREATE INDEX idx_fin_tax_pay_region_due ON public.finance_tax_payments (accounting_region, due_date DESC);
CREATE INDEX idx_fin_tax_pay_filing ON public.finance_tax_payments (filing_id);

CREATE TRIGGER trg_fin_tax_payments_updated_at
BEFORE UPDATE ON public.finance_tax_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.fin_tax_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.paid_amount >= NEW.amount AND NEW.amount <> 0 THEN
    NEW.status := 'paid';
    IF NEW.paid_date IS NULL THEN NEW.paid_date := current_date; END IF;
  ELSIF NEW.paid_amount > 0 THEN
    NEW.status := 'partial';
  ELSIF NEW.due_date < current_date THEN
    NEW.status := 'overdue';
  ELSE
    NEW.status := 'open';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fin_tax_payment_status
BEFORE INSERT OR UPDATE ON public.finance_tax_payments
FOR EACH ROW EXECUTE FUNCTION public.fin_tax_payment_status();