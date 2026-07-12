
-- =========================================================
-- 1) role_audit_log (append-only)
-- =========================================================
CREATE TABLE public.role_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  target_user_id uuid,
  role_id uuid,
  role_name text,
  change_type text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  approved_by uuid,
  request_id uuid,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_role_audit_target ON public.role_audit_log(target_user_id);
CREATE INDEX idx_role_audit_created ON public.role_audit_log(created_at DESC);

GRANT SELECT ON public.role_audit_log TO authenticated;
GRANT ALL ON public.role_audit_log TO service_role;
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin can read role audit"
  ON public.role_audit_log FOR SELECT TO authenticated
  USING (public.has_role('Super Admin'));

-- Explizit: KEIN INSERT/UPDATE/DELETE für authenticated (nur service_role / SECURITY DEFINER Trigger)
CREATE POLICY "No manual writes to audit"
  ON public.role_audit_log FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- =========================================================
-- 2) role_change_requests (Vier-Augen-Freigabe)
-- =========================================================
CREATE TABLE public.role_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('grant','revoke','extend','temporary')),
  role_id uuid,
  role_name text,
  reason text NOT NULL,
  valid_from timestamptz,
  valid_until timestamptz,
  urgency text DEFAULT 'normal' CHECK (urgency IN ('normal','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected','expired','revoked','applied')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.role_change_requests TO authenticated;
GRANT ALL ON public.role_change_requests TO service_role;
ALTER TABLE public.role_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin can read all requests"
  ON public.role_change_requests FOR SELECT TO authenticated
  USING (public.has_role('Super Admin'));

CREATE POLICY "Authenticated can create request for themselves or as super admin"
  ON public.role_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('Super Admin')
    OR requested_by = auth.uid()
  );

-- Nur Super Admin darf reviewen, und niemand seinen eigenen Antrag
CREATE POLICY "Super Admin can update requests (no self-approval)"
  ON public.role_change_requests FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin') AND requested_by <> auth.uid())
  WITH CHECK (public.has_role('Super Admin') AND requested_by <> auth.uid());

-- =========================================================
-- 3) role_temporary_grants (zeitlich begrenzte Rechte)
-- =========================================================
CREATE TABLE public.role_temporary_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  role_name text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  reason text NOT NULL,
  granted_by uuid NOT NULL,
  request_id uuid REFERENCES public.role_change_requests(id) ON DELETE SET NULL,
  auto_revoked_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from)
);
CREATE INDEX idx_temp_grants_user ON public.role_temporary_grants(user_id);
CREATE INDEX idx_temp_grants_active ON public.role_temporary_grants(status, valid_until);

GRANT SELECT, INSERT, UPDATE ON public.role_temporary_grants TO authenticated;
GRANT ALL ON public.role_temporary_grants TO service_role;
ALTER TABLE public.role_temporary_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin manages temp grants"
  ON public.role_temporary_grants FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

-- =========================================================
-- 4) Trigger: automatisches Audit auf public.user_roles
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_user_role_change()
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
    INSERT INTO public.role_audit_log(actor_user_id, target_user_id, role_id, role_name, change_type, new_value)
    VALUES (auth.uid(), NEW.user_id, NEW.role_id, v_role_name, 'role_granted',
            jsonb_build_object('role_id', NEW.role_id, 'role_name', v_role_name));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT name INTO v_role_name FROM public.roles WHERE id = OLD.role_id;
    INSERT INTO public.role_audit_log(actor_user_id, target_user_id, role_id, role_name, change_type, old_value)
    VALUES (auth.uid(), OLD.user_id, OLD.role_id, v_role_name, 'role_revoked',
            jsonb_build_object('role_id', OLD.role_id, 'role_name', v_role_name));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_audit ON public.user_roles;
CREATE TRIGGER trg_user_roles_audit
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_user_role_change();

-- =========================================================
-- 5) Effektive Rechte Funktion (read-only Aggregation)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_effective_roles(_user_id uuid)
RETURNS TABLE(
  role_id uuid,
  role_name text,
  source text,
  valid_until timestamptz,
  granted_by uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, 'primary'::text, NULL::timestamptz, NULL::uuid
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
   WHERE ur.user_id = _user_id
  UNION ALL
  SELECT tg.role_id, tg.role_name, 'temporary'::text, tg.valid_until, tg.granted_by
    FROM public.role_temporary_grants tg
   WHERE tg.user_id = _user_id
     AND tg.status = 'active'
     AND tg.valid_from <= now()
     AND tg.valid_until > now();
$$;

-- =========================================================
-- 6) Auto-Expire für temporäre Rechte
-- =========================================================
CREATE OR REPLACE FUNCTION public.expire_temporary_role_grants()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH updated AS (
    UPDATE public.role_temporary_grants
       SET status = 'expired', auto_revoked_at = now()
     WHERE status = 'active' AND valid_until <= now()
     RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- Updated-at Trigger für Requests
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_role_change_requests_updated
  BEFORE UPDATE ON public.role_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
