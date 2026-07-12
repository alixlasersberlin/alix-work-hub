
CREATE TABLE IF NOT EXISTS public.role_break_glass_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  granted_role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  ticket_ref TEXT,
  activated_by UUID NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_break_glass_sessions TO authenticated;
GRANT ALL ON public.role_break_glass_sessions TO service_role;
ALTER TABLE public.role_break_glass_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin liest Break-Glass"
  ON public.role_break_glass_sessions FOR SELECT
  TO authenticated
  USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_break_glass_status ON public.role_break_glass_sessions(status, expires_at);

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
    INSERT INTO public.role_notifications(user_id, kind, title, body, link, severity)
    VALUES (v_admin, 'break_glass',
      'Break-Glass aktiviert',
      format('Notfallzugriff bis %s. Grund: %s', to_char(v_expires, 'DD.MM.YYYY HH24:MI'), _reason),
      '/admin/rollen-freigaben/break-glass',
      'critical');
  END LOOP;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_break_glass(_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sess public.role_break_glass_sessions;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Break-Glass widerrufen';
  END IF;

  SELECT * INTO v_sess FROM public.role_break_glass_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session nicht gefunden'; END IF;
  IF v_sess.status <> 'active' THEN RETURN; END IF;

  UPDATE public.role_break_glass_sessions
    SET status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
    WHERE id = _session_id;

  DELETE FROM public.user_roles
    WHERE user_id = v_sess.target_user_id AND role_id = v_sess.granted_role_id;

  INSERT INTO public.role_audit_log(actor_id, target_user_id, action, role_id, metadata)
  VALUES (auth.uid(), v_sess.target_user_id, 'break_glass_revoke', v_sess.granted_role_id,
    jsonb_build_object('session_id', _session_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_break_glass_sessions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_sess public.role_break_glass_sessions;
BEGIN
  FOR v_sess IN
    SELECT * FROM public.role_break_glass_sessions
    WHERE status = 'active' AND expires_at <= now()
  LOOP
    UPDATE public.role_break_glass_sessions SET status = 'expired' WHERE id = v_sess.id;
    DELETE FROM public.user_roles
      WHERE user_id = v_sess.target_user_id AND role_id = v_sess.granted_role_id;
    INSERT INTO public.role_audit_log(actor_id, target_user_id, action, role_id, metadata)
    VALUES (NULL, v_sess.target_user_id, 'break_glass_expire', v_sess.granted_role_id,
      jsonb_build_object('session_id', v_sess.id));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-break-glass-hourly') THEN
    PERFORM cron.schedule('expire-break-glass-hourly', '10 * * * *', $c$SELECT public.expire_break_glass_sessions();$c$);
  END IF;
END $$;
