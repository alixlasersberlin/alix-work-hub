
CREATE OR REPLACE FUNCTION public.esc_store_generic_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity text := TG_TABLE_NAME;
  v_uuid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    BEGIN v_uuid := OLD.id::uuid; EXCEPTION WHEN others THEN v_uuid := NULL; END;
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, old_values_json, changed_by, source)
    VALUES (v_entity, v_uuid, 'deleted', jsonb_build_object('id', OLD.id) || to_jsonb(OLD), auth.uid(), 'db_trigger');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN v_uuid := NEW.id::uuid; EXCEPTION WHEN others THEN v_uuid := NULL; END;
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, old_values_json, new_values_json, changed_by, source)
    VALUES (v_entity, v_uuid, 'updated', jsonb_build_object('id', OLD.id) || to_jsonb(OLD), jsonb_build_object('id', NEW.id) || to_jsonb(NEW), auth.uid(), 'db_trigger');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    BEGIN v_uuid := NEW.id::uuid; EXCEPTION WHEN others THEN v_uuid := NULL; END;
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, new_values_json, changed_by, source)
    VALUES (v_entity, v_uuid, 'created', jsonb_build_object('id', NEW.id) || to_jsonb(NEW), auth.uid(), 'db_trigger');
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
DECLARE
  v_uuid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    BEGIN v_uuid := OLD.id::uuid; EXCEPTION WHEN others THEN v_uuid := NULL; END;
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, old_values_json, changed_by, source)
    VALUES ('appointment', v_uuid, 'deleted', jsonb_build_object('id', OLD.id) || to_jsonb(OLD), auth.uid(), 'db_trigger');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN v_uuid := NEW.id::uuid; EXCEPTION WHEN others THEN v_uuid := NULL; END;
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, old_values_json, new_values_json, changed_by, source)
    VALUES ('appointment', v_uuid, 'updated', jsonb_build_object('id', OLD.id) || to_jsonb(OLD), jsonb_build_object('id', NEW.id) || to_jsonb(NEW), auth.uid(), 'db_trigger');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    BEGIN v_uuid := NEW.id::uuid; EXCEPTION WHEN others THEN v_uuid := NULL; END;
    INSERT INTO public.esc_audit_log(entity_type, entity_id, action, new_values_json, changed_by, source)
    VALUES ('appointment', v_uuid, 'created', jsonb_build_object('id', NEW.id) || to_jsonb(NEW), auth.uid(), 'db_trigger');
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
