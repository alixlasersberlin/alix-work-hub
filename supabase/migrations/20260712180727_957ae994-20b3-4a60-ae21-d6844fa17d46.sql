
CREATE TABLE IF NOT EXISTS public.role_sod_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  role_a_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  role_b_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'warn' CHECK (severity IN ('warn','block')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role_a_id <> role_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sod_pair
  ON public.role_sod_rules (LEAST(role_a_id, role_b_id), GREATEST(role_a_id, role_b_id));

GRANT SELECT ON public.role_sod_rules TO authenticated;
GRANT ALL ON public.role_sod_rules TO service_role;
ALTER TABLE public.role_sod_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin liest SoD" ON public.role_sod_rules
  FOR SELECT TO authenticated USING (public.has_role('Super Admin'));
CREATE POLICY "Super Admin verwaltet SoD" ON public.role_sod_rules
  FOR ALL TO authenticated USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.set_sod_updated()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_sod_updated ON public.role_sod_rules;
CREATE TRIGGER trg_sod_updated BEFORE UPDATE ON public.role_sod_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_sod_updated();

-- Trigger: SoD-Blockierung bei neuer Zuweisung
CREATE OR REPLACE FUNCTION public.enforce_sod_on_user_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conflict RECORD;
BEGIN
  -- Super Admins können SoD überschreiben (Notfall/Ausnahme, bleibt im Audit sichtbar)
  IF public.has_role('Super Admin') THEN
    RETURN NEW;
  END IF;

  SELECT s.name, s.severity, s.id INTO v_conflict
  FROM public.role_sod_rules s
  WHERE s.is_active AND s.severity = 'block'
    AND (
      (s.role_a_id = NEW.role_id AND EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = NEW.user_id AND ur.role_id = s.role_b_id
      ))
      OR
      (s.role_b_id = NEW.role_id AND EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = NEW.user_id AND ur.role_id = s.role_a_id
      ))
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'SoD-Verletzung: Regel "%" blockiert diese Rollenkombination', v_conflict.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_sod ON public.user_roles;
CREATE TRIGGER trg_enforce_sod BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sod_on_user_roles();

-- Konflikt-Report
CREATE OR REPLACE FUNCTION public.sod_conflict_report()
RETURNS TABLE(
  rule_id UUID,
  rule_name TEXT,
  severity TEXT,
  user_id UUID,
  role_a_name TEXT,
  role_b_name TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin';
  END IF;
  RETURN QUERY
  SELECT s.id, s.name, s.severity, ua.user_id, ra.name, rb.name
  FROM public.role_sod_rules s
  JOIN public.roles ra ON ra.id = s.role_a_id
  JOIN public.roles rb ON rb.id = s.role_b_id
  JOIN public.user_roles ua ON ua.role_id = s.role_a_id
  JOIN public.user_roles ub ON ub.role_id = s.role_b_id AND ub.user_id = ua.user_id
  WHERE s.is_active
  ORDER BY s.severity DESC, s.name;
END;
$$;
