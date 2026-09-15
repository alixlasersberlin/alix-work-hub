
CREATE OR REPLACE FUNCTION public.gobd_restore_compare(_run_id uuid, _counts jsonb, _scope text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text; expected bigint; actual bigint; bad bigint; st text;
BEGIN
  PERFORM public.gobd_restore_guard();
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
    st := CASE WHEN expected IS NULL THEN 'WARNUNG'
               WHEN expected = actual THEN 'BESTANDEN' ELSE 'FEHLER' END;
    INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status)
    VALUES (_run_id, '4 Vollstaendigkeit', t, coalesce(expected::text,'—'), actual::text,
            CASE WHEN expected IS NULL THEN NULL ELSE actual - expected END, st);

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

REVOKE EXECUTE ON FUNCTION public.gobd_restore_compare(uuid, jsonb, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_restore_compare(uuid, jsonb, text[]) TO service_role;
