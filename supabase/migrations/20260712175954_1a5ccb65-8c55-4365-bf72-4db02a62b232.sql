
CREATE TABLE IF NOT EXISTS public.role_context_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('time_window','weekday','ip_allowlist','session_limit')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_context_policies TO authenticated;
GRANT ALL ON public.role_context_policies TO service_role;
ALTER TABLE public.role_context_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin liest Kontextregeln"
  ON public.role_context_policies FOR SELECT TO authenticated
  USING (public.has_role('Super Admin'));

CREATE POLICY "Super Admin verwaltet Kontextregeln"
  ON public.role_context_policies FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_role_context_role ON public.role_context_policies(role_id, is_active);

CREATE OR REPLACE FUNCTION public.set_role_context_updated()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_role_context_updated ON public.role_context_policies;
CREATE TRIGGER trg_role_context_updated BEFORE UPDATE ON public.role_context_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_role_context_updated();

-- Evaluator: prüft alle aktiven Regeln einer Rolle
CREATE OR REPLACE FUNCTION public.evaluate_role_context(
  _role_id UUID,
  _ip TEXT DEFAULT NULL,
  _at TIMESTAMPTZ DEFAULT now(),
  _tz TEXT DEFAULT 'Europe/Berlin'
) RETURNS TABLE(
  policy_id UUID,
  policy_type TEXT,
  passed BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  v_local TIMESTAMPTZ;
  v_dow INT;
  v_time TIME;
  v_start TIME;
  v_end TIME;
  v_days JSONB;
  v_cidrs JSONB;
  v_ok BOOLEAN;
  v_cidr TEXT;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Kontextregeln auswerten';
  END IF;

  v_local := _at AT TIME ZONE _tz;
  v_dow := EXTRACT(ISODOW FROM v_local)::INT; -- 1=Mo..7=So
  v_time := v_local::TIME;

  FOR p IN
    SELECT * FROM public.role_context_policies
    WHERE role_id = _role_id AND is_active
  LOOP
    IF p.policy_type = 'time_window' THEN
      v_start := COALESCE((p.config->>'start')::TIME, '00:00'::TIME);
      v_end   := COALESCE((p.config->>'end')::TIME,   '23:59'::TIME);
      v_ok := (v_time >= v_start AND v_time <= v_end);
      RETURN QUERY SELECT p.id, p.policy_type, v_ok,
        CASE WHEN v_ok THEN format('Innerhalb %s–%s', v_start, v_end)
             ELSE format('Außerhalb %s–%s (aktuell %s)', v_start, v_end, v_time) END;

    ELSIF p.policy_type = 'weekday' THEN
      v_days := COALESCE(p.config->'days', '[1,2,3,4,5]'::jsonb);
      v_ok := EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_days) d WHERE d::INT = v_dow);
      RETURN QUERY SELECT p.id, p.policy_type, v_ok,
        CASE WHEN v_ok THEN format('Wochentag %s erlaubt', v_dow)
             ELSE format('Wochentag %s nicht erlaubt', v_dow) END;

    ELSIF p.policy_type = 'ip_allowlist' THEN
      v_cidrs := COALESCE(p.config->'cidrs', '[]'::jsonb);
      IF _ip IS NULL THEN
        RETURN QUERY SELECT p.id, p.policy_type, false, 'Keine IP übermittelt';
      ELSE
        v_ok := false;
        FOR v_cidr IN SELECT jsonb_array_elements_text(v_cidrs) LOOP
          BEGIN
            IF _ip::inet <<= v_cidr::inet THEN v_ok := true; EXIT; END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END LOOP;
        RETURN QUERY SELECT p.id, p.policy_type, v_ok,
          CASE WHEN v_ok THEN format('IP %s ist im Allowlist', _ip)
               ELSE format('IP %s nicht im Allowlist', _ip) END;
      END IF;

    ELSIF p.policy_type = 'session_limit' THEN
      -- rein informativ; Enforcement erfolgt clientseitig
      RETURN QUERY SELECT p.id, p.policy_type, true,
        format('Max. Session: %s Min.', COALESCE(p.config->>'minutes','60'));
    END IF;
  END LOOP;
END;
$$;
