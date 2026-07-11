
-- Systemweite Persistenz für den Teamkalender.
-- Ein Tabellen-pro-Store-Ansatz mit JSONB, damit die aktuellen TS-Typen 1:1 gespiegelt werden.

CREATE OR REPLACE FUNCTION public.esc_store_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'esc_store_appointments',
    'esc_store_departments',
    'esc_store_employees',
    'esc_store_rm_employees',
    'esc_store_rm_vehicles',
    'esc_store_rm_rooms',
    'esc_store_rm_demo_devices',
    'esc_store_rm_absences',
    'esc_store_rm_maintenance',
    'esc_store_rm_locations',
    'esc_store_rm_qualifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS public.%I (
        id text PRIMARY KEY,
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid
      )
    $f$, t);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format($f$
      DROP POLICY IF EXISTS "%1$s auth read" ON public.%1$I;
      CREATE POLICY "%1$s auth read" ON public.%1$I
        FOR SELECT TO authenticated USING (true);
    $f$, t);

    EXECUTE format($f$
      DROP POLICY IF EXISTS "%1$s auth insert" ON public.%1$I;
      CREATE POLICY "%1$s auth insert" ON public.%1$I
        FOR INSERT TO authenticated WITH CHECK (true);
    $f$, t);

    EXECUTE format($f$
      DROP POLICY IF EXISTS "%1$s auth update" ON public.%1$I;
      CREATE POLICY "%1$s auth update" ON public.%1$I
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    $f$, t);

    -- Delete darf jeder eingeloggte Nutzer (Kalendereinträge / Ressourcen sind operative Daten,
    -- keine Kundendaten – siehe Memory: Delete-Beschränkung gilt für Kern-Businesstabellen).
    EXECUTE format($f$
      DROP POLICY IF EXISTS "%1$s auth delete" ON public.%1$I;
      CREATE POLICY "%1$s auth delete" ON public.%1$I
        FOR DELETE TO authenticated USING (true);
    $f$, t);

    EXECUTE format($f$
      DROP TRIGGER IF EXISTS %1$s_touch ON public.%1$I;
      CREATE TRIGGER %1$s_touch BEFORE UPDATE ON public.%1$I
        FOR EACH ROW EXECUTE FUNCTION public.esc_store_touch_updated_at();
    $f$, t);

    -- Realtime aktivieren (nur wenn noch nicht in der Publication)
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;
