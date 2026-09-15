
CREATE OR REPLACE FUNCTION public.gobd_restore_legal_hold_test(_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv uuid; v_hold uuid; ok boolean := false; msg text; v_claims text;
BEGIN
  PERFORM public.gobd_restore_guard();
  v_claims := coalesce(current_setting('request.jwt.claims', true), '');
  SELECT id INTO v_inv FROM gobd_restore.zoho_invoices WHERE NOT public.gobd_invoice_is_final(status) LIMIT 1;
  IF v_inv IS NULL THEN SELECT id INTO v_inv FROM gobd_restore.zoho_invoices LIMIT 1; END IF;

  INSERT INTO public.gobd_legal_holds(reason_category, reason, reference, responsible, scope_type,
    scope_table, scope_record_id, status)
  VALUES ('interne_untersuchung', 'Phase 15 Restore-Test (technischer Nachweis)', 'PHASE15-' || _run_id,
    'System (GoBD Phase 15)', 'record', 'zoho_invoices', v_inv, 'active')
  RETURNING id INTO v_hold;

  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  BEGIN
    EXECUTE 'DELETE FROM gobd_restore.zoho_invoices WHERE id = $1' USING v_inv;
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  PERFORM set_config('request.jwt.claims', v_claims, true);

  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Aktiven Legal Hold umgehen', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END,
          jsonb_build_object('hold_id', v_hold, 'fehler', msg));

  UPDATE public.gobd_legal_holds
     SET status = 'released', released_at = now(),
         release_reason = 'Technischer Restore-Test Phase 15 abgeschlossen'
   WHERE id = v_hold;
END; $$;

REVOKE EXECUTE ON FUNCTION public.gobd_restore_legal_hold_test(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_restore_legal_hold_test(uuid) TO service_role;
