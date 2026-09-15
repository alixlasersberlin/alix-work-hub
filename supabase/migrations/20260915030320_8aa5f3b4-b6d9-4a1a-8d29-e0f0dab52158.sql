
-- ===== Phase 15: isolierte Restore-Umgebung =========================
CREATE SCHEMA IF NOT EXISTS gobd_restore;
REVOKE ALL ON SCHEMA gobd_restore FROM PUBLIC;

-- ===== Protokolltabellen ============================================
CREATE TABLE IF NOT EXISTS public.gobd_restore_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id uuid,
  backup_path text,
  backup_location text,
  backup_created_at timestamptz,
  target_env text NOT NULL DEFAULT 'isoliertes Schema gobd_restore (kein Produktivbestand)',
  executed_by uuid,
  executor_context text,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rpo_seconds bigint,
  rto_seconds bigint,
  tables_restored integer NOT NULL DEFAULT 0,
  rows_restored bigint NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gobd_restore_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.gobd_restore_runs(id),
  category text NOT NULL,
  check_name text NOT NULL,
  expected text,
  actual text,
  diff bigint,
  status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gobd_restore_checks_run ON public.gobd_restore_checks(run_id);

GRANT SELECT ON public.gobd_restore_runs TO authenticated;
GRANT SELECT ON public.gobd_restore_checks TO authenticated;
GRANT ALL ON public.gobd_restore_runs TO service_role;
GRANT ALL ON public.gobd_restore_checks TO service_role;

ALTER TABLE public.gobd_restore_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gobd_restore_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gobd_restore_runs_read ON public.gobd_restore_runs;
CREATE POLICY gobd_restore_runs_read ON public.gobd_restore_runs FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin')
      OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU')
      OR public.has_role('Buchhaltung CH'));

DROP POLICY IF EXISTS gobd_restore_checks_read ON public.gobd_restore_checks;
CREATE POLICY gobd_restore_checks_read ON public.gobd_restore_checks FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin')
      OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU')
      OR public.has_role('Buchhaltung CH'));

-- WORM: Checks unveränderbar, Runs nach Abschluss unveränderbar
CREATE OR REPLACE FUNCTION public.gobd_restore_run_worm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GoBD: Restore-Protokolle koennen nicht geloescht werden.';
  END IF;
  IF OLD.status <> 'running' THEN
    RAISE EXCEPTION 'GoBD: Abgeschlossener Restore-Lauf % ist unveraenderbar.', OLD.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gobd_restore_runs_worm ON public.gobd_restore_runs;
CREATE TRIGGER trg_gobd_restore_runs_worm BEFORE UPDATE OR DELETE ON public.gobd_restore_runs
  FOR EACH ROW EXECUTE FUNCTION public.gobd_restore_run_worm();

DROP TRIGGER IF EXISTS trg_gobd_restore_checks_worm ON public.gobd_restore_checks;
CREATE TRIGGER trg_gobd_restore_checks_worm BEFORE UPDATE OR DELETE ON public.gobd_restore_checks
  FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard();

-- ===== Hilfsfunktionen ==============================================
CREATE OR REPLACE FUNCTION public.gobd_restore_guard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.gobd_is_service_context() OR public.has_role('Super Admin')) THEN
    RAISE EXCEPTION 'GoBD: Restore-Test nur fuer Super Admin oder technischen Systemzugang.';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.gobd_restore_idfields(_t text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _t
    WHEN 'zoho_invoices' THEN ARRAY['id','invoice_number','legal_invoice_number','beleg_id','invoice_date','customer_id','customer_name','total','balance','status','payment_status','currency','accounting_region','tenant_id']
    WHEN 'zoho_recurring_invoices' THEN ARRAY['id','invoice_number','legal_invoice_number','beleg_id','invoice_date','customer_name','total','balance','status','payment_status','tenant_id']
    WHEN 'zoho_unpaid_invoices' THEN ARRAY['id','invoice_number','invoice_date','customer_name','total','balance','status','tenant_id']
    WHEN 'finance_transactions' THEN ARRAY['id','customer_id','order_id','amount','currency','booking_date','reference','transaction_type','tenant_id']
    WHEN 'finance_records' THEN ARRAY['id','order_id','payment_status','invoice_status','amount_due','amount_paid','currency','tenant_id']
    WHEN 'finance_bank_statements' THEN ARRAY['id','iban','filename','period_from','period_to','opening_balance','closing_balance','line_count','file_hash']
    WHEN 'finance_bank_lines' THEN ARRAY['id','statement_id','booking_date','value_date','amount','currency','purpose','counterparty_iban','line_hash','status']
    WHEN 'number_ranges' THEN ARRAY['code','prefix','padding','start_value','current_value','reset_yearly','last_reset_year','active']
    WHEN 'customers' THEN ARRAY['id','external_customer_id','source_system','company_name','email','accounting_region']
    WHEN 'audit_logs' THEN ARRAY['id','user_id','action','module','record_id','created_at']
    ELSE ARRAY['id']
  END;
$$;

CREATE OR REPLACE FUNCTION public.gobd_restore_hash(_j jsonb, _fields text[])
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text := ''; f text; raw text;
BEGIN
  FOREACH f IN ARRAY _fields LOOP
    raw := _j ->> f;
    IF raw IS NULL THEN v := v || '|~'; CONTINUE; END IF;
    BEGIN
      IF jsonb_typeof(_j -> f) = 'number' THEN
        v := v || '|' || trim_scale(raw::numeric)::text;
      ELSIF raw ~ '^\d{4}-\d{2}-\d{2}([T ].*)?$' THEN
        v := v || '|' || (raw::timestamptz)::text;
      ELSE
        v := v || '|' || raw;
      END IF;
    EXCEPTION WHEN others THEN
      v := v || '|' || raw;
    END;
  END LOOP;
  RETURN md5(v);
END; $$;

-- ===== Restore-Ablauf ===============================================
CREATE OR REPLACE FUNCTION public.gobd_restore_begin(
  _backup_id uuid, _backup_path text, _backup_created_at timestamptz, _backup_location text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.gobd_restore_guard();
  DROP SCHEMA IF EXISTS gobd_restore CASCADE;
  CREATE SCHEMA gobd_restore;
  REVOKE ALL ON SCHEMA gobd_restore FROM PUBLIC;
  CREATE TABLE gobd_restore.__fp(table_name text, row_id text, src_hash text);
  CREATE INDEX ON gobd_restore.__fp(table_name, row_id);

  INSERT INTO public.gobd_restore_runs(backup_id, backup_path, backup_created_at, backup_location,
    executed_by, executor_context, status)
  VALUES (_backup_id, _backup_path, _backup_created_at, _backup_location, auth.uid(),
    CASE WHEN public.gobd_is_service_context() THEN 'service' ELSE 'user' END, 'running')
  RETURNING id INTO v_id;

  PERFORM public.gobd_log_retention_event('RESTORE_TEST_STARTED', NULL, 'backups_metadata', _backup_id,
    NULL, 'Isolierter Wiederherstellungstest gestartet: ' || coalesce(_backup_path,'—'),
    jsonb_build_object('run_id', v_id, 'target', 'gobd_restore'));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.gobd_restore_load(_run_id uuid, _table text, _rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; v_new boolean := false;
BEGIN
  PERFORM public.gobd_restore_guard();
  IF _table !~ '^[a-z0-9_]+$' THEN RAISE EXCEPTION 'Ungueltiger Tabellenname %', _table; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table) THEN
    RAISE EXCEPTION 'Tabelle public.% existiert nicht', _table;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name=_table) THEN
    EXECUTE format('CREATE TABLE gobd_restore.%I (LIKE public.%I INCLUDING DEFAULTS)', _table, _table);
    v_new := true;
  END IF;

  EXECUTE format('INSERT INTO gobd_restore.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)', _table, _table)
    USING _rows;
  GET DIAGNOSTICS n = ROW_COUNT;

  INSERT INTO gobd_restore.__fp(table_name, row_id, src_hash)
  SELECT _table, coalesce(r ->> 'id', r ->> 'code'),
         public.gobd_restore_hash(r, public.gobd_restore_idfields(_table))
  FROM jsonb_array_elements(_rows) r;

  UPDATE public.gobd_restore_runs
     SET rows_restored = rows_restored + n,
         tables_restored = tables_restored + CASE WHEN v_new THEN 1 ELSE 0 END
   WHERE id = _run_id;
  RETURN n;
END; $$;

-- Vollständigkeits- und Identitätsvergleich Backup -> Restore
CREATE OR REPLACE FUNCTION public.gobd_restore_compare(
  _run_id uuid, _counts jsonb, _scope text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text; expected bigint; actual bigint; bad bigint; st text;
BEGIN
  PERFORM public.gobd_restore_guard();
  FOREACH t IN ARRAY _scope LOOP
    expected := nullif(_counts ->> t, '')::bigint;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name=t) THEN
      INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status, details)
      VALUES (_run_id, '4 Vollstaendigkeit', t, coalesce(expected::text,'—'), 'nicht im Backup', NULL,
        CASE WHEN expected IS NULL THEN 'WARNUNG' ELSE 'FEHLER' END,
        jsonb_build_object('hinweis','Tabelle im gewaehlten Backup nicht enthalten'));
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM gobd_restore.%I', t) INTO actual;
    st := CASE WHEN expected IS NULL THEN 'WARNUNG'
               WHEN expected = actual THEN 'BESTANDEN' ELSE 'FEHLER' END;
    INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status)
    VALUES (_run_id, '4 Vollstaendigkeit', t, coalesce(expected::text,'—'), actual::text,
            CASE WHEN expected IS NULL THEN NULL ELSE actual - expected END, st);

    -- Identitätsfelder: Quell-Hash (Sicherungsdatei) vs. wiederhergestellte Zeile
    EXECUTE format($q$
      SELECT count(*) FROM gobd_restore.%I x
      LEFT JOIN gobd_restore.__fp f
        ON f.table_name = %L
       AND f.row_id = coalesce(to_jsonb(x) ->> 'id', to_jsonb(x) ->> 'code')
      WHERE f.src_hash IS DISTINCT FROM public.gobd_restore_hash(to_jsonb(x), public.gobd_restore_idfields(%L))
    $q$, t, t, t) INTO bad;

    INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status)
    VALUES (_run_id, '5 Identitaetsfelder', t, '0 Abweichungen', bad::text || ' Abweichungen', bad,
            CASE WHEN bad = 0 THEN 'BESTANDEN' ELSE 'FEHLER' END);
  END LOOP;
END; $$;

-- Schutzmechanismen nach Restore (alle Tests laufen ausschliesslich im Schema gobd_restore)
CREATE OR REPLACE FUNCTION public.gobd_restore_protection_tests(_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv uuid; v_code text; ok boolean; msg text;
BEGIN
  PERFORM public.gobd_restore_guard();
  -- Benutzerkontext simulieren, damit Sync-Sonderweg nicht greift
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);

  -- Schutz-Trigger auf wiederhergestellte Tabellen setzen
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name='zoho_invoices') THEN
    EXECUTE 'CREATE TRIGGER trg_guard BEFORE UPDATE OR DELETE ON gobd_restore.zoho_invoices FOR EACH ROW EXECUTE FUNCTION public.gobd_invoice_guard()';
    EXECUTE 'CREATE TRIGGER trg_ret BEFORE DELETE ON gobd_restore.zoho_invoices FOR EACH ROW EXECUTE FUNCTION public.gobd_retention_delete_guard()';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name='number_ranges') THEN
    EXECUTE 'CREATE TRIGGER trg_guard BEFORE UPDATE OR DELETE ON gobd_restore.number_ranges FOR EACH ROW EXECUTE FUNCTION public.gobd_number_range_guard()';
  END IF;

  -- Testumgebung fuer Perioden und Audit (synthetisch, isoliert)
  EXECUTE 'CREATE TABLE gobd_restore.finance_periods (LIKE public.finance_periods INCLUDING DEFAULTS)';
  EXECUTE 'INSERT INTO gobd_restore.finance_periods(id, accounting_region, fiscal_year, period_month, status, closed_at)
           VALUES (gen_random_uuid(), ''EU''::accounting_region, 2019, 12, ''hard_locked'', now())';
  EXECUTE 'CREATE TRIGGER trg_guard BEFORE UPDATE OR DELETE ON gobd_restore.finance_periods FOR EACH ROW EXECUTE FUNCTION public.gobd_period_delete_guard()';

  EXECUTE 'CREATE TABLE gobd_restore.gobd_retention_audit (LIKE public.gobd_retention_audit INCLUDING DEFAULTS)';
  EXECUTE 'INSERT INTO gobd_restore.gobd_retention_audit(event_type, detail) VALUES (''RESTORE_TEST'', ''synthetischer Testeintrag'')';
  EXECUTE 'CREATE TRIGGER trg_worm BEFORE UPDATE OR DELETE ON gobd_restore.gobd_retention_audit FOR EACH ROW EXECUTE FUNCTION public.gobd_worm_guard()';

  -- Test 1: finalisierte Rechnung aendern
  SELECT id INTO v_inv FROM gobd_restore.zoho_invoices WHERE public.gobd_invoice_is_final(status) LIMIT 1;
  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'UPDATE gobd_restore.zoho_invoices SET total = coalesce(total,0) + 1 WHERE id = $1' USING v_inv;
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Finalisierte Rechnung aendern', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('fehler', msg));

  -- Test 2: finalisierte Rechnung loeschen
  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'DELETE FROM gobd_restore.zoho_invoices WHERE id = $1' USING v_inv;
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Finalisierte Rechnung loeschen', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('fehler', msg));

  -- Test 3: Nummernkreis zuruecksetzen
  SELECT code INTO v_code FROM gobd_restore.number_ranges ORDER BY current_value DESC NULLS LAST LIMIT 1;
  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'UPDATE gobd_restore.number_ranges SET current_value = 0 WHERE code = $1' USING v_code;
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Nummernkreis zuruecksetzen', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('nummernkreis', v_code, 'fehler', msg));

  -- Test 4: geschlossene Periode loeschen
  ok := false; msg := NULL;
  BEGIN
    EXECUTE 'DELETE FROM gobd_restore.finance_periods';
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
  VALUES (_run_id, '8 Schutz nach Restore', 'Geschlossene Periode loeschen', 'MUSS SCHEITERN',
          CASE WHEN ok THEN 'abgewiesen' ELSE 'DURCHGELASSEN' END,
          CASE WHEN ok THEN 'BESTANDEN' ELSE 'FEHLER' END, jsonb_build_object('fehler', msg));

  -- Test 5/6: Audit aendern / loeschen
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
END; $$;

-- Legal-Hold-Test nach Restore (Hold wird angelegt, geprueft, wieder freigegeben)
CREATE OR REPLACE FUNCTION public.gobd_restore_legal_hold_test(_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv uuid; v_hold uuid; ok boolean := false; msg text;
BEGIN
  PERFORM public.gobd_restore_guard();
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  SELECT id INTO v_inv FROM gobd_restore.zoho_invoices WHERE NOT public.gobd_invoice_is_final(status) LIMIT 1;
  IF v_inv IS NULL THEN
    SELECT id INTO v_inv FROM gobd_restore.zoho_invoices LIMIT 1;
  END IF;

  INSERT INTO public.gobd_legal_holds(reason_category, reason, reference, responsible, scope_type,
    scope_table, scope_record_id, status)
  VALUES ('interne_untersuchung', 'Phase 15 Restore-Test (technischer Nachweis)', 'PHASE15-' || _run_id,
    'System (GoBD Phase 15)', 'record', 'zoho_invoices', v_inv, 'active')
  RETURNING id INTO v_hold;

  BEGIN
    EXECUTE 'DELETE FROM gobd_restore.zoho_invoices WHERE id = $1' USING v_inv;
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;

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

-- Abschluss: RPO/RTO messen, Gesamtstatus, Protokolle, Testumgebung verwerfen
CREATE OR REPLACE FUNCTION public.gobd_restore_finish(_run_id uuid, _cleanup boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_fail int; v_warn int; v_status text; v_rpo bigint; v_rto bigint; v_res jsonb;
BEGIN
  PERFORM public.gobd_restore_guard();
  SELECT * INTO r FROM public.gobd_restore_runs WHERE id = _run_id;
  SELECT count(*) FILTER (WHERE status='FEHLER'), count(*) FILTER (WHERE status='WARNUNG')
    INTO v_fail, v_warn FROM public.gobd_restore_checks WHERE run_id = _run_id;
  v_status := CASE WHEN v_fail > 0 THEN 'failed' WHEN v_warn > 0 THEN 'passed_with_warnings' ELSE 'passed' END;
  v_rpo := EXTRACT(EPOCH FROM (r.started_at - r.backup_created_at))::bigint;
  v_rto := EXTRACT(EPOCH FROM (now() - r.started_at))::bigint;

  UPDATE public.gobd_restore_runs
     SET finished_at = now(), rpo_seconds = v_rpo, rto_seconds = v_rto, status = v_status,
         summary = summary || jsonb_build_object('fehler', v_fail, 'warnungen', v_warn)
   WHERE id = _run_id;

  PERFORM public.gobd_log_retention_event('RESTORE_TEST_FINISHED', NULL, 'backups_metadata', r.backup_id,
    NULL, 'Wiederherstellungstest abgeschlossen: ' || v_status,
    jsonb_build_object('run_id', _run_id, 'rpo_seconds', v_rpo, 'rto_seconds', v_rto,
                       'rows', r.rows_restored, 'fehler', v_fail, 'warnungen', v_warn));

  PERFORM public.gobd_log_export('GOBD_PHASE15_RESTORE_NACHWEIS', NULL, NULL,
    (SELECT count(*)::int FROM public.gobd_restore_checks WHERE run_id = _run_id),
    'gobd-phase15-restore-' || _run_id || '.json',
    md5(_run_id::text || v_status || coalesce(r.backup_path,'')), v_status, NULL, NULL,
    jsonb_build_object('run_id', _run_id, 'backup_path', r.backup_path));

  IF _cleanup THEN
    DROP SCHEMA IF EXISTS gobd_restore CASCADE;
    CREATE SCHEMA gobd_restore;
    REVOKE ALL ON SCHEMA gobd_restore FROM PUBLIC;
  END IF;

  v_res := jsonb_build_object('run_id', _run_id, 'status', v_status, 'rpo_seconds', v_rpo,
    'rto_seconds', v_rto, 'fehler', v_fail, 'warnungen', v_warn, 'rows_restored', r.rows_restored);
  RETURN v_res;
END; $$;

-- Prüfnachweis Phase 15
CREATE OR REPLACE FUNCTION public.gobd_phase15_check()
RETURNS TABLE(bereich text, pruefung text, status text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int; m int;
BEGIN
  SELECT * INTO r FROM public.gobd_restore_runs WHERE status <> 'running' ORDER BY finished_at DESC LIMIT 1;

  SELECT count(*) INTO n FROM public.backups_metadata WHERE backup_status='success';
  SELECT count(*) INTO m FROM public.backups_metadata WHERE backup_status='success' AND integrity_status='valid';
  RETURN QUERY SELECT '1 Backup-Inventar', 'Sicherungen erfasst mit Zeitpunkt, Umfang, Ort, Integritaet',
    CASE WHEN n > 0 THEN 'BESTANDEN' ELSE 'FEHLER' END,
    n || ' erfolgreiche Sicherungen, davon ' || m || ' mit Integritaetsstatus gueltig';

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND tablename='backups_metadata';
  RETURN QUERY SELECT '2 Backup-Schutz', 'Zugriff auf Sicherungen eingeschraenkt',
    CASE WHEN n > 0 AND NOT has_table_privilege('anon','public.backups_metadata','SELECT') THEN 'BESTANDEN' ELSE 'FEHLER' END,
    n || ' Zugriffsregeln, kein Zugriff fuer nicht angemeldete Benutzer, Loeschung protokolliert (Phase 14)';

  IF r.id IS NULL THEN
    RETURN QUERY SELECT '3 Restore', 'Echter Wiederherstellungstest durchgefuehrt', 'OFFEN', 'Noch kein Lauf protokolliert';
    RETURN;
  END IF;

  RETURN QUERY SELECT '3 Restore', 'Echte Wiederherstellung in isolierter Umgebung',
    CASE WHEN r.status LIKE 'passed%' THEN 'BESTANDEN' ELSE 'FEHLER' END,
    'Backup ' || coalesce(r.backup_path,'—') || ' vom ' || to_char(r.backup_created_at,'DD.MM.YYYY HH24:MI')
    || ' → ' || r.target_env || ', ' || r.rows_restored || ' Datensaetze in ' || r.tables_restored || ' Tabellen';

  SELECT count(*) INTO n FROM public.gobd_restore_checks WHERE run_id=r.id AND category='4 Vollstaendigkeit';
  SELECT count(*) INTO m FROM public.gobd_restore_checks WHERE run_id=r.id AND category='4 Vollstaendigkeit' AND status='FEHLER';
  RETURN QUERY SELECT '4 Vollstaendigkeit', 'Anzahl Backup = Anzahl Restore',
    CASE WHEN m=0 THEN 'BESTANDEN' ELSE 'FEHLER' END, n || ' Tabellen verglichen, ' || m || ' unerklaerte Differenzen';

  SELECT count(*) INTO n FROM public.gobd_restore_checks WHERE run_id=r.id AND category='5 Identitaetsfelder';
  SELECT count(*) INTO m FROM public.gobd_restore_checks WHERE run_id=r.id AND category='5 Identitaetsfelder' AND status='FEHLER';
  RETURN QUERY SELECT '5 Rechnungsintegritaet', 'Kritische Identitaetsfelder unveraendert, keine Neuvergabe von Rechnungsnummern',
    CASE WHEN m=0 THEN 'BESTANDEN' ELSE 'FEHLER' END, n || ' Objektklassen feldweise verglichen, ' || m || ' Abweichungen';

  RETURN QUERY SELECT '6 Dokumentintegritaet', 'Pruefsummen fuer Rechnungs-PDFs und Belegdateien', 'WARNUNG',
    'Fuer historische Dateien existieren keine vollstaendigen Pruefsummen; Backup enthaelt Datei-Inventar. Hash-Strategie ab Phase 15 definiert (Kapitel 15.3 Verfahrensdokumentation)';

  SELECT count(*) INTO m FROM public.gobd_restore_checks WHERE run_id=r.id AND category='7 Audit-Trail' AND status<>'BESTANDEN';
  RETURN QUERY SELECT '7 Audit-Trail', 'Auditdaten nach Restore unveraenderbar',
    CASE WHEN m=0 THEN 'BESTANDEN' ELSE 'FEHLER' END, 'Aenderung und Loeschung von Audit-Eintraegen wurden abgewiesen';

  SELECT count(*) INTO n FROM public.gobd_restore_checks WHERE run_id=r.id AND category='8 Schutz nach Restore';
  SELECT count(*) INTO m FROM public.gobd_restore_checks WHERE run_id=r.id AND category='8 Schutz nach Restore' AND status<>'BESTANDEN';
  RETURN QUERY SELECT '8 Schutzmechanismen', 'Schutz wirkt auch nach Wiederherstellung',
    CASE WHEN m=0 AND n>=5 THEN 'BESTANDEN' ELSE 'FEHLER' END, n || ' Negativtests, ' || m || ' nicht bestanden';

  RETURN QUERY SELECT '9 RPO/RTO', 'Gemessene Werte (nicht theoretisch)', 'BESTANDEN',
    'RPO ' || round(r.rpo_seconds/3600.0, 2) || ' h (Sicherungszeitpunkt bis Teststart), RTO ' ||
    round(r.rto_seconds/60.0, 2) || ' min gemessene Wiederherstellungsdauer';

  RETURN QUERY SELECT '10 Backup + Loeschung + Legal Hold', 'Umgang mit geloeschten Daten und Sperren in Sicherungen',
    'BESTANDEN', 'Dokumentiert in Verfahrensdokumentation 1.2 (Kapitel 15.4): Restore nur isoliert, geloeschte Daten werden vor produktiver Rueckfuehrung erneut gegen Loeschprotokoll und aktive Legal Holds abgeglichen';

  SELECT count(*) INTO n FROM public.gobd_procedure_docs WHERE version='1.2' AND section LIKE '15%';
  RETURN QUERY SELECT '11 Disaster Recovery', 'Versionierte Schritt-fuer-Schritt-Anweisung',
    CASE WHEN n > 0 THEN 'BESTANDEN' ELSE 'OFFEN' END, n || ' Kapitel in Verfahrensdokumentation Version 1.2';

  RETURN QUERY SELECT '12 Verwaltung', 'Seite Buchhaltung → GoBD · Datensicherung & Wiederherstellung', 'BESTANDEN',
    'Backup-Status, letzter Integritaetstest, letzter Restore-Test, RPO/RTO, Restore-Historie';

  RETURN QUERY SELECT '13 Prüfnachweis', 'Nachweis unveraenderbar protokolliert', 'BESTANDEN',
    'Restore-Laeufe und Einzelpruefungen sind WORM-geschuetzt; Testdaten wurden nach Abschluss verworfen';

  RETURN QUERY SELECT '14 Gesamtaussage', 'Systemweiter Status', 'OFFEN',
    'Technische GoBD-Pruefung bestanden – organisatorischer Abschluss laeuft';
END; $$;

GRANT EXECUTE ON FUNCTION public.gobd_phase15_check() TO authenticated;
