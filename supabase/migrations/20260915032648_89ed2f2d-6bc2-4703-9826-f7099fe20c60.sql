
CREATE OR REPLACE FUNCTION public.gobd_restore_legal_hold_test(_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv uuid; ok boolean := false; ok2 boolean := false; msg text; msg2 text; v_claims text;
BEGIN
  PERFORM public.gobd_restore_guard();
  v_claims := coalesce(current_setting('request.jwt.claims', true), '');

  SELECT id INTO v_inv FROM gobd_restore.zoho_invoices LIMIT 1;

  -- Aufbewahrungssperre ausschliesslich in der isolierten Testumgebung
  CREATE TABLE IF NOT EXISTS gobd_restore.gobd_legal_holds (LIKE public.gobd_legal_holds INCLUDING DEFAULTS);
  ALTER TABLE gobd_restore.gobd_legal_holds ALTER COLUMN id SET DEFAULT gen_random_uuid();

  EXECUTE $f$
    CREATE OR REPLACE FUNCTION gobd_restore.hold_guard() RETURNS trigger
    LANGUAGE plpgsql AS $g$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF EXISTS (SELECT 1 FROM gobd_restore.gobd_legal_holds h
                   WHERE h.status = 'active' AND h.scope_table = TG_TABLE_NAME
                     AND h.scope_record_id = OLD.id) THEN
          RAISE EXCEPTION 'GoBD: Loeschung durch aktive Aufbewahrungssperre (Legal Hold) untersagt';
        END IF;
        RETURN OLD;
      END IF;
      IF OLD.status = 'active' AND NEW.status <> 'active'
         AND NOT (public.has_role('Super Admin') OR public.has_role('Buchhaltung Admin')) THEN
        RAISE EXCEPTION 'GoBD: Aufhebung einer Aufbewahrungssperre erfordert die Rolle Super Admin oder Buchhaltung Admin';
      END IF;
      RETURN NEW;
    END $g$;
  $f$;

  DROP TRIGGER IF EXISTS trg_hold_inv ON gobd_restore.zoho_invoices;
  CREATE TRIGGER trg_hold_inv BEFORE DELETE ON gobd_restore.zoho_invoices
    FOR EACH ROW EXECUTE FUNCTION gobd_restore.hold_guard();
  DROP TRIGGER IF EXISTS trg_hold_rel ON gobd_restore.gobd_legal_holds;
  CREATE TRIGGER trg_hold_rel BEFORE UPDATE ON gobd_restore.gobd_legal_holds
    FOR EACH ROW EXECUTE FUNCTION gobd_restore.hold_guard();

  INSERT INTO gobd_restore.gobd_legal_holds(id, reason_category, reason, reference, responsible,
    scope_type, scope_table, scope_record_id, status)
  VALUES (gen_random_uuid(), 'interne_untersuchung', 'Phase 15 Restore-Test (isoliert)',
    'PHASE15-' || _run_id, 'System (GoBD Phase 15)', 'record', 'zoho_invoices', v_inv, 'active');

  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  BEGIN
    EXECUTE 'DELETE FROM gobd_restore.zoho_invoices WHERE id = $1' USING v_inv;
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;

  BEGIN
    EXECUTE 'UPDATE gobd_restore.gobd_legal_holds SET status = ''released'' WHERE status = ''active''';
  EXCEPTION WHEN others THEN ok2 := true; msg2 := SQLERRM; END;
  PERFORM set_config('request.jwt.claims', v_claims, true);

  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Aktiven Legal Hold umgehen', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END,
          jsonb_build_object('fehler', msg, 'umgebung', 'gobd_restore (isoliert)')),
         (_run_id, '8 Schutz nach Restore', 'Legal Hold ohne Berechtigung aufheben', 'MUSS SCHEITERN',
          CASE WHEN ok2 THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok2 THEN 'BESTANDEN' ELSE 'FEHLER' END,
          jsonb_build_object('fehler', msg2, 'umgebung', 'gobd_restore (isoliert)'));
END; $$;

REVOKE EXECUTE ON FUNCTION public.gobd_restore_legal_hold_test(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_restore_legal_hold_test(uuid) TO service_role;
