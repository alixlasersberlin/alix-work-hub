CREATE OR REPLACE FUNCTION public.esc_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_entity uuid; v_action text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_entity := OLD.id; v_action := 'deleted';
  ELSIF TG_OP = 'UPDATE' THEN v_entity := NEW.id; v_action := 'updated';
  ELSE v_entity := NEW.id; v_action := 'created';
  END IF;
  INSERT INTO public.esc_audit_log (entity_type, entity_id, action, changed_by, old_values_json, new_values_json, changed_at)
  VALUES (
    TG_TABLE_NAME, v_entity, v_action, auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE NULL END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END; $function$;