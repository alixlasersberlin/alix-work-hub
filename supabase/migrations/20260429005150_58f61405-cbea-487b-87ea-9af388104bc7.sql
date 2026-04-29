-- Allow any authenticated user to insert audit logs via a controlled SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _module text,
  _record_id text DEFAULT NULL,
  _details jsonb DEFAULT NULL,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _uid uuid := auth.uid();
BEGIN
  -- Require authenticated session
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to log audit event';
  END IF;

  IF _action IS NULL OR length(trim(_action)) = 0 THEN
    RAISE EXCEPTION 'action is required';
  END IF;
  IF _module IS NULL OR length(trim(_module)) = 0 THEN
    RAISE EXCEPTION 'module is required';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, module, record_id, details, ip_address, user_agent)
  VALUES (_uid, _action, _module, _record_id, _details, _ip_address, _user_agent)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- Lock down execution: only authenticated users may call (not anon/public)
REVOKE ALL ON FUNCTION public.log_audit_event(text, text, text, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_audit_event(text, text, text, jsonb, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, text, text) TO authenticated;

COMMENT ON FUNCTION public.log_audit_event IS
'Allows any authenticated user to write a single audit log entry tied to their auth.uid(). Prevents audit-trail gaps without granting broad INSERT on audit_logs.';