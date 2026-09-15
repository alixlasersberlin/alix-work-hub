-- =========================================================
-- GoBD Phase 16: Organisatorischer Abschluss (additiv)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.gobd_responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  duty text NOT NULL,
  role_name text,
  person_name text,
  person_email text,
  deputy_name text,
  status text NOT NULL DEFAULT 'offen',
  confirmed_by uuid,
  confirmed_by_name text,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area, duty)
);

GRANT SELECT ON public.gobd_responsibilities TO authenticated;
GRANT ALL ON public.gobd_responsibilities TO service_role;
ALTER TABLE public.gobd_responsibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gobd_resp_read" ON public.gobd_responsibilities
FOR SELECT TO authenticated USING (public.can_access_finance());

CREATE TABLE IF NOT EXISTS public.gobd_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  subject_label text NOT NULL,
  doc_version text,
  decision text NOT NULL,
  approver_id uuid,
  approver_name text NOT NULL,
  approver_role text NOT NULL,
  reason text,
  evidence_ref text,
  approved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gobd_approvals TO authenticated;
GRANT ALL ON public.gobd_approvals TO service_role;
ALTER TABLE public.gobd_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gobd_appr_read" ON public.gobd_approvals
FOR SELECT TO authenticated USING (public.can_access_finance());

CREATE TABLE IF NOT EXISTS public.gobd_final_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text NOT NULL UNIQUE,
  version integer NOT NULL,
  status text NOT NULL,
  technical_status text NOT NULL,
  organizational_status text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gobd_final_reports TO authenticated;
GRANT ALL ON public.gobd_final_reports TO service_role;
ALTER TABLE public.gobd_final_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gobd_final_read" ON public.gobd_final_reports
FOR SELECT TO authenticated USING (public.can_access_finance());

-- WORM-Schutz: Freigaben und Abschlussberichte sind unveraenderbar
CREATE OR REPLACE FUNCTION public.gobd_worm_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'GoBD: % ist unveraenderbar (WORM). % nicht zulaessig.', TG_TABLE_NAME, TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_gobd_approvals_worm ON public.gobd_approvals;
CREATE TRIGGER trg_gobd_approvals_worm
BEFORE UPDATE OR DELETE ON public.gobd_approvals
FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

DROP TRIGGER IF EXISTS trg_gobd_final_reports_worm ON public.gobd_final_reports;
CREATE TRIGGER trg_gobd_final_reports_worm
BEFORE UPDATE OR DELETE ON public.gobd_final_reports
FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

-- Verantwortlichkeit pflegen / bestaetigen (Admin oder Super Admin)
CREATE OR REPLACE FUNCTION public.gobd_set_responsibility(
  p_area text, p_duty text, p_role_name text, p_person_name text,
  p_person_email text DEFAULT NULL, p_deputy_name text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_confirm boolean DEFAULT false,
  p_confirmed_by_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin')) THEN
    RAISE EXCEPTION 'Keine Berechtigung fuer Verantwortlichkeiten';
  END IF;
  IF coalesce(btrim(p_area),'') = '' OR coalesce(btrim(p_duty),'') = '' THEN
    RAISE EXCEPTION 'Bereich und Aufgabe sind Pflicht';
  END IF;

  INSERT INTO public.gobd_responsibilities
    (area, duty, role_name, person_name, person_email, deputy_name, notes, status,
     confirmed_by, confirmed_by_name, confirmed_at)
  VALUES (btrim(p_area), btrim(p_duty), p_role_name, p_person_name, p_person_email,
          p_deputy_name, p_notes,
          CASE WHEN p_confirm THEN 'bestaetigt' ELSE 'offen' END,
          CASE WHEN p_confirm THEN auth.uid() END,
          CASE WHEN p_confirm THEN p_confirmed_by_name END,
          CASE WHEN p_confirm THEN now() END)
  ON CONFLICT (area, duty) DO UPDATE SET
    role_name = excluded.role_name,
    person_name = excluded.person_name,
    person_email = excluded.person_email,
    deputy_name = excluded.deputy_name,
    notes = excluded.notes,
    status = CASE WHEN p_confirm THEN 'bestaetigt' ELSE 'offen' END,
    confirmed_by = CASE WHEN p_confirm THEN auth.uid() END,
    confirmed_by_name = CASE WHEN p_confirm THEN p_confirmed_by_name END,
    confirmed_at = CASE WHEN p_confirm THEN now() END,
    updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.gobd_change_log (version, responsible, area, description, evidence, phase, created_by)
  VALUES ('org', coalesce(p_confirmed_by_name, p_person_name, 'unbekannt'), btrim(p_area),
          'Verantwortlichkeit gepflegt: ' || btrim(p_duty) ||
          CASE WHEN p_confirm THEN ' (bestaetigt)' ELSE ' (offen)' END,
          'gobd_responsibilities:' || v_id::text, 'Phase 16', auth.uid());

  RETURN v_id;
END;
$$;

-- Freigabe erteilen (unveraenderbar protokolliert)
CREATE OR REPLACE FUNCTION public.gobd_record_approval(
  p_subject text, p_decision text, p_approver_name text, p_approver_role text,
  p_reason text DEFAULT NULL, p_doc_version text DEFAULT NULL, p_evidence_ref text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id uuid;
  v_label text;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf GoBD-Freigaben erteilen';
  END IF;
  IF p_decision NOT IN ('freigegeben','abgelehnt','zurueckgestellt') THEN
    RAISE EXCEPTION 'Ungueltige Entscheidung';
  END IF;
  IF coalesce(btrim(p_approver_name),'') = '' OR coalesce(btrim(p_approver_role),'') = '' THEN
    RAISE EXCEPTION 'Name und Funktion des Freigebenden sind Pflicht';
  END IF;

  v_label := CASE p_subject
    WHEN 'verfahrensdokumentation' THEN 'Verfahrensdokumentation'
    WHEN 'aufbewahrungskonzept'   THEN 'Aufbewahrungskonzept'
    WHEN 'berechtigungskonzept'   THEN 'Berechtigungskonzept'
    WHEN 'wiederherstellung'      THEN 'Datensicherung & Wiederherstellungsnachweis'
    WHEN 'vier_augen'             THEN 'Vier-Augen-Prinzip'
    WHEN 'loeschfreigabe'         THEN 'Aufbewahrungs- und Loeschfreigabe'
    WHEN 'gesamtfreigabe'         THEN 'GoBD-Gesamtfreigabe'
    ELSE NULL END;

  IF v_label IS NULL THEN
    RAISE EXCEPTION 'Unbekannter Freigabegegenstand: %', p_subject;
  END IF;

  IF p_decision <> 'freigegeben' AND coalesce(btrim(p_reason),'') = '' THEN
    RAISE EXCEPTION 'Begruendung erforderlich';
  END IF;

  INSERT INTO public.gobd_approvals
    (subject, subject_label, doc_version, decision, approver_id, approver_name, approver_role, reason, evidence_ref)
  VALUES (p_subject, v_label, p_doc_version, p_decision, auth.uid(),
          btrim(p_approver_name), btrim(p_approver_role), p_reason, p_evidence_ref)
  RETURNING id INTO v_id;

  INSERT INTO public.gobd_change_log (version, responsible, area, description, evidence, phase, created_by)
  VALUES (coalesce(p_doc_version,'org'), btrim(p_approver_name), 'Freigaben',
          v_label || ': ' || p_decision, 'gobd_approvals:' || v_id::text, 'Phase 16', auth.uid());

  RETURN v_id;
END;
$$;

-- Organisatorischer Status
CREATE OR REPLACE FUNCTION public.gobd_org_status()
RETURNS TABLE(bereich text, pruefung text, status text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  s text;
  v_ok boolean;
  v_row record;
  v_open int;
BEGIN
  FOREACH s IN ARRAY ARRAY['verfahrensdokumentation','aufbewahrungskonzept','berechtigungskonzept',
                           'wiederherstellung','vier_augen','loeschfreigabe'] LOOP
    SELECT * INTO v_row FROM public.gobd_approvals a
    WHERE a.subject = s ORDER BY a.approved_at DESC LIMIT 1;

    IF v_row.id IS NULL THEN
      RETURN QUERY SELECT 'Freigaben'::text, s, 'OFFEN'::text, 'Keine Freigabe dokumentiert'::text;
    ELSIF v_row.decision = 'freigegeben' THEN
      RETURN QUERY SELECT 'Freigaben'::text, s, 'BESTANDEN'::text,
        (v_row.approver_name || ' (' || v_row.approver_role || ') am ' ||
         to_char(v_row.approved_at, 'DD.MM.YYYY'))::text;
    ELSE
      RETURN QUERY SELECT 'Freigaben'::text, s, 'FEHLER'::text,
        (v_row.decision || ': ' || coalesce(v_row.reason,''))::text;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_open FROM public.gobd_responsibilities r WHERE r.status <> 'bestaetigt';
  IF (SELECT count(*) FROM public.gobd_responsibilities) = 0 THEN
    RETURN QUERY SELECT 'Verantwortlichkeiten'::text, 'Zuordnung', 'OFFEN'::text,
      'Keine Verantwortlichkeiten hinterlegt'::text;
  ELSIF v_open > 0 THEN
    RETURN QUERY SELECT 'Verantwortlichkeiten'::text, 'Zuordnung', 'WARNUNG'::text,
      (v_open::text || ' Eintraege ohne Bestaetigung')::text;
  ELSE
    RETURN QUERY SELECT 'Verantwortlichkeiten'::text, 'Zuordnung', 'BESTANDEN'::text,
      ((SELECT count(*) FROM public.gobd_responsibilities)::text || ' bestaetigte Zuordnungen')::text;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.gobd_procedure_docs d WHERE d.status = 'freigegeben')
    INTO v_ok;
  RETURN QUERY SELECT 'Dokumentation'::text, 'Verfahrensdokumentation vorhanden',
    CASE WHEN v_ok THEN 'BESTANDEN' ELSE 'OFFEN' END::text,
    ((SELECT count(*) FROM public.gobd_procedure_docs)::text || ' Abschnitte')::text;

  RETURN QUERY SELECT 'Dokumentation'::text, 'Berechtigungsmatrix',
    CASE WHEN (SELECT count(*) FROM public.gobd_permission_matrix) > 0 THEN 'BESTANDEN' ELSE 'OFFEN' END::text,
    ((SELECT count(*) FROM public.gobd_permission_matrix)::text || ' Eintraege')::text;

  RETURN QUERY SELECT 'Nachweise'::text, 'Wiederherstellungstest',
    CASE WHEN EXISTS(SELECT 1 FROM public.gobd_restore_runs r WHERE r.status = 'passed')
      THEN 'BESTANDEN' ELSE 'OFFEN' END::text,
    coalesce((SELECT 'Lauf ' || left(r.id::text, 8) || ' am ' || to_char(r.finished_at,'DD.MM.YYYY')
              FROM public.gobd_restore_runs r WHERE r.status='passed'
              ORDER BY r.finished_at DESC LIMIT 1), 'Kein bestandener Lauf')::text;
END;
$$;

-- Abschlussbericht erzeugen (unveraenderbar)
CREATE OR REPLACE FUNCTION public.gobd_generate_final_report()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tech jsonb;
  v_org jsonb;
  v_tech_status text;
  v_org_status text;
  v_status text;
  v_version integer;
  v_payload jsonb;
  v_id uuid;
  v_number text;
BEGIN
  IF NOT (public.has_role('Super Admin') OR public.has_role('Admin')) THEN
    RAISE EXCEPTION 'Keine Berechtigung fuer den GoBD-Abschlussbericht';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_tech
  FROM public.gobd_compliance_check() t;

  SELECT coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) INTO v_org
  FROM public.gobd_org_status() o;

  v_tech_status := CASE
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_tech) e WHERE e->>'status' = 'FEHLER') THEN 'FEHLER'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_tech) e WHERE e->>'status' IN ('WARNUNG','OFFEN')) THEN 'WARNUNG'
    ELSE 'BESTANDEN' END;

  v_org_status := CASE
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_org) e WHERE e->>'status' = 'FEHLER') THEN 'FEHLER'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_org) e WHERE e->>'status' IN ('WARNUNG','OFFEN')) THEN 'OFFEN'
    ELSE 'BESTANDEN' END;

  v_status := CASE
    WHEN v_tech_status = 'FEHLER' OR v_org_status = 'FEHLER' THEN 'NICHT FREIGEGEBEN'
    WHEN v_org_status <> 'BESTANDEN' THEN 'TECHNISCH BESTANDEN - ORGANISATORISCHER ABSCHLUSS LAEUFT'
    WHEN v_tech_status = 'WARNUNG' THEN 'FREIGEGEBEN MIT AUFLAGEN'
    WHEN EXISTS (SELECT 1 FROM public.gobd_approvals a
                 WHERE a.subject = 'gesamtfreigabe' AND a.decision = 'freigegeben') THEN 'FREIGEGEBEN'
    ELSE 'ABSCHLUSSFREIGABE AUSSTEHEND' END;

  SELECT coalesce(max(version), 0) + 1 INTO v_version FROM public.gobd_final_reports;
  v_number := 'GOBD-' || to_char(now(), 'YYYY') || '-' || lpad(v_version::text, 3, '0');

  v_payload := jsonb_build_object(
    'generated_at', now(),
    'report_number', v_number,
    'technical', v_tech,
    'organizational', v_org,
    'approvals', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.approved_at DESC)
                           FROM public.gobd_approvals a), '[]'::jsonb),
    'responsibilities', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.area)
                                  FROM public.gobd_responsibilities r), '[]'::jsonb),
    'facts', jsonb_build_object(
      'invoices', (SELECT count(*) FROM public.zoho_invoices),
      'legal_numbers', (SELECT count(*) FROM public.zoho_invoices WHERE legal_invoice_number IS NOT NULL),
      'audit_logs', (SELECT count(*) FROM public.audit_logs),
      'procedure_sections', (SELECT count(*) FROM public.gobd_procedure_docs),
      'permission_entries', (SELECT count(*) FROM public.gobd_permission_matrix),
      'data_classes', (SELECT count(*) FROM public.gobd_data_classes),
      'restore_runs_passed', (SELECT count(*) FROM public.gobd_restore_runs WHERE status = 'passed')
    )
  );

  INSERT INTO public.gobd_final_reports
    (report_number, version, status, technical_status, organizational_status, payload, content_hash, created_by)
  VALUES (v_number, v_version, v_status, v_tech_status, v_org_status, v_payload,
          encode(digest(v_payload::text, 'sha256'), 'hex'), auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;