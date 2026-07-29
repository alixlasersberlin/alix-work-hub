
-- ============================================================
-- BUCHHALTUNG CH – Phase 1: Enum, Spalten, Roles, RLS, Backfill
-- ============================================================

-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.accounting_region AS ENUM ('EU','CH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Spalten auf allen relevanten Tabellen (nullable zuerst)
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'customers','orders',
    'finance_accounts','finance_contracts','finance_transactions','finance_deposits',
    'finance_journal','finance_cashbook','finance_cashbook_closures','finance_bank_postings',
    'finance_reminders','finance_reminder_items',
    'finance_sepa_mandates','finance_sepa_runs','finance_sepa_run_items',
    'finance_bank_statements','finance_bank_lines',
    'zoho_recurring_profiles'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS accounting_region public.accounting_region', t);
    END IF;
  END LOOP;
END $$;

-- 3. Backfill: Orders (CH-Branch der Alix Schweiz)
UPDATE public.orders
SET accounting_region = 'CH'
WHERE accounting_region IS NULL
  AND raw_data->>'branch_id' = '598077000000065075';

UPDATE public.orders
SET accounting_region = 'EU'
WHERE accounting_region IS NULL;

-- 4. Backfill: Customers = CH, sobald >=1 CH-Order existiert
UPDATE public.customers c
SET accounting_region = 'CH'
WHERE accounting_region IS NULL
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id AND o.accounting_region = 'CH');

UPDATE public.customers SET accounting_region = 'EU' WHERE accounting_region IS NULL;

-- 5. Backfill Finance-Tabellen aus verlinktem Order/Customer
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Tabellen mit order_id: erst über Order, dann Rest über Customer, dann Rest = EU
  FOR rec IN
    SELECT unnest(ARRAY['finance_contracts','finance_transactions','finance_deposits']) AS t
  LOOP
    EXECUTE format($f$
      UPDATE public.%I x SET accounting_region = o.accounting_region
      FROM public.orders o
      WHERE x.order_id = o.id AND x.accounting_region IS NULL
    $f$, rec.t);
  END LOOP;

  -- Tabellen mit customer_id: aus Customer ableiten
  FOR rec IN
    SELECT unnest(ARRAY[
      'finance_accounts','finance_contracts','finance_transactions','finance_deposits',
      'finance_journal','finance_cashbook','finance_bank_postings',
      'finance_reminders','finance_sepa_mandates','finance_sepa_run_items'
    ]) AS t
  LOOP
    EXECUTE format($f$
      UPDATE public.%I x SET accounting_region = c.accounting_region
      FROM public.customers c
      WHERE x.customer_id = c.id AND x.accounting_region IS NULL
    $f$, rec.t);
  END LOOP;

  -- Kindtabellen ohne direkten Kunden: aus Parent-Reminder / Parent-Sepa-Run / Parent-Bankstatement
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_reminder_items' AND column_name='reminder_id') THEN
    EXECUTE $f$
      UPDATE public.finance_reminder_items i SET accounting_region = r.accounting_region
      FROM public.finance_reminders r
      WHERE i.reminder_id = r.id AND i.accounting_region IS NULL
    $f$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_sepa_run_items' AND column_name='run_id') THEN
    EXECUTE $f$
      UPDATE public.finance_sepa_run_items i SET accounting_region = r.accounting_region
      FROM public.finance_sepa_runs r
      WHERE i.run_id = r.id AND i.accounting_region IS NULL
    $f$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_bank_lines' AND column_name='statement_id') THEN
    EXECUTE $f$
      UPDATE public.finance_bank_lines l SET accounting_region = s.accounting_region
      FROM public.finance_bank_statements s
      WHERE l.statement_id = s.id AND l.accounting_region IS NULL
    $f$;
  END IF;

  -- finance_cashbook_closures: aus zugehörigem cashbook (falls FK vorhanden)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_cashbook_closures') THEN
    EXECUTE $f$ UPDATE public.finance_cashbook_closures SET accounting_region = 'EU' WHERE accounting_region IS NULL $f$;
  END IF;

  -- SEPA-Runs Rest: EU
  EXECUTE $f$ UPDATE public.finance_sepa_runs SET accounting_region = 'EU' WHERE accounting_region IS NULL $f$;
  EXECUTE $f$ UPDATE public.finance_bank_statements SET accounting_region = 'EU' WHERE accounting_region IS NULL $f$;
  -- Rest überall = EU
  FOR rec IN
    SELECT unnest(ARRAY[
      'customers','orders',
      'finance_accounts','finance_contracts','finance_transactions','finance_deposits',
      'finance_journal','finance_cashbook','finance_cashbook_closures','finance_bank_postings',
      'finance_reminders','finance_reminder_items',
      'finance_sepa_mandates','finance_sepa_runs','finance_sepa_run_items',
      'finance_bank_statements','finance_bank_lines',
      'zoho_recurring_profiles'
    ]) AS t
  LOOP
    EXECUTE format($f$UPDATE public.%I SET accounting_region = 'EU' WHERE accounting_region IS NULL$f$, rec.t);
  END LOOP;
END $$;

-- 6. NOT NULL + Default setzen
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'customers','orders',
    'finance_accounts','finance_contracts','finance_transactions','finance_deposits',
    'finance_journal','finance_cashbook','finance_cashbook_closures','finance_bank_postings',
    'finance_reminders','finance_reminder_items',
    'finance_sepa_mandates','finance_sepa_runs','finance_sepa_run_items',
    'finance_bank_statements','finance_bank_lines',
    'zoho_recurring_profiles'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='accounting_region') THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN accounting_region SET DEFAULT ''EU''', t);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN accounting_region SET NOT NULL', t);
    END IF;
  END LOOP;
END $$;

-- 7. Composite-Indizes
CREATE INDEX IF NOT EXISTS idx_orders_region_date ON public.orders(accounting_region, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_customers_region ON public.customers(accounting_region);
CREATE INDEX IF NOT EXISTS idx_fin_tx_region_date ON public.finance_transactions(accounting_region, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_accounts_region ON public.finance_accounts(accounting_region);
CREATE INDEX IF NOT EXISTS idx_fin_contracts_region ON public.finance_contracts(accounting_region);
CREATE INDEX IF NOT EXISTS idx_fin_deposits_region ON public.finance_deposits(accounting_region);
CREATE INDEX IF NOT EXISTS idx_fin_journal_region_date ON public.finance_journal(accounting_region, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_reminders_region ON public.finance_reminders(accounting_region);
CREATE INDEX IF NOT EXISTS idx_fin_sepa_mand_region ON public.finance_sepa_mandates(accounting_region);
CREATE INDEX IF NOT EXISTS idx_zoho_recurring_region ON public.zoho_recurring_profiles(accounting_region);

-- 8. Trigger: Region aus Order/Customer ableiten, wenn nicht gesetzt
CREATE OR REPLACE FUNCTION public.finance_set_region()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.accounting_region;
BEGIN
  IF NEW.accounting_region IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME IN ('finance_contracts','finance_transactions','finance_deposits')
     AND NEW.order_id IS NOT NULL THEN
    SELECT accounting_region INTO r FROM public.orders WHERE id = NEW.order_id;
    IF r IS NOT NULL THEN NEW.accounting_region := r; RETURN NEW; END IF;
  END IF;
  IF NEW.customer_id IS NOT NULL THEN
    SELECT accounting_region INTO r FROM public.customers WHERE id = NEW.customer_id;
    IF r IS NOT NULL THEN NEW.accounting_region := r; RETURN NEW; END IF;
  END IF;
  NEW.accounting_region := 'EU';
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'finance_accounts','finance_contracts','finance_transactions','finance_deposits',
    'finance_journal','finance_cashbook','finance_bank_postings',
    'finance_reminders','finance_sepa_mandates','finance_sepa_run_items',
    'zoho_recurring_profiles'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_region ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_region BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_set_region()', t);
  END LOOP;
END $$;

-- Orders: Trigger, der branch_id -> region ableitet
CREATE OR REPLACE FUNCTION public.orders_set_region()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.accounting_region IS NULL THEN
    IF NEW.raw_data IS NOT NULL AND NEW.raw_data->>'branch_id' = '598077000000065075' THEN
      NEW.accounting_region := 'CH';
    ELSE
      NEW.accounting_region := 'EU';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_orders_set_region ON public.orders;
CREATE TRIGGER trg_orders_set_region BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_set_region();

-- Region-Wechsel blocken, wenn Buchungen existieren
CREATE OR REPLACE FUNCTION public.orders_guard_region_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.accounting_region <> OLD.accounting_region THEN
    IF EXISTS (SELECT 1 FROM public.finance_transactions WHERE order_id = NEW.id LIMIT 1) THEN
      RAISE EXCEPTION 'Region cannot be changed: bookings already exist for order %', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_orders_guard_region ON public.orders;
CREATE TRIGGER trg_orders_guard_region BEFORE UPDATE OF accounting_region ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_guard_region_change();

-- 9. Rollen anlegen
INSERT INTO public.roles (name, description)
SELECT 'Buchhaltung EU', 'Nur EU-Buchhaltung sehen und bearbeiten'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name='Buchhaltung EU');
INSERT INTO public.roles (name, description)
SELECT 'Buchhaltung CH', 'Nur CH-Buchhaltung sehen und bearbeiten'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name='Buchhaltung CH');
INSERT INTO public.roles (name, description)
SELECT 'Buchhaltung Admin', 'Beide Buchhaltungskreise (EU + CH)'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name='Buchhaltung Admin');

-- 10. Bestehende Finance-User automatisch als Buchhaltung EU markieren
INSERT INTO public.user_roles (user_id, role_id)
SELECT ur.user_id, (SELECT id FROM public.roles WHERE name='Buchhaltung EU')
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE r.name = 'Finance'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    JOIN public.roles r2 ON r2.id = ur2.role_id
    WHERE ur2.user_id = ur.user_id AND r2.name = 'Buchhaltung EU'
  );

-- 11. Helper-Function: Darf User Region sehen?
CREATE OR REPLACE FUNCTION public.has_accounting_region(_user_id uuid, _region public.accounting_region)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND r.name IN (
        'Super Admin','Admin','Buchhaltung Admin',
        CASE WHEN _region = 'EU' THEN 'Buchhaltung EU' ELSE 'Buchhaltung CH' END,
        CASE WHEN _region = 'EU' THEN 'Finance' ELSE '__none__' END
      )
  )
$$;

-- 12. RLS-Policies: pro Region-Zugriff auf allen Finance-Tabellen
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'finance_accounts','finance_contracts','finance_transactions','finance_deposits',
    'finance_journal','finance_cashbook','finance_cashbook_closures','finance_bank_postings',
    'finance_reminders','finance_reminder_items',
    'finance_sepa_mandates','finance_sepa_runs','finance_sepa_run_items',
    'finance_bank_statements','finance_bank_lines',
    'zoho_recurring_profiles'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS region_scope_select ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY region_scope_select ON public.%I
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (public.has_accounting_region(auth.uid(), accounting_region))
      WITH CHECK (public.has_accounting_region(auth.uid(), accounting_region))
    $f$, t);
  END LOOP;
END $$;
