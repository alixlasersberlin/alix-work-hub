
-- 1) Verschärfte DELETE-Policy: nur Super Admin
DROP POLICY IF EXISTS "esc_store_appointments op delete" ON public.esc_store_appointments;
CREATE POLICY "esc_store_appointments delete superadmin only"
  ON public.esc_store_appointments
  FOR DELETE
  TO authenticated
  USING (public.has_role('Super Admin'));

-- 2) Audit-Trigger-Funktion für den Teamkalender
CREATE OR REPLACE FUNCTION public.esc_store_appointments_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, old_values_json, changed_by, source)
    VALUES ('appointment', OLD.id, 'delete', to_jsonb(OLD), auth.uid(), 'db_trigger');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, old_values_json, new_values_json, changed_by, source)
    VALUES ('appointment', NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), 'db_trigger');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, new_values_json, changed_by, source)
    VALUES ('appointment', NEW.id, 'create', to_jsonb(NEW), auth.uid(), 'db_trigger');
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_esc_store_appointments_audit ON public.esc_store_appointments;
CREATE TRIGGER trg_esc_store_appointments_audit
AFTER INSERT OR UPDATE OR DELETE ON public.esc_store_appointments
FOR EACH ROW EXECUTE FUNCTION public.esc_store_appointments_audit();
