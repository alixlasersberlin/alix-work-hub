
CREATE OR REPLACE FUNCTION public.activate_break_glass(
  _target_user_id UUID,
  _role_id UUID,
  _reason TEXT,
  _duration_minutes INT DEFAULT 60,
  _ticket_ref TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_expires TIMESTAMPTZ;
  v_admin UUID;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Break-Glass aktivieren';
  END IF;
  IF _duration_minutes IS NULL OR _duration_minutes < 5 OR _duration_minutes > 480 THEN
    RAISE EXCEPTION 'Dauer muss zwischen 5 und 480 Minuten liegen';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN
    RAISE EXCEPTION 'Begründung erforderlich (min. 10 Zeichen)';
  END IF;

  v_expires := now() + make_interval(mins => _duration_minutes);

  INSERT INTO public.role_break_glass_sessions
    (target_user_id, granted_role_id, reason, ticket_ref, activated_by, expires_at)
  VALUES (_target_user_id, _role_id, _reason, _ticket_ref, auth.uid(), v_expires)
  RETURNING id INTO v_id;

  INSERT INTO public.user_roles(user_id, role_id)
  VALUES (_target_user_id, _role_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.role_audit_log(actor_id, target_user_id, action, role_id, metadata)
  VALUES (auth.uid(), _target_user_id, 'break_glass_activate', _role_id,
    jsonb_build_object('session_id', v_id, 'expires_at', v_expires, 'reason', _reason, 'ticket_ref', _ticket_ref));

  FOR v_admin IN
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE r.name = 'Super Admin'
  LOOP
    INSERT INTO public.role_notifications(user_id, kind, title, body, ref_type, ref_id, severity)
    VALUES (v_admin, 'break_glass',
      'Break-Glass aktiviert',
      format('Notfallzugriff bis %s. Grund: %s', to_char(v_expires, 'DD.MM.YYYY HH24:MI'), _reason),
      'break_glass_session', v_id,
      'critical');
  END LOOP;

  RETURN v_id;
END;
$$;
