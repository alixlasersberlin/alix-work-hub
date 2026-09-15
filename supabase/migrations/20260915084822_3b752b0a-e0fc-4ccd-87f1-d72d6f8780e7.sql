
CREATE OR REPLACE FUNCTION public.gobd_restore_content_finish(_run_id uuid, _table text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_total bigint; v_bad bigint;
BEGIN
  PERFORM public.gobd_restore_guard();
  PERFORM set_config('statement_timeout', '55s', true);

  SELECT count(*) INTO v_total FROM gobd_restore.__rid r WHERE r.table_name = _table;
  IF v_total = 0 THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  SELECT count(*) INTO v_bad
  FROM gobd_restore.__rid r
  LEFT JOIN gobd_restore.__fp f
    ON f.table_name = r.table_name AND f.row_id = r.row_id
  WHERE r.table_name = _table
    AND (f.row_id IS NULL OR f.full_hash IS DISTINCT FROM r.full_hash);

  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status, details)
  VALUES (_run_id, '6 Inhaltsgleichheit', _table, '0 inhaltliche Abweichungen',
          v_bad::text || ' von ' || v_total::text || ' Datensaetzen abweichend', v_bad,
          CASE WHEN v_bad = 0 THEN 'BESTANDEN' ELSE 'FEHLER' END,
          jsonb_build_object('verfahren','md5 je Datensatz, paketweise Pruefung (max. 250 Datensaetze je Paket)'));

  RETURN jsonb_build_object('total', v_total, 'bad', v_bad);
END; $fn$;

REVOKE EXECUTE ON FUNCTION public.gobd_restore_content_finish(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_restore_content_finish(uuid, text) TO service_role;
