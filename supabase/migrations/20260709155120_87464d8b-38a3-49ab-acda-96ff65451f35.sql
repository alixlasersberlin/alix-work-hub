
-- 1) Restrict finance viewing role to finance/leadership/admin only
CREATE OR REPLACE FUNCTION public.can_view_finance_module()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.can_access_finance_module();
$function$;

-- 2) Add tenant_id to finance tables that are missing tenant scoping
ALTER TABLE public.finance_accounts             ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_contracts            ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_reminders            ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_reminder_items       ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_history              ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_bank_statements      ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_bank_lines           ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_cashbook             ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_cashbook_closures    ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_deposits             ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_deposit_bookings     ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_deposit_history      ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_deposit_notifications ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.finance_bank_postings        ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- 3) Rewrite SELECT/INSERT/UPDATE policies to include has_tenant_access(tenant_id)
--    Legacy rows without tenant_id remain visible so nothing breaks; tenant-scoped rows are isolated.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'finance_accounts','finance_contracts','finance_reminders','finance_reminder_items',
    'finance_history','finance_bank_statements','finance_bank_lines',
    'finance_cashbook','finance_cashbook_closures','finance_deposits',
    'finance_deposit_bookings','finance_deposit_history','finance_deposit_notifications',
    'finance_bank_postings','finance_sepa_mandates'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop existing SELECT/INSERT/UPDATE policies so we can replace them cleanly
    FOR pol IN
      SELECT policyname, cmd FROM pg_policies
       WHERE schemaname='public' AND tablename=t AND cmd IN ('SELECT','INSERT','UPDATE')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR SELECT
        USING (
          public.can_view_finance_module()
          AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id))
        )
    $f$, t || '_select', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR INSERT
        WITH CHECK (
          public.can_access_finance_module()
          AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id))
        )
    $f$, t || '_insert', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR UPDATE
        USING (
          public.can_access_finance_module()
          AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id))
        )
        WITH CHECK (
          public.can_access_finance_module()
          AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id))
        )
    $f$, t || '_update', t);
  END LOOP;
END $$;
