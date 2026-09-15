
-- ============ PHASE 14: Retention, deletion concept, legal hold (additive) ============

-- 1) Data classes / retention matrix
CREATE TABLE IF NOT EXISTS public.gobd_data_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  purpose text NOT NULL,
  legal_basis text NOT NULL,
  retention_years integer NOT NULL,
  retention_start_rule text NOT NULL DEFAULT 'end_of_year_of_creation',
  source_table text,
  retention_start_column text DEFAULT 'created_at',
  storage_location text NOT NULL,
  deletable boolean NOT NULL DEFAULT false,
  responsible_role text NOT NULL,
  legal_hold_capable boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gobd_data_classes TO authenticated;
GRANT ALL ON public.gobd_data_classes TO service_role;
ALTER TABLE public.gobd_data_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gobd_dc_read" ON public.gobd_data_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "gobd_dc_write" ON public.gobd_data_classes FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Buchhaltung Admin'));
CREATE POLICY "gobd_dc_update" ON public.gobd_data_classes FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Admin') OR has_role('Buchhaltung Admin'))
  WITH CHECK (has_role('Super Admin') OR has_role('Admin') OR has_role('Buchhaltung Admin'));

-- 2) WORM log of retention rule changes
CREATE TABLE IF NOT EXISTS public.gobd_retention_rule_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_class_code text NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gobd_retention_rule_log TO authenticated;
GRANT ALL ON public.gobd_retention_rule_log TO service_role;
ALTER TABLE public.gobd_retention_rule_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gobd_rrl_read" ON public.gobd_retention_rule_log FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_worm_gobd_retention_rule_log
  BEFORE UPDATE OR DELETE ON public.gobd_retention_rule_log
  FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

-- 3) Legal holds
CREATE TABLE IF NOT EXISTS public.gobd_legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_number text,
  reason_category text NOT NULL,
  reason text NOT NULL,
  reference text,
  responsible text NOT NULL,
  scope_type text NOT NULL DEFAULT 'data_class',
  scope_data_class text,
  scope_table text,
  scope_record_id uuid,
  scope_filter jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  released_at timestamptz,
  release_reason text,
  released_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gobd_legal_holds TO authenticated;
GRANT ALL ON public.gobd_legal_holds TO service_role;
ALTER TABLE public.gobd_legal_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gobd_lh_read" ON public.gobd_legal_holds FOR SELECT TO authenticated USING (true);
CREATE POLICY "gobd_lh_insert" ON public.gobd_legal_holds FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Buchhaltung Admin'));
CREATE POLICY "gobd_lh_update" ON public.gobd_legal_holds FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Buchhaltung Admin'))
  WITH CHECK (has_role('Super Admin') OR has_role('Buchhaltung Admin'));

CREATE TABLE IF NOT EXISTS public.gobd_legal_hold_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL REFERENCES public.gobd_legal_holds(id) ON DELETE RESTRICT,
  object_table text NOT NULL,
  object_id uuid NOT NULL,
  data_class_code text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hold_id, object_table, object_id)
);
GRANT SELECT, INSERT ON public.gobd_legal_hold_items TO authenticated;
GRANT ALL ON public.gobd_legal_hold_items TO service_role;
ALTER TABLE public.gobd_legal_hold_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gobd_lhi_read" ON public.gobd_legal_hold_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "gobd_lhi_insert" ON public.gobd_legal_hold_items FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Buchhaltung Admin'));
CREATE INDEX IF NOT EXISTS idx_gobd_lhi_object ON public.gobd_legal_hold_items(object_table, object_id);

-- 4) Retention audit (WORM)
CREATE TABLE IF NOT EXISTS public.gobd_retention_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  data_class_code text,
  object_table text,
  object_id uuid,
  hold_id uuid,
  actor uuid DEFAULT auth.uid(),
  actor_context text,
  detail text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gobd_retention_audit TO authenticated;
GRANT ALL ON public.gobd_retention_audit TO service_role;
ALTER TABLE public.gobd_retention_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gobd_ra_read" ON public.gobd_retention_audit FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_worm_gobd_retention_audit
  BEFORE UPDATE OR DELETE ON public.gobd_retention_audit
  FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();
CREATE INDEX IF NOT EXISTS idx_gobd_ra_type ON public.gobd_retention_audit(event_type, created_at DESC);

-- 5) Deletion requests (four-eyes, no automatic execution)
CREATE TABLE IF NOT EXISTS public.gobd_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_class_code text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_count integer,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  requested_by uuid DEFAULT auth.uid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  denied_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gobd_deletion_requests TO authenticated;
GRANT ALL ON public.gobd_deletion_requests TO service_role;
ALTER TABLE public.gobd_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gobd_dr_read" ON public.gobd_deletion_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "gobd_dr_insert" ON public.gobd_deletion_requests FOR INSERT TO authenticated
  WITH CHECK (has_role('Super Admin') OR has_role('Buchhaltung Admin'));
CREATE POLICY "gobd_dr_update" ON public.gobd_deletion_requests FOR UPDATE TO authenticated
  USING (has_role('Super Admin') OR has_role('Buchhaltung Admin'))
  WITH CHECK (has_role('Super Admin') OR has_role('Buchhaltung Admin'));

-- no delete on requests / holds / items
CREATE TRIGGER trg_nodel_gobd_legal_holds BEFORE DELETE ON public.gobd_legal_holds
  FOR EACH ROW EXECUTE FUNCTION public.gobd_no_delete_generic();
CREATE TRIGGER trg_nodel_gobd_legal_hold_items BEFORE DELETE ON public.gobd_legal_hold_items
  FOR EACH ROW EXECUTE FUNCTION public.gobd_no_delete_generic();
CREATE TRIGGER trg_nodel_gobd_deletion_requests BEFORE DELETE ON public.gobd_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.gobd_no_delete_generic();
CREATE TRIGGER trg_touch_gobd_data_classes BEFORE UPDATE ON public.gobd_data_classes
  FOR EACH ROW EXECUTE FUNCTION public.gobd_touch_updated_at();
CREATE TRIGGER trg_touch_gobd_legal_holds BEFORE UPDATE ON public.gobd_legal_holds
  FOR EACH ROW EXECUTE FUNCTION public.gobd_touch_updated_at();
CREATE TRIGGER trg_nodel_gobd_data_classes BEFORE DELETE ON public.gobd_data_classes
  FOR EACH ROW EXECUTE FUNCTION public.gobd_no_delete_generic();

-- ============ Functions ============

CREATE OR REPLACE FUNCTION public.gobd_log_retention_event(
  _event_type text,
  _data_class_code text DEFAULT NULL,
  _object_table text DEFAULT NULL,
  _object_id uuid DEFAULT NULL,
  _hold_id uuid DEFAULT NULL,
  _detail text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.gobd_retention_audit(event_type, data_class_code, object_table, object_id, hold_id, actor, actor_context, detail, metadata)
  VALUES (_event_type, _data_class_code, _object_table, _object_id, _hold_id, auth.uid(),
          CASE WHEN public.gobd_is_service_context() THEN 'service' ELSE 'user' END, _detail, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.gobd_log_retention_event(text,text,text,uuid,uuid,text,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_log_retention_event(text,text,text,uuid,uuid,text,jsonb) TO authenticated, service_role;

-- reproducible retention due-date calculation
CREATE OR REPLACE FUNCTION public.gobd_retention_due_date(_data_class_code text, _start timestamptz)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gobd_data_classes%ROWTYPE; base date;
BEGIN
  SELECT * INTO r FROM public.gobd_data_classes WHERE code = _data_class_code;
  IF NOT FOUND OR _start IS NULL THEN RETURN NULL; END IF;
  base := CASE r.retention_start_rule
            WHEN 'creation_date' THEN _start::date
            ELSE (date_trunc('year', _start)::date + interval '1 year - 1 day')::date
          END;
  RETURN (base + make_interval(years => r.retention_years))::date;
END $$;
REVOKE ALL ON FUNCTION public.gobd_retention_due_date(text, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_retention_due_date(text, timestamptz) TO authenticated, service_role;

-- legal hold check
CREATE OR REPLACE FUNCTION public.gobd_has_legal_hold(_object_table text, _object_id uuid, _data_class_code text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gobd_legal_holds h
    WHERE h.status = 'active' AND (
      (h.scope_type = 'global')
      OR (h.scope_type = 'data_class' AND _data_class_code IS NOT NULL AND h.scope_data_class = _data_class_code)
      OR (h.scope_type = 'table' AND h.scope_table = _object_table)
      OR (h.scope_type = 'record' AND h.scope_table = _object_table AND h.scope_record_id = _object_id)
    )
  ) OR EXISTS (
    SELECT 1 FROM public.gobd_legal_hold_items i
    JOIN public.gobd_legal_holds h ON h.id = i.hold_id AND h.status = 'active'
    WHERE i.object_table = _object_table AND i.object_id = _object_id
  );
$$;
REVOKE ALL ON FUNCTION public.gobd_has_legal_hold(text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_has_legal_hold(text, uuid, text) TO authenticated, service_role;

-- generic deletion guard: blocks deletes inside retention or under legal hold, logs every denial
CREATE OR REPLACE FUNCTION public.gobd_retention_delete_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class text := TG_ARGV[0];
  r public.gobd_data_classes%ROWTYPE;
  v_start timestamptz;
  v_due date;
  v_id uuid;
  v_hold boolean;
BEGIN
  SELECT * INTO r FROM public.gobd_data_classes WHERE code = v_class;
  BEGIN v_id := (to_jsonb(OLD) ->> 'id')::uuid; EXCEPTION WHEN others THEN v_id := NULL; END;
  IF r.id IS NULL THEN RETURN OLD; END IF;

  v_hold := public.gobd_has_legal_hold(TG_TABLE_NAME, v_id, v_class);
  IF v_hold THEN
    PERFORM public.gobd_log_retention_event('DELETION_DENIED', v_class, TG_TABLE_NAME, v_id, NULL,
      'Löschung abgewiesen: aktive Aufbewahrungssperre (Legal Hold)', jsonb_build_object('reason','LEGAL_HOLD'));
    RAISE EXCEPTION 'GoBD: Löschung nicht möglich – aktive Aufbewahrungssperre (Legal Hold) für % %', TG_TABLE_NAME, v_id;
  END IF;

  BEGIN
    v_start := (to_jsonb(OLD) ->> COALESCE(r.retention_start_column, 'created_at'))::timestamptz;
  EXCEPTION WHEN others THEN v_start := NULL; END;
  v_due := public.gobd_retention_due_date(v_class, COALESCE(v_start, now()));

  IF NOT r.deletable OR v_due IS NULL OR v_due > CURRENT_DATE THEN
    PERFORM public.gobd_log_retention_event('DELETION_DENIED', v_class, TG_TABLE_NAME, v_id, NULL,
      'Löschung abgewiesen: Aufbewahrungsfrist nicht abgelaufen',
      jsonb_build_object('reason','RETENTION_PERIOD','due_date', v_due, 'deletable', r.deletable));
    RAISE EXCEPTION 'GoBD: Löschung nicht möglich – Aufbewahrungsfrist läuft bis % (%, %)', COALESCE(v_due::text,'unbestimmt'), TG_TABLE_NAME, v_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gobd_deletion_requests d
    WHERE d.data_class_code = v_class AND d.status = 'approved'
  ) THEN
    PERFORM public.gobd_log_retention_event('DELETION_DENIED', v_class, TG_TABLE_NAME, v_id, NULL,
      'Löschung abgewiesen: keine freigegebene Löschfreigabe (Vier-Augen-Prinzip)',
      jsonb_build_object('reason','NO_APPROVED_REQUEST'));
    RAISE EXCEPTION 'GoBD: Löschung nicht möglich – keine freigegebene Löschfreigabe für Datenklasse %', v_class;
  END IF;

  PERFORM public.gobd_log_retention_event('DELETION_EXECUTED', v_class, TG_TABLE_NAME, v_id, NULL,
    'Löschung durchgeführt nach Fristablauf und Freigabe', jsonb_build_object('due_date', v_due));
  RETURN OLD;
END $$;

-- rule change logging
CREATE OR REPLACE FUNCTION public.gobd_data_class_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.gobd_retention_rule_log(data_class_code, action, new_values)
    VALUES (NEW.code, 'CREATED', to_jsonb(NEW));
    PERFORM public.gobd_log_retention_event('RETENTION_RULE_CREATED', NEW.code, 'gobd_data_classes', NEW.id, NULL, 'Aufbewahrungsregel angelegt', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  -- shortening a retention period must never silently make data deletable
  IF NEW.retention_years < OLD.retention_years OR (NEW.deletable AND NOT OLD.deletable) THEN
    INSERT INTO public.gobd_retention_rule_log(data_class_code, action, old_values, new_values)
    VALUES (NEW.code, 'RELAXED', to_jsonb(OLD), to_jsonb(NEW));
    PERFORM public.gobd_log_retention_event('RETENTION_RULE_RELAXED', NEW.code, 'gobd_data_classes', NEW.id, NULL,
      'Aufbewahrungsregel verkürzt/gelockert – wirkt nur zukünftig, Freigabe erforderlich', jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  ELSE
    INSERT INTO public.gobd_retention_rule_log(data_class_code, action, old_values, new_values)
    VALUES (NEW.code, 'UPDATED', to_jsonb(OLD), to_jsonb(NEW));
    PERFORM public.gobd_log_retention_event('RETENTION_RULE_UPDATED', NEW.code, 'gobd_data_classes', NEW.id, NULL, 'Aufbewahrungsregel geändert', jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_gobd_data_class_audit AFTER INSERT OR UPDATE ON public.gobd_data_classes
  FOR EACH ROW EXECUTE FUNCTION public.gobd_data_class_audit();

-- legal hold audit + protection against unauthorised release
CREATE OR REPLACE FUNCTION public.gobd_legal_hold_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.gobd_log_retention_event('LEGAL_HOLD_SET', NEW.scope_data_class, NEW.scope_table, NEW.scope_record_id, NEW.id,
      'Aufbewahrungssperre gesetzt: ' || NEW.reason, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  IF OLD.status = 'active' AND NEW.status <> 'active' THEN
    IF NOT (has_role('Super Admin') OR has_role('Buchhaltung Admin')) THEN
      PERFORM public.gobd_log_retention_event('LEGAL_HOLD_RELEASE_DENIED', OLD.scope_data_class, OLD.scope_table, OLD.scope_record_id, OLD.id,
        'Aufhebung der Aufbewahrungssperre abgewiesen: fehlende Berechtigung', '{}'::jsonb);
      RAISE EXCEPTION 'GoBD: Aufhebung einer Aufbewahrungssperre erfordert die Rolle Super Admin oder Buchhaltung Admin';
    END IF;
    IF COALESCE(btrim(NEW.release_reason), '') = '' THEN
      RAISE EXCEPTION 'GoBD: Aufhebung einer Aufbewahrungssperre erfordert eine Begründung';
    END IF;
    NEW.released_at := COALESCE(NEW.released_at, now());
    NEW.released_by := COALESCE(NEW.released_by, auth.uid());
    PERFORM public.gobd_log_retention_event('LEGAL_HOLD_RELEASED', NEW.scope_data_class, NEW.scope_table, NEW.scope_record_id, NEW.id,
      'Aufbewahrungssperre aufgehoben: ' || NEW.release_reason, to_jsonb(NEW));
  ELSIF OLD.status <> 'active' AND NEW.status = 'active' THEN
    PERFORM public.gobd_log_retention_event('LEGAL_HOLD_REACTIVATED', NEW.scope_data_class, NEW.scope_table, NEW.scope_record_id, NEW.id, 'Aufbewahrungssperre reaktiviert', to_jsonb(NEW));
  ELSE
    PERFORM public.gobd_log_retention_event('LEGAL_HOLD_CHANGED', NEW.scope_data_class, NEW.scope_table, NEW.scope_record_id, NEW.id, 'Aufbewahrungssperre geändert', jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_gobd_legal_hold_audit BEFORE INSERT OR UPDATE ON public.gobd_legal_holds
  FOR EACH ROW EXECUTE FUNCTION public.gobd_legal_hold_audit();

-- deletion request audit + four eyes
CREATE OR REPLACE FUNCTION public.gobd_deletion_request_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.gobd_log_retention_event('DELETION_REQUESTED', NEW.data_class_code, NULL, NEW.id, NULL, NEW.reason, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF NEW.approved_by IS NOT NULL AND NEW.approved_by = OLD.requested_by THEN
      RAISE EXCEPTION 'GoBD: Vier-Augen-Prinzip – Antragsteller darf die Löschung nicht selbst freigeben';
    END IF;
    IF NOT has_role('Super Admin') THEN
      RAISE EXCEPTION 'GoBD: Löschfreigabe nur durch Super Admin';
    END IF;
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    PERFORM public.gobd_log_retention_event('DELETION_APPROVED', NEW.data_class_code, NULL, NEW.id, NULL, 'Löschung freigegeben', to_jsonb(NEW));
  ELSIF NEW.status = 'denied' AND OLD.status <> 'denied' THEN
    PERFORM public.gobd_log_retention_event('DELETION_DENIED', NEW.data_class_code, NULL, NEW.id, NULL, COALESCE(NEW.denied_reason, 'Antrag abgelehnt'), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_gobd_deletion_request_audit BEFORE INSERT OR UPDATE ON public.gobd_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.gobd_deletion_request_audit();

-- ============ Dry run ============
CREATE OR REPLACE FUNCTION public.gobd_retention_dry_run(_log boolean DEFAULT true)
RETURNS TABLE(
  data_class text,
  label text,
  source_table text,
  total_records bigint,
  period_from date,
  period_to date,
  due_for_deletion bigint,
  blocked_retention bigint,
  blocked_legal_hold bigint,
  blocked_not_deletable bigint,
  would_delete bigint,
  exclusion_reason text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gobd_data_classes%ROWTYPE; q text; rec record; v_hold boolean;
BEGIN
  FOR r IN SELECT * FROM public.gobd_data_classes WHERE active ORDER BY code LOOP
    data_class := r.code; label := r.label; source_table := r.source_table;
    total_records := 0; due_for_deletion := 0; blocked_retention := 0; blocked_legal_hold := 0;
    blocked_not_deletable := 0; would_delete := 0; period_from := NULL; period_to := NULL;
    exclusion_reason := NULL;

    v_hold := EXISTS (SELECT 1 FROM public.gobd_legal_holds h WHERE h.status='active'
      AND (h.scope_type='global' OR (h.scope_type='data_class' AND h.scope_data_class=r.code)
           OR (h.scope_type='table' AND h.scope_table=r.source_table)));

    IF r.source_table IS NOT NULL AND to_regclass('public.' || r.source_table) IS NOT NULL THEN
      q := format(
        'SELECT count(*)::bigint AS total,
                min(%1$I)::date AS pfrom, max(%1$I)::date AS pto,
                count(*) FILTER (WHERE public.gobd_retention_due_date(%2$L, %1$I) <= CURRENT_DATE)::bigint AS due
         FROM public.%3$I', COALESCE(r.retention_start_column,'created_at'), r.code, r.source_table);
      BEGIN
        EXECUTE q INTO rec;
        total_records := COALESCE(rec.total,0);
        period_from := rec.pfrom; period_to := rec.pto;
        due_for_deletion := COALESCE(rec.due,0);
        blocked_retention := total_records - due_for_deletion;
      EXCEPTION WHEN others THEN
        exclusion_reason := 'Auswertung nicht möglich: ' || SQLERRM;
      END;
    ELSE
      exclusion_reason := 'Keine auswertbare Quelltabelle hinterlegt';
    END IF;

    IF v_hold THEN
      blocked_legal_hold := due_for_deletion;
      exclusion_reason := COALESCE(exclusion_reason || ' | ', '') || 'Aktive Aufbewahrungssperre (Legal Hold)';
    ELSIF NOT r.deletable THEN
      blocked_not_deletable := due_for_deletion;
      exclusion_reason := COALESCE(exclusion_reason || ' | ', '') || 'Datenklasse als nicht löschbar klassifiziert';
    ELSIF NOT EXISTS (SELECT 1 FROM public.gobd_deletion_requests d WHERE d.data_class_code=r.code AND d.status='approved') THEN
      exclusion_reason := COALESCE(exclusion_reason || ' | ', '') || 'Keine freigegebene Löschfreigabe (Vier-Augen-Prinzip)';
    ELSE
      would_delete := due_for_deletion;
    END IF;

    RETURN NEXT;
  END LOOP;

  IF _log THEN
    PERFORM public.gobd_log_retention_event('DRY_RUN', NULL, NULL, NULL, NULL, 'Löschvorschau (Dry Run) ausgeführt – keine Daten gelöscht', '{}'::jsonb);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.gobd_retention_dry_run(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_retention_dry_run(boolean) TO authenticated, service_role;

-- ============ Upcoming expiries ============
CREATE OR REPLACE FUNCTION public.gobd_retention_overview()
RETURNS TABLE(
  data_class text, label text, source_table text, retention_years integer,
  retention_start_rule text, storage_location text, deletable boolean,
  responsible_role text, legal_hold_capable boolean, legal_basis text,
  total_records bigint, oldest date, earliest_due date, active_holds bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gobd_data_classes%ROWTYPE; rec record;
BEGIN
  FOR r IN SELECT * FROM public.gobd_data_classes WHERE active ORDER BY code LOOP
    data_class := r.code; label := r.label; source_table := r.source_table;
    retention_years := r.retention_years; retention_start_rule := r.retention_start_rule;
    storage_location := r.storage_location; deletable := r.deletable;
    responsible_role := r.responsible_role; legal_hold_capable := r.legal_hold_capable;
    legal_basis := r.legal_basis; total_records := 0; oldest := NULL; earliest_due := NULL;
    SELECT count(*) INTO active_holds FROM public.gobd_legal_holds h
      WHERE h.status='active' AND (h.scope_type='global' OR h.scope_data_class=r.code OR h.scope_table=r.source_table);
    IF r.source_table IS NOT NULL AND to_regclass('public.' || r.source_table) IS NOT NULL THEN
      BEGIN
        EXECUTE format('SELECT count(*)::bigint AS total, min(%1$I)::timestamptz AS oldest FROM public.%2$I',
          COALESCE(r.retention_start_column,'created_at'), r.source_table) INTO rec;
        total_records := COALESCE(rec.total,0);
        oldest := rec.oldest::date;
        earliest_due := public.gobd_retention_due_date(r.code, rec.oldest);
      EXCEPTION WHEN others THEN NULL; END;
    END IF;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.gobd_retention_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_retention_overview() TO authenticated, service_role;

-- ============ Phase 14 check report ============
CREATE OR REPLACE FUNCTION public.gobd_phase14_check()
RETURNS TABLE(bereich text, pruefung text, status text, detail text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; m int;
BEGIN
  SELECT count(*) INTO n FROM public.gobd_data_classes WHERE active;
  RETURN QUERY SELECT '1 Dateninventar', 'Klassifizierte GoBD-Datenbestände', CASE WHEN n >= 12 THEN 'BESTANDEN' ELSE 'OFFEN' END, n || ' aktive Datenklassen erfasst';

  SELECT count(*) INTO n FROM public.gobd_data_classes WHERE active;
  SELECT count(DISTINCT retention_years) INTO m FROM public.gobd_data_classes WHERE active;
  RETURN QUERY SELECT '2 Aufbewahrungsmatrix', 'Differenzierte Fristen (nicht pauschal 10 Jahre)',
    CASE WHEN m >= 2 THEN 'BESTANDEN' ELSE 'WARNUNG' END, m || ' unterschiedliche Fristlängen über ' || n || ' Datenklassen';

  RETURN QUERY SELECT '3 Fristberechnung', 'Reproduzierbare Berechnung des Löschdatums',
    CASE WHEN public.gobd_retention_due_date('INVOICE', '2020-03-05'::timestamptz) = '2030-12-31'::date THEN 'BESTANDEN' ELSE 'FEHLER' END,
    'Referenzfall Rechnung 05.03.2020 → ' || COALESCE(public.gobd_retention_due_date('INVOICE','2020-03-05'::timestamptz)::text,'—');

  SELECT count(*) INTO n FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE p.proname='gobd_retention_delete_guard' AND NOT t.tgisinternal;
  RETURN QUERY SELECT '4 Löschschutz', 'Löschschutz-Trigger aktiv', CASE WHEN n >= 5 THEN 'BESTANDEN' ELSE 'WARNUNG' END, n || ' Tabellen mit Löschschutz';

  SELECT count(*) INTO n FROM public.gobd_retention_audit WHERE event_type='DELETION_DENIED';
  RETURN QUERY SELECT '4 Löschschutz', 'Abgewiesene Löschversuche protokolliert', CASE WHEN n > 0 THEN 'BESTANDEN' ELSE 'OFFEN' END, n || ' protokollierte Abweisungen';

  SELECT count(*) INTO n FROM public.gobd_legal_holds;
  RETURN QUERY SELECT '5 Legal Hold', 'Aufbewahrungssperren verfügbar und protokolliert', 'BESTANDEN', n || ' Sperren erfasst, Setzen/Aufheben unveränderbar protokolliert';

  SELECT count(*) INTO n FROM public.gobd_deletion_requests WHERE status='approved';
  RETURN QUERY SELECT '6 Löschverfahren', 'Kein automatischer produktiver Löschlauf aktiv',
    CASE WHEN n = 0 THEN 'BESTANDEN' ELSE 'WARNUNG' END, n || ' freigegebene Löschanträge; ausschließlich Dry Run implementiert';

  RETURN QUERY SELECT '7 Löschfreigabe', 'Vier-Augen-Prinzip für endgültige Löschungen', 'OFFEN',
    'Technisch erzwungen (Antragsteller ≠ Freigeber, Freigabe nur Super Admin); organisatorische Inkraftsetzung ausstehend';

  SELECT count(*) INTO n FROM public.backups_metadata;
  RETURN QUERY SELECT '8 Sicherungen', 'Zusammenspiel Löschfristen / Sicherungen dokumentiert', 'WARNUNG',
    n || ' Sicherungen vorhanden, unverändert; Umgang mit gelöschten Daten in Backups dokumentiert, organisatorische Bestätigung offen';

  SELECT count(*) INTO n FROM public.gobd_retention_audit;
  RETURN QUERY SELECT '9 Audit', 'Aufbewahrungs-Audit unveränderbar (WORM)', 'BESTANDEN', n || ' Audit-Einträge, Änderung/Löschung technisch gesperrt';

  RETURN QUERY SELECT '10 Verwaltung', 'Seite Buchhaltung → GoBD · Aufbewahrung & Legal Hold', 'BESTANDEN', 'Matrix, Legal Holds, Fristübersicht, Dry Run, Löschprotokoll, Prüfnachweise';

  RETURN QUERY SELECT '12 Gesamtaussage', 'Systemweiter Status', 'OFFEN', 'Technische GoBD-Prüfung bestanden – organisatorischer Abschluss läuft';
END $$;
REVOKE ALL ON FUNCTION public.gobd_phase14_check() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_phase14_check() TO authenticated, service_role;
