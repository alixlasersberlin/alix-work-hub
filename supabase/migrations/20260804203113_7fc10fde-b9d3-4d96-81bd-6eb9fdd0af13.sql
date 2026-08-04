CREATE OR REPLACE FUNCTION public.finance_inherit_accounting_region()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_region public.accounting_region;
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.accounting_region IS NULL OR NEW.accounting_region = 'EU') THEN
    IF to_jsonb(NEW) ? 'order_id' AND (to_jsonb(NEW)->>'order_id') IS NOT NULL THEN
      SELECT o.accounting_region INTO v_region
      FROM public.orders o
      WHERE o.id = (to_jsonb(NEW)->>'order_id')::uuid;
    END IF;

    IF v_region IS NULL AND to_jsonb(NEW) ? 'customer_id' AND (to_jsonb(NEW)->>'customer_id') IS NOT NULL THEN
      SELECT c.accounting_region INTO v_region
      FROM public.customers c
      WHERE c.id = (to_jsonb(NEW)->>'customer_id')::uuid;
    END IF;

    IF v_region IS NOT NULL THEN
      NEW.accounting_region := v_region;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_region_inherit ON public.finance_transactions;
CREATE TRIGGER trg_region_inherit BEFORE INSERT ON public.finance_transactions
FOR EACH ROW EXECUTE FUNCTION public.finance_inherit_accounting_region();

DROP TRIGGER IF EXISTS trg_region_inherit ON public.zoho_invoices;
CREATE TRIGGER trg_region_inherit BEFORE INSERT ON public.zoho_invoices
FOR EACH ROW EXECUTE FUNCTION public.finance_inherit_accounting_region();

DROP TRIGGER IF EXISTS trg_region_inherit ON public.zoho_recurring_profiles;
CREATE TRIGGER trg_region_inherit BEFORE INSERT ON public.zoho_recurring_profiles
FOR EACH ROW EXECUTE FUNCTION public.finance_inherit_accounting_region();

DROP TRIGGER IF EXISTS trg_region_inherit ON public.finance_journal;
CREATE TRIGGER trg_region_inherit BEFORE INSERT ON public.finance_journal
FOR EACH ROW EXECUTE FUNCTION public.finance_inherit_accounting_region();

DROP TRIGGER IF EXISTS trg_region_inherit ON public.finance_reminders;
CREATE TRIGGER trg_region_inherit BEFORE INSERT ON public.finance_reminders
FOR EACH ROW EXECUTE FUNCTION public.finance_inherit_accounting_region();