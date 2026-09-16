CREATE OR REPLACE FUNCTION public.gobd_generate_final_report()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          encode(sha256(convert_to(v_payload::text, 'UTF8')), 'hex'), auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;