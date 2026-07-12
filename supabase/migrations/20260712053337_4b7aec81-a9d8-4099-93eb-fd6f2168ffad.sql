
-- Generische Audit-Trigger-Funktion für alle esc_store_* Tabellen
CREATE OR REPLACE FUNCTION public.esc_store_generic_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity text := TG_TABLE_NAME;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, old_values_json, changed_by, source)
    VALUES (v_entity, OLD.id, 'delete', to_jsonb(OLD), auth.uid(), 'db_trigger');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, old_values_json, new_values_json, changed_by, source)
    VALUES (v_entity, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), 'db_trigger');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, new_values_json, changed_by, source)
    VALUES (v_entity, NEW.id, 'create', to_jsonb(NEW), auth.uid(), 'db_trigger');
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'esc_store_appointment_kinds',
    'esc_store_departments',
    'esc_store_employees',
    'esc_store_rm_absences',
    'esc_store_rm_demo_devices',
    'esc_store_rm_employees',
    'esc_store_rm_locations',
    'esc_store_rm_maintenance',
    'esc_store_rm_qualifications',
    'esc_store_rm_rooms',
    'esc_store_rm_vehicles'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- 1) Alle bestehenden DELETE-Policies droppen
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='DELETE'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- 2) Neue Super-Admin-only DELETE-Policy
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_role(''Super Admin''))',
      t || ' delete superadmin only', t
    );

    -- 3) Audit-Trigger (idempotent)
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.esc_store_generic_audit()',
      t, t
    );
  END LOOP;
END $$;
