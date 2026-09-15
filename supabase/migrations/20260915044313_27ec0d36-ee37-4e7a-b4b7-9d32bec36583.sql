
CREATE OR REPLACE FUNCTION public.gobd_restore_protection_tests(_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_inv uuid; v_code text; ok boolean; msg text;
BEGIN
  PERFORM public.gobd_restore_guard();
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  PERFORM set_config('statement_timeout', '110s', true);

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name='zoho_invoices') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_guard' AND tgrelid='gobd_restore.zoho_invoices'::regclass) THEN
      EXECUTE 'CREATE TRIGGER trg_guard BEFORE UPDATE OR DELETE ON gobd_restore.zoho_invoices FOR EACH ROW EXECUTE FUNCTION public.gobd_invoice_guard()';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ret' AND tgrelid='gobd_restore.zoho_invoices'::regclass) THEN
      EXECUTE 'CREATE TRIGGER trg_ret BEFORE DELETE ON gobd_restore.zoho_invoices FOR EACH ROW EXECUTE FUNCTION public.gobd_retention_delete_guard()';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name='number_ranges') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_guard' AND tgrelid='gobd_restore.number_ranges'::regclass) THEN
      EXECUTE 'CREATE TRIGGER trg_guard BEFORE UPDATE OR DELETE ON gobd_restore.number_ranges FOR EACH ROW EXECUTE FUNCTION public.gobd_number_range_guard()';
    END IF;
  END IF;

  -- Perioden: wiederhergestellte Tabelle nutzen, sonst synthetisch anlegen
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name='finance_periods') THEN
    EXECUTE 'CREATE TABLE gobd_restore.finance_periods (LIKE public.finance_periods INCLUDING DEFAULTS)';
  END IF;
  EXECUTE 'INSERT INTO gobd_restore.finance_periods(id, accounting_region, fiscal_year, period_month, status, closed_at)
           VALUES (gen_random_uuid(), ''EU''::accounting_region, 2019, 12, ''hard_locked'', now())';
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_guard' AND tgrelid='gobd_restore.finance_periods'::regclass) THEN
    EXECUTE 'CREATE TRIGGER trg_guard BEFORE UPDATE OR DELETE ON gobd_restore.finance_periods FOR EACH ROW EXECUTE FUNCTION public.gobd_period_delete_guard()';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name='gobd_retention_audit') THEN
    EXECUTE 'CREATE TABLE gobd_restore.gobd_retention_audit (LIKE public.gobd_retention_audit INCLUDING DEFAULTS)';
  END IF;
  EXECUTE 'INSERT INTO gobd_restore.gobd_retention_audit(event_type, detail) VALUES (''RESTORE_TEST'', ''synthetischer Testeintrag'')';
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_worm' AND tgrelid='gobd_restore.gobd_retention_audit'::regclass) THEN
    EXECUTE 'CREATE TRIGGER trg_worm BEFORE UPDATE OR DELETE ON gobd_restore.gobd_retention_audit FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard()';
  END IF;

  SELECT id INTO v_inv FROM gobd_restore.zoho_invoices WHERE public.gobd_invoice_is_final(status) LIMIT 1;
  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'UPDATE gobd_restore.zoho_invoices SET total = coalesce(total,0) + 1 WHERE id = $1' USING v_inv;
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Finalisierte Rechnung aendern', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('fehler', msg));

  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'DELETE FROM gobd_restore.zoho_invoices WHERE id = $1' USING v_inv;
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Finalisierte Rechnung loeschen', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('fehler', msg));

  SELECT code INTO v_code FROM gobd_restore.number_ranges ORDER BY current_value DESC NULLS LAST LIMIT 1;
  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'UPDATE gobd_restore.number_ranges SET current_value = 0 WHERE code = $1' USING v_code;
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Nummernkreis zuruecksetzen', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('nummernkreis', v_code, 'fehler', msg));

  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'DELETE FROM gobd_restore.finance_periods';
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Geschlossene Periode loeschen', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('fehler', msg));

  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'UPDATE gobd_restore.gobd_retention_audit SET detail = ''manipuliert''';
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '7 Audit-Trail', 'Audit-Eintrag aendern', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('fehler', msg));

  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'DELETE FROM gobd_restore.gobd_retention_audit';
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '7 Audit-Trail', 'Audit-Eintrag loeschen', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('fehler', msg));
END; $function$;
