CREATE OR REPLACE FUNCTION public.esc_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entity uuid;
  v_action text;
  v_entity_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_entity := OLD.id; v_action := 'deleted';
  ELSIF TG_OP = 'UPDATE' THEN v_entity := NEW.id; v_action := 'updated';
  ELSE v_entity := NEW.id; v_action := 'created';
  END IF;

  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'esc_events' THEN 'event'
    WHEN 'esc_departments' THEN 'department'
    WHEN 'esc_resources' THEN 'resource'
    WHEN 'esc_employee_settings' THEN 'employee_setting'
    WHEN 'esc_public_bookings' THEN 'public_booking'
    WHEN 'esc_email_templates' THEN 'email_template'
    WHEN 'esc_event_participants' THEN 'event_participant'
    ELSE TG_TABLE_NAME
  END;

  INSERT INTO public.esc_audit_log (entity_type, entity_id, action, changed_by, old_values_json, new_values_json, changed_at)
  VALUES (
    v_entity_type, v_entity, v_action, auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE NULL END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END; $function$;