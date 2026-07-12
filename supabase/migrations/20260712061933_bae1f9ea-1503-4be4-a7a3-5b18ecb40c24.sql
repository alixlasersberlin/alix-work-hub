
-- Remove ALL delete policies on esc_store_* tables (no one may delete)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename LIKE 'esc\_store\_%' ESCAPE '\'
      AND cmd='DELETE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Replace all INSERT policies on esc_store_* tables so only Super Admin can insert
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename LIKE 'esc\_store\_%' ESCAPE '\'
      AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname='public'
      AND tablename LIKE 'esc\_store\_%' ESCAPE '\'
      AND tablename <> 'esc_store_audit_log'
  LOOP
    EXECUTE format(
      $f$CREATE POLICY "insert superadmin only" ON public.%I FOR INSERT TO authenticated WITH CHECK (has_role('Super Admin'::text))$f$,
      r.tablename
    );
  END LOOP;
END $$;
