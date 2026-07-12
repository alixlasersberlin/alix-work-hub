
CREATE TABLE IF NOT EXISTS public.esc_store_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('created','updated','deleted')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.esc_store_audit_log TO authenticated;
GRANT ALL ON public.esc_store_audit_log TO service_role;

ALTER TABLE public.esc_store_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "esc_store_audit_log super admin read" ON public.esc_store_audit_log;
CREATE POLICY "esc_store_audit_log super admin read"
  ON public.esc_store_audit_log FOR SELECT TO authenticated
  USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS esc_store_audit_log_table_time_idx
  ON public.esc_store_audit_log(table_name, changed_at DESC);

-- Trigger-Funktionen umziehen auf neue Tabelle
CREATE OR REPLACE FUNCTION public.esc_store_generic_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.esc_store_audit_log(table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.esc_store_audit_log(table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.esc_store_audit_log(table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'created', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.esc_store_appointments_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.esc_store_audit_log(table_name, record_id, action, old_data, changed_by)
    VALUES ('esc_store_appointments', OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.esc_store_audit_log(table_name, record_id, action, old_data, new_data, changed_by)
    VALUES ('esc_store_appointments', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.esc_store_audit_log(table_name, record_id, action, new_data, changed_by)
    VALUES ('esc_store_appointments', NEW.id, 'created', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
