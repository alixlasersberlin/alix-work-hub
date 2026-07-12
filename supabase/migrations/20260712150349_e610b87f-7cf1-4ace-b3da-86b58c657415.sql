
-- ============================================================
-- 1) SLA-FELDER + SETTINGS
-- ============================================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS first_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_merged_into ON public.tickets(merged_into_ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_resolution_due ON public.tickets(resolution_due_at) WHERE status NOT IN ('geschlossen','gelöst','closed');

CREATE TABLE IF NOT EXISTS public.ticket_sla_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority text NOT NULL UNIQUE,
  first_response_hours numeric NOT NULL DEFAULT 4,
  resolution_hours numeric NOT NULL DEFAULT 48,
  escalation_after_hours numeric NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ticket_sla_settings TO authenticated;
GRANT ALL ON public.ticket_sla_settings TO service_role;
ALTER TABLE public.ticket_sla_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_sla_settings_select_auth"
  ON public.ticket_sla_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_sla_settings_manage_admin"
  ON public.ticket_sla_settings FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

INSERT INTO public.ticket_sla_settings(priority, first_response_hours, resolution_hours, escalation_after_hours) VALUES
  ('urgent', 1, 8, 4),
  ('high', 2, 24, 12),
  ('normal', 4, 48, 24),
  ('low', 8, 120, 72)
ON CONFLICT (priority) DO NOTHING;

-- Auto-set deadlines beim INSERT / bei Prioritätswechsel
CREATE OR REPLACE FUNCTION public.set_ticket_sla_deadlines()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP='UPDATE' AND NEW.priority IS DISTINCT FROM OLD.priority) THEN
    SELECT * INTO s FROM public.ticket_sla_settings WHERE priority = COALESCE(NEW.priority,'normal');
    IF s.id IS NULL THEN
      SELECT * INTO s FROM public.ticket_sla_settings WHERE priority='normal';
    END IF;
    IF s.id IS NOT NULL THEN
      NEW.first_response_due_at := COALESCE(NEW.created_at, now()) + (s.first_response_hours || ' hours')::interval;
      NEW.resolution_due_at := COALESCE(NEW.created_at, now()) + (s.resolution_hours || ' hours')::interval;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_ticket_sla_deadlines ON public.tickets;
CREATE TRIGGER trg_set_ticket_sla_deadlines
BEFORE INSERT OR UPDATE OF priority ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_sla_deadlines();

-- SLA-Check + Auto-Eskalation
CREATE OR REPLACE FUNCTION public.ticket_sla_check_and_escalate()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_breached int := 0;
  v_escalated int := 0;
  v_rec record;
  v_s record;
BEGIN
  -- Reaktions-/Lösungs-SLA verletzt → sla_status = breached
  UPDATE public.tickets t SET sla_status='breached', sla_last_check=now()
  WHERE status NOT IN ('geschlossen','gelöst','closed')
    AND (
      (t.first_response_at IS NULL AND t.first_response_due_at IS NOT NULL AND t.first_response_due_at < now())
      OR (t.resolution_due_at IS NOT NULL AND t.resolution_due_at < now())
    )
    AND (t.sla_status IS DISTINCT FROM 'breached');
  GET DIAGNOSTICS v_breached = ROW_COUNT;

  -- Warn-Status (75% der Zeit verstrichen)
  UPDATE public.tickets t SET sla_status='warning', sla_last_check=now()
  WHERE status NOT IN ('geschlossen','gelöst','closed')
    AND sla_status IS DISTINCT FROM 'breached'
    AND resolution_due_at IS NOT NULL
    AND now() >= created_at + ((resolution_due_at - created_at) * 0.75)
    AND now() < resolution_due_at
    AND (sla_status IS DISTINCT FROM 'warning');

  -- Eskalation
  FOR v_rec IN
    SELECT t.id, t.priority, t.escalation_count
    FROM public.tickets t
    WHERE status NOT IN ('geschlossen','gelöst','closed')
      AND sla_status = 'breached'
      AND (t.escalated_at IS NULL OR t.escalated_at < now() - interval '6 hours')
      AND COALESCE(t.escalation_count,0) < 3
    LIMIT 200
  LOOP
    SELECT * INTO v_s FROM public.ticket_sla_settings WHERE priority = COALESCE(v_rec.priority,'normal');
    UPDATE public.tickets
    SET escalation_count = COALESCE(escalation_count,0) + 1,
        escalated_at = now(),
        priority = CASE priority
          WHEN 'low' THEN 'normal'
          WHEN 'normal' THEN 'high'
          WHEN 'high' THEN 'urgent'
          ELSE priority END,
        updated_at = now()
    WHERE id = v_rec.id;

    INSERT INTO public.ticket_history(ticket_id, action, field, new_value, actor_name)
    VALUES (v_rec.id, 'sla_escalated', 'priority', 'automatische SLA-Eskalation', 'System');
    v_escalated := v_escalated + 1;
  END LOOP;

  RETURN jsonb_build_object('breached', v_breached, 'escalated', v_escalated, 'ran_at', now());
END; $$;

REVOKE ALL ON FUNCTION public.ticket_sla_check_and_escalate() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ticket_sla_check_and_escalate() TO service_role;

-- Trigger: first_response_at setzen wenn erste Agent-Antwort
CREATE OR REPLACE FUNCTION public.set_ticket_first_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sender_type IN ('agent','staff','internal') AND NEW.is_internal IS NOT TRUE THEN
    UPDATE public.tickets
    SET first_response_at = COALESCE(first_response_at, now())
    WHERE id = NEW.ticket_id AND first_response_at IS NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_ticket_first_response ON public.ticket_messages;
CREATE TRIGGER trg_ticket_first_response
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_first_response();

-- Trigger: resolved_at setzen bei Status-Wechsel
CREATE OR REPLACE FUNCTION public.set_ticket_resolved_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('gelöst','geschlossen','closed') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_ticket_resolved_at ON public.tickets;
CREATE TRIGGER trg_set_ticket_resolved_at
BEFORE UPDATE OF status ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_resolved_at();

-- ============================================================
-- 2) CSAT SURVEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ticket_csat_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  customer_email text,
  assigned_to uuid,
  rating int CHECK (rating BETWEEN 1 AND 5),
  comment text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csat_ticket ON public.ticket_csat_surveys(ticket_id);
CREATE INDEX IF NOT EXISTS idx_csat_assigned ON public.ticket_csat_surveys(assigned_to);
CREATE INDEX IF NOT EXISTS idx_csat_responded ON public.ticket_csat_surveys(responded_at);

GRANT SELECT ON public.ticket_csat_surveys TO authenticated;
GRANT ALL ON public.ticket_csat_surveys TO service_role;
ALTER TABLE public.ticket_csat_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csat_select_team" ON public.ticket_csat_surveys
  FOR SELECT TO authenticated USING (
    is_admin() OR has_role('Kundenservice') OR has_role('Technik') OR has_role('SACHBEARBEITUNG')
  );

-- ============================================================
-- 3) MERGE-FUNKTION + DUPLIKAT-VIEW
-- ============================================================
CREATE OR REPLACE FUNCTION public.ticket_merge(_source_id uuid, _target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_src record; v_tgt record;
BEGIN
  IF _source_id = _target_id THEN
    RAISE EXCEPTION 'Quelle und Ziel sind identisch';
  END IF;
  IF NOT (is_admin() OR has_role('Kundenservice') OR has_role('Technik') OR has_role('SACHBEARBEITUNG')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  SELECT id, ticket_number, status INTO v_src FROM public.tickets WHERE id = _source_id FOR UPDATE;
  SELECT id, ticket_number INTO v_tgt FROM public.tickets WHERE id = _target_id FOR UPDATE;
  IF v_src.id IS NULL OR v_tgt.id IS NULL THEN
    RAISE EXCEPTION 'Ticket nicht gefunden';
  END IF;

  UPDATE public.ticket_messages SET ticket_id = _target_id WHERE ticket_id = _source_id;
  UPDATE public.ticket_attachments SET ticket_id = _target_id WHERE ticket_id = _source_id;

  UPDATE public.tickets
  SET status = 'geschlossen',
      merged_into_ticket_id = _target_id,
      updated_at = now()
  WHERE id = _source_id;

  INSERT INTO public.ticket_history(ticket_id, action, field, new_value, actor_name)
  VALUES
    (_source_id, 'merged', 'merged_into', v_tgt.ticket_number, COALESCE(auth.email(), 'System')),
    (_target_id, 'merged_in', 'from_ticket', v_src.ticket_number, COALESCE(auth.email(), 'System'));

  RETURN jsonb_build_object('ok', true, 'source', v_src.ticket_number, 'target', v_tgt.ticket_number);
END; $$;

REVOKE ALL ON FUNCTION public.ticket_merge(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ticket_merge(uuid,uuid) TO authenticated;

-- Duplikat-View (gleicher Kunde, offen, ≤ 48h Abstand)
CREATE OR REPLACE VIEW public.ticket_potential_duplicates
WITH (security_invoker=on) AS
SELECT
  t1.id AS ticket_id,
  t1.ticket_number,
  t1.created_at,
  t1.customer_email,
  t2.id AS duplicate_of_id,
  t2.ticket_number AS duplicate_of_number,
  t2.created_at AS duplicate_of_created_at
FROM public.tickets t1
JOIN public.tickets t2
  ON lower(t1.customer_email) = lower(t2.customer_email)
 AND t1.customer_email IS NOT NULL
 AND t2.id <> t1.id
 AND t2.created_at < t1.created_at
 AND t2.created_at > t1.created_at - interval '48 hours'
 AND t2.merged_into_ticket_id IS NULL
 AND t2.status NOT IN ('geschlossen','closed')
WHERE t1.merged_into_ticket_id IS NULL;

GRANT SELECT ON public.ticket_potential_duplicates TO authenticated;
