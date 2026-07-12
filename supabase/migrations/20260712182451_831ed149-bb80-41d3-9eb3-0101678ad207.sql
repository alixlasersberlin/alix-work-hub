
-- === Geplante Zuweisungen ===
CREATE OR REPLACE FUNCTION public.schedule_role_grant(
  _user_id uuid, _role_id uuid, _valid_from timestamptz, _valid_until timestamptz, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid; rname text;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin' USING ERRCODE='insufficient_privilege';
  END IF;
  IF _valid_from >= _valid_until THEN RAISE EXCEPTION 'Ungültiger Zeitraum'; END IF;
  SELECT name INTO rname FROM public.roles WHERE id = _role_id;
  INSERT INTO public.role_temporary_grants(user_id, role_id, role_name, valid_from, valid_until, reason, granted_by, status)
  VALUES (_user_id, _role_id, rname, _valid_from, _valid_until, _reason, auth.uid(),
          CASE WHEN _valid_from > now() THEN 'scheduled' ELSE 'active' END)
  RETURNING id INTO new_id;
  IF _valid_from <= now() THEN
    INSERT INTO public.user_roles(user_id, role_id) VALUES (_user_id, _role_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.process_scheduled_grants()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE activated int := 0; expired int := 0; g record;
BEGIN
  -- Aktivieren
  FOR g IN SELECT * FROM public.role_temporary_grants WHERE status='scheduled' AND valid_from <= now() LOOP
    INSERT INTO public.user_roles(user_id, role_id) VALUES (g.user_id, g.role_id) ON CONFLICT DO NOTHING;
    UPDATE public.role_temporary_grants SET status='active' WHERE id=g.id;
    activated := activated + 1;
  END LOOP;
  -- Ablaufen
  FOR g IN SELECT * FROM public.role_temporary_grants WHERE status='active' AND valid_until <= now() LOOP
    DELETE FROM public.user_roles WHERE user_id=g.user_id AND role_id=g.role_id;
    UPDATE public.role_temporary_grants SET status='expired', auto_revoked_at=now() WHERE id=g.id;
    expired := expired + 1;
  END LOOP;
  RETURN jsonb_build_object('activated', activated, 'expired', expired);
END; $$;

-- === Genehmigungsketten ===
CREATE TABLE public.role_approval_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  step_no integer NOT NULL,
  required_role_name text NOT NULL,
  min_approvals integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, step_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_approval_chains TO authenticated;
GRANT ALL ON public.role_approval_chains TO service_role;
ALTER TABLE public.role_approval_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA manage approval chains" ON public.role_approval_chains
  FOR ALL USING (public.has_role('Super Admin')) WITH CHECK (public.has_role('Super Admin'));

CREATE TABLE public.role_request_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.role_change_requests(id) ON DELETE CASCADE,
  step_no integer NOT NULL,
  approver_id uuid NOT NULL,
  approver_role_name text,
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_request_approvals TO authenticated;
GRANT ALL ON public.role_request_approvals TO service_role;
ALTER TABLE public.role_request_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA read request approvals" ON public.role_request_approvals
  FOR SELECT USING (public.has_role('Super Admin') OR approver_id = auth.uid());
CREATE POLICY "Approver insert own" ON public.role_request_approvals
  FOR INSERT WITH CHECK (approver_id = auth.uid());
