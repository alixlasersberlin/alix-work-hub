-- 1. helper: tenant scope check by tenant_id
CREATE OR REPLACE FUNCTION public.tenant_scope_ok_id(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (NOT public.tenant_scope_restricted())
      OR _tenant_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = _tenant_id
          AND t.code = ANY (public.user_tenant_codes())
      );
$$;

-- 2. add missing tenant_id columns
ALTER TABLE public.finance_sepa_run_items ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- 3. backfill via customer / order
UPDATE public.finance_transactions f SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE f.customer_id = c.id AND f.tenant_id IS NULL;

UPDATE public.finance_deposits f SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE f.customer_id = c.id AND f.tenant_id IS NULL;

UPDATE public.finance_journal f SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE f.customer_id = c.id AND f.tenant_id IS NULL;

UPDATE public.finance_reminders f SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE f.customer_id = c.id AND f.tenant_id IS NULL;

UPDATE public.finance_sepa_mandates f SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE f.customer_id = c.id AND f.tenant_id IS NULL;

UPDATE public.finance_documents f SET tenant_id = t.id
FROM public.customers c JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
WHERE f.customer_id = c.id AND f.tenant_id IS NULL;

UPDATE public.finance_reminder_items i SET tenant_id = r.tenant_id
FROM public.finance_reminders r
WHERE i.reminder_id = r.id AND i.tenant_id IS NULL;

UPDATE public.finance_sepa_run_items i SET tenant_id = r.tenant_id
FROM public.finance_sepa_runs r
WHERE i.run_id = r.id AND i.tenant_id IS NULL;

-- 4. auto-assign trigger (customer based)
CREATE OR REPLACE FUNCTION public.finance_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT t.id INTO NEW.tenant_id
    FROM public.customers c
    JOIN public.tenants t ON t.code = public.source_to_tenant_code(c.source_system)
    WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_set_tenant_from_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF TG_TABLE_NAME = 'finance_reminder_items' THEN
      SELECT r.tenant_id INTO NEW.tenant_id FROM public.finance_reminders r WHERE r.id = NEW.reminder_id;
    ELSIF TG_TABLE_NAME = 'finance_sepa_run_items' THEN
      SELECT r.tenant_id INTO NEW.tenant_id FROM public.finance_sepa_runs r WHERE r.id = NEW.run_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_finance_transactions ON public.finance_transactions;
CREATE TRIGGER trg_tenant_finance_transactions BEFORE INSERT OR UPDATE ON public.finance_transactions
FOR EACH ROW EXECUTE FUNCTION public.finance_set_tenant();

DROP TRIGGER IF EXISTS trg_tenant_finance_deposits ON public.finance_deposits;
CREATE TRIGGER trg_tenant_finance_deposits BEFORE INSERT OR UPDATE ON public.finance_deposits
FOR EACH ROW EXECUTE FUNCTION public.finance_set_tenant();

DROP TRIGGER IF EXISTS trg_tenant_finance_journal ON public.finance_journal;
CREATE TRIGGER trg_tenant_finance_journal BEFORE INSERT OR UPDATE ON public.finance_journal
FOR EACH ROW EXECUTE FUNCTION public.finance_set_tenant();

DROP TRIGGER IF EXISTS trg_tenant_finance_reminders ON public.finance_reminders;
CREATE TRIGGER trg_tenant_finance_reminders BEFORE INSERT OR UPDATE ON public.finance_reminders
FOR EACH ROW EXECUTE FUNCTION public.finance_set_tenant();

DROP TRIGGER IF EXISTS trg_tenant_finance_sepa_mandates ON public.finance_sepa_mandates;
CREATE TRIGGER trg_tenant_finance_sepa_mandates BEFORE INSERT OR UPDATE ON public.finance_sepa_mandates
FOR EACH ROW EXECUTE FUNCTION public.finance_set_tenant();

DROP TRIGGER IF EXISTS trg_tenant_finance_documents ON public.finance_documents;
CREATE TRIGGER trg_tenant_finance_documents BEFORE INSERT OR UPDATE ON public.finance_documents
FOR EACH ROW EXECUTE FUNCTION public.finance_set_tenant();

DROP TRIGGER IF EXISTS trg_tenant_finance_reminder_items ON public.finance_reminder_items;
CREATE TRIGGER trg_tenant_finance_reminder_items BEFORE INSERT OR UPDATE ON public.finance_reminder_items
FOR EACH ROW EXECUTE FUNCTION public.finance_set_tenant_from_parent();

DROP TRIGGER IF EXISTS trg_tenant_finance_sepa_run_items ON public.finance_sepa_run_items;
CREATE TRIGGER trg_tenant_finance_sepa_run_items BEFORE INSERT OR UPDATE ON public.finance_sepa_run_items
FOR EACH ROW EXECUTE FUNCTION public.finance_set_tenant_from_parent();

-- 5. restrictive tenant policies
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'finance_transactions','finance_deposits','finance_journal','finance_reminders',
    'finance_reminder_items','finance_sepa_mandates','finance_sepa_runs','finance_sepa_run_items',
    'finance_bank_statements','finance_documents'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope_%1$s ON public.%1$I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_scope_%1$s ON public.%1$I AS RESTRICTIVE TO authenticated USING (public.tenant_scope_ok_id(tenant_id)) WITH CHECK (public.tenant_scope_ok_id(tenant_id))',
      tbl);
  END LOOP;
END $$;

-- 6. indexes
CREATE INDEX IF NOT EXISTS idx_ft_tenant ON public.finance_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fd_tenant ON public.finance_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fj_tenant ON public.finance_journal(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fr_tenant ON public.finance_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fri_tenant ON public.finance_reminder_items(tenant_id);