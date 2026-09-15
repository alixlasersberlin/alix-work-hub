
CREATE OR REPLACE FUNCTION public.gobd_restore_idfields(_t text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $function$
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
    WHEN 'finance_audit_trail' THEN ARRAY['id','created_at']
    WHEN 'invoice_audit_log' THEN ARRAY['id','created_at']
    WHEN 'invoice_corrections' THEN ARRAY['id','created_at']
    WHEN 'invoice_number_audit' THEN ARRAY['id','created_at']
    WHEN 'invoice_number_ranges' THEN ARRAY['period','start_value','digits','last_value','status']
    WHEN 'finance_periods' THEN ARRAY['id','status']
    WHEN 'bank_transactions' THEN ARRAY['id','amount','currency','booking_date','value_date','reference']
    WHEN 'bank_transaction_allocations' THEN ARRAY['id','amount']
    WHEN 'bank_imports' THEN ARRAY['id']
    WHEN 'gobd_legal_holds' THEN ARRAY['id','status','started_at']
    WHEN 'gobd_procedure_docs' THEN ARRAY['id','version','section','content_hash','status']
    WHEN 'gobd_export_log' THEN ARRAY['id','created_at']
    WHEN 'gobd_retention_audit' THEN ARRAY['id','created_at']
    WHEN 'gobd_sync_conflicts' THEN ARRAY['id','created_at']
    WHEN 'gobd_change_log' THEN ARRAY['id','created_at']
    ELSE ARRAY['id']
  END;
$function$;

-- Satzschluessel: technische ID, sonst fachlicher Schluessel, sonst Hash der Identitaetsfelder
CREATE OR REPLACE FUNCTION public.gobd_restore_rowid(_r jsonb, _t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT coalesce(_r ->> 'id', _r ->> 'code',
                  public.gobd_restore_hash(_r, public.gobd_restore_idfields(_t)));
$function$;

CREATE OR REPLACE FUNCTION public.gobd_restore_load(_run_id uuid, _table text, _rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE n integer := 0; v_new boolean := false; c record; v_missing text[];
BEGIN
  PERFORM public.gobd_restore_guard();
  PERFORM set_config('statement_timeout', '110s', true);
  IF _table !~ '^[a-z0-9_]+$' THEN RAISE EXCEPTION 'Ungueltiger Tabellenname %', _table; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table) THEN
    RAISE EXCEPTION 'Tabelle public.% existiert nicht', _table;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name=_table) THEN
    EXECUTE format('CREATE TABLE gobd_restore.%I (LIKE public.%I INCLUDING DEFAULTS)', _table, _table);
    FOR c IN SELECT column_name FROM information_schema.columns
             WHERE table_schema='gobd_restore' AND table_name=_table AND is_nullable='NO' LOOP
      EXECUTE format('ALTER TABLE gobd_restore.%I ALTER COLUMN %I DROP NOT NULL', _table, c.column_name);
    END LOOP;

    SELECT array_agg(column_name ORDER BY column_name) INTO v_missing
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name=_table
       AND NOT (_rows -> 0) ? column_name;
    IF v_missing IS NOT NULL THEN
      INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, status, details)
      VALUES (_run_id, '3 Schema-Abweichung', _table, 'Sicherung enthaelt alle heutigen Felder',
              array_length(v_missing,1) || ' Feld(er) in der Sicherung nicht enthalten', 'WARNUNG',
              jsonb_build_object('felder', to_jsonb(v_missing),
                'hinweis','Spalten wurden nach dem Sicherungszeitpunkt ergaenzt'));
    END IF;
    v_new := true;
  END IF;

  EXECUTE format('INSERT INTO gobd_restore.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)', _table, _table)
    USING _rows;
  GET DIAGNOSTICS n = ROW_COUNT;

  INSERT INTO gobd_restore.__fp(table_name, row_id, src_hash, full_hash, key_list)
  SELECT _table, public.gobd_restore_rowid(r, _table),
         public.gobd_restore_hash(r, public.gobd_restore_idfields(_table)),
         public.gobd_restore_hash(r, k.keys),
         k.keys
  FROM jsonb_array_elements(_rows) r
  CROSS JOIN LATERAL (
    SELECT array_agg(key ORDER BY key) AS keys FROM jsonb_object_keys(r) AS key
  ) k;

  UPDATE public.gobd_restore_runs
     SET rows_restored = rows_restored + n,
         tables_restored = tables_restored + CASE WHEN v_new THEN 1 ELSE 0 END
   WHERE id = _run_id;
  RETURN n;
END; $function$;

CREATE OR REPLACE FUNCTION public.gobd_restore_compare(_run_id uuid, _counts jsonb, _scope text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text; expected bigint; actual bigint; bad bigint; st text; appendonly boolean; det jsonb;
BEGIN
  PERFORM public.gobd_restore_guard();
  PERFORM set_config('statement_timeout', '110s', true);
  FOREACH t IN ARRAY _scope LOOP
    expected := nullif(_counts ->> t, '')::bigint;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name=t) THEN
      INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status, details)
      VALUES (_run_id, '4 Vollstaendigkeit', t, coalesce(expected::text,'—'),
        CASE WHEN expected = 0 THEN '0' ELSE 'nicht im Backup' END,
        CASE WHEN expected = 0 THEN 0 ELSE NULL END,
        CASE WHEN expected = 0 THEN 'BESTANDEN' WHEN expected IS NULL THEN 'WARNUNG' ELSE 'FEHLER' END,
        jsonb_build_object('hinweis', CASE WHEN expected = 0
          THEN 'Tabelle war zum Sicherungszeitpunkt leer'
          ELSE 'Tabelle im gewaehlten Backup nicht enthalten' END));
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM gobd_restore.%I', t) INTO actual;
    appendonly := t IN ('audit_logs','finance_audit_trail','invoice_audit_log','invoice_number_audit',
                        'gobd_export_log','gobd_retention_audit','gobd_sync_conflicts','gobd_change_log',
                        'bank_audit_log');
    det := '{}'::jsonb;
    IF expected IS NULL THEN st := 'WARNUNG';
    ELSIF expected = actual THEN st := 'BESTANDEN';
    ELSIF appendonly AND actual > expected THEN
      st := 'WARNUNG';
      det := jsonb_build_object('hinweis',
        'Reine Protokolltabelle: waehrend der laufenden Sicherung sind weitere Eintraege hinzugekommen; '
        || 'alle zum Startzeitpunkt vorhandenen Eintraege sind enthalten');
    ELSE st := 'FEHLER';
    END IF;
    INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status, details)
    VALUES (_run_id, '4 Vollstaendigkeit', t, coalesce(expected::text,'—'), actual::text,
            CASE WHEN expected IS NULL THEN NULL ELSE actual - expected END, st, det);

    EXECUTE format($q$
      SELECT count(*) FROM gobd_restore.%I x
      LEFT JOIN gobd_restore.__fp f
        ON f.table_name = %L
       AND f.row_id = public.gobd_restore_rowid(to_jsonb(x), %L)
      WHERE f.src_hash IS DISTINCT FROM public.gobd_restore_hash(to_jsonb(x), public.gobd_restore_idfields(%L))
    $q$, t, t, t, t) INTO bad;

    INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status)
    VALUES (_run_id, '5 Identitaetsfelder', t, '0 Abweichungen', bad::text || ' Abweichungen', bad,
            CASE WHEN bad = 0 THEN 'BESTANDEN' ELSE 'FEHLER' END);
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.gobd_restore_content_check(_run_id uuid, _scope text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text; bad bigint; total bigint;
BEGIN
  PERFORM public.gobd_restore_guard();
  PERFORM set_config('statement_timeout', '110s', true);
  FOREACH t IN ARRAY _scope LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name=t) THEN
      CONTINUE;
    END IF;
    EXECUTE format($q$
      SELECT count(*), count(*) FILTER (
        WHERE f.full_hash IS DISTINCT FROM public.gobd_restore_hash(to_jsonb(x), f.key_list))
      FROM gobd_restore.%I x
      JOIN gobd_restore.__fp f
        ON f.table_name = %L
       AND f.row_id = public.gobd_restore_rowid(to_jsonb(x), %L)
    $q$, t, t, t) INTO total, bad;

    INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status, details)
    VALUES (_run_id, '6 Inhaltsgleichheit', t, '0 inhaltliche Abweichungen',
            bad::text || ' von ' || total::text || ' Datensaetzen abweichend', bad,
            CASE WHEN bad = 0 THEN 'BESTANDEN' ELSE 'FEHLER' END,
            jsonb_build_object('verfahren','md5 je Datensatz ueber alle in der Sicherung enthaltenen Felder'));
  END LOOP;
END; $$;

REVOKE EXECUTE ON FUNCTION public.gobd_restore_rowid(jsonb, text) FROM PUBLIC, anon;
