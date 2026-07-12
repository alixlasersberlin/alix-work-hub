
-- Cleanup function: deactivate stale/expired sessions
CREATE OR REPLACE FUNCTION public.security_deactivate_stale_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.login_sessions
     SET is_active = false
   WHERE is_active = true
     AND (
       (expires_at IS NOT NULL AND expires_at < now())
       OR created_at < now() - interval '30 days'
     );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.security_deactivate_stale_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_deactivate_stale_sessions() TO service_role;

-- Role change audit trigger
CREATE OR REPLACE FUNCTION public.trg_audit_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_role_name FROM public.roles WHERE id = NEW.role_id;
    INSERT INTO public.audit_logs (user_id, action, module, record_id, details)
    VALUES (
      auth.uid(), 'role_granted', 'security', NEW.user_id::text,
      jsonb_build_object('role', v_role_name, 'role_id', NEW.role_id, 'target_user_id', NEW.user_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT name INTO v_role_name FROM public.roles WHERE id = OLD.role_id;
    INSERT INTO public.audit_logs (user_id, action, module, record_id, details)
    VALUES (
      auth.uid(), 'role_revoked', 'security', OLD.user_id::text,
      jsonb_build_object('role', v_role_name, 'role_id', OLD.role_id, 'target_user_id', OLD.user_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_audit_user_roles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_audit_user_roles() TO service_role;

DROP TRIGGER IF EXISTS audit_user_roles_insert ON public.user_roles;
DROP TRIGGER IF EXISTS audit_user_roles_delete ON public.user_roles;

CREATE TRIGGER audit_user_roles_insert
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_user_roles();

CREATE TRIGGER audit_user_roles_delete
  AFTER DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_user_roles();
