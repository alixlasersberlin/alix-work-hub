
-- =========================================================
-- Phase 2: Auto-Apply, Delegationsschutz, Cron für Ablauf
-- =========================================================

-- 1) Delegationsschutz: nur Super Admin darf Super Admin gewähren/entziehen
CREATE OR REPLACE FUNCTION public.enforce_role_delegation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role_name text;
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_role_name FROM public.roles WHERE id = NEW.role_id;
  ELSE
    SELECT name INTO v_role_name FROM public.roles WHERE id = OLD.role_id;
  END IF;

  -- Kritische Rollen dürfen nur von Super Admin verändert werden
  IF v_role_name IN ('Super Admin','Admin','FACTORY INVOICE','Finance') THEN
    IF v_actor IS NOT NULL AND NOT public.has_role('Super Admin') THEN
      RAISE EXCEPTION 'Delegationsschutz: Nur Super Admin darf die kritische Rolle % ändern', v_role_name
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_delegation ON public.user_roles;
CREATE TRIGGER trg_user_roles_delegation
  BEFORE INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_delegation();

-- 2) Auto-Apply für genehmigte Freigabeanträge
CREATE OR REPLACE FUNCTION public.apply_role_change_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.role_change_requests%ROWTYPE;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Freigabeanträge anwenden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO r FROM public.role_change_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Antrag nicht gefunden';
  END IF;
  IF r.status <> 'approved' THEN
    RAISE EXCEPTION 'Antrag ist nicht im Status approved (aktuell: %)', r.status;
  END IF;
  IF r.requested_by = v_actor THEN
    RAISE EXCEPTION 'Vier-Augen-Prinzip: Antragsteller darf eigenen Antrag nicht anwenden';
  END IF;
  IF r.role_id IS NULL THEN
    RAISE EXCEPTION 'Antrag hat keine Rolle hinterlegt';
  END IF;

  IF r.action = 'grant' THEN
    INSERT INTO public.user_roles(user_id, role_id)
    VALUES (r.target_user_id, r.role_id)
    ON CONFLICT DO NOTHING;

  ELSIF r.action = 'revoke' THEN
    DELETE FROM public.user_roles
     WHERE user_id = r.target_user_id AND role_id = r.role_id;

  ELSIF r.action IN ('temporary','extend') THEN
    IF r.valid_until IS NULL THEN
      RAISE EXCEPTION 'Temporärer Antrag benötigt valid_until';
    END IF;
    INSERT INTO public.role_temporary_grants(
      user_id, role_id, role_name,
      valid_from, valid_until, reason, granted_by, request_id, status
    ) VALUES (
      r.target_user_id, r.role_id, r.role_name,
      COALESCE(r.valid_from, now()), r.valid_until, r.reason, v_actor, r.id, 'active'
    );
  END IF;

  UPDATE public.role_change_requests
     SET status = 'applied', applied_at = now()
   WHERE id = r.id;

  INSERT INTO public.role_audit_log(
    actor_user_id, target_user_id, role_id, role_name,
    change_type, reason, approved_by, request_id, new_value
  ) VALUES (
    v_actor, r.target_user_id, r.role_id, r.role_name,
    'request_applied_' || r.action, r.reason, v_actor, r.id,
    jsonb_build_object('action', r.action, 'valid_until', r.valid_until)
  );

  RETURN jsonb_build_object('ok', true, 'action', r.action, 'request_id', r.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_role_change_request(uuid) TO authenticated;

-- 3) Widerruf eines temporären Grants (Super Admin, sofortig)
CREATE OR REPLACE FUNCTION public.revoke_temporary_role_grant(_grant_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.role_temporary_grants%ROWTYPE;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO g FROM public.role_temporary_grants WHERE id = _grant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Grant nicht gefunden'; END IF;

  UPDATE public.role_temporary_grants
     SET status = 'revoked', auto_revoked_at = now()
   WHERE id = _grant_id;

  INSERT INTO public.role_audit_log(
    actor_user_id, target_user_id, role_id, role_name,
    change_type, reason, new_value
  ) VALUES (
    v_actor, g.user_id, g.role_id, g.role_name,
    'temp_grant_revoked', _reason,
    jsonb_build_object('grant_id', g.id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_temporary_role_grant(uuid, text) TO authenticated;

-- 4) Cron: expire_temporary_role_grants stündlich (nur pg_cron nötig)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-temporary-role-grants') THEN
    PERFORM cron.unschedule('expire-temporary-role-grants');
  END IF;
  PERFORM cron.schedule(
    'expire-temporary-role-grants',
    '5 * * * *',
    $$ SELECT public.expire_temporary_role_grants(); $$
  );
END
$cron$;
