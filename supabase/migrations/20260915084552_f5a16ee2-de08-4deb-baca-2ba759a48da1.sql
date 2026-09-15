
-- Hilfstabelle fuer paketweise Pruefsummen der wiederhergestellten Daten (isolierte Testumgebung)
CREATE TABLE IF NOT EXISTS gobd_restore.__rid (
  table_name text NOT NULL,
  row_id text NOT NULL,
  full_hash text,
  PRIMARY KEY (table_name, row_id)
);
CREATE INDEX IF NOT EXISTS rid_table_hash_idx ON gobd_restore.__rid (table_name, row_id, full_hash);

-- Paketweise Indizierung: max. _limit Datensaetze je Aufruf, Cursor ueber ctid (kein OFFSET)
CREATE OR REPLACE FUNCTION public.gobd_restore_content_index_chunk(
  _table text, _after text DEFAULT NULL, _limit integer DEFAULT 250
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_last text; v_cnt integer := 0; v_keys text[];
BEGIN
  PERFORM public.gobd_restore_guard();
  PERFORM set_config('statement_timeout', '55s', true);
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='gobd_restore' AND table_name=_table) THEN
    RETURN jsonb_build_object('done', true, 'missing', true, 'inserted', 0);
  END IF;
  v_keys := public.gobd_restore_idfields(_table);

  EXECUTE format($q$
    WITH src AS (
      SELECT x.ctid AS c, to_jsonb(x) AS r
      FROM gobd_restore.%I x
      WHERE (%L::text IS NULL OR x.ctid > %L::tid)
      ORDER BY x.ctid
      LIMIT %s
    ), ins AS (
      INSERT INTO gobd_restore.__rid(table_name, row_id, full_hash)
      SELECT %L, public.gobd_restore_rowid(r, %L), public.gobd_restore_hash(r, %L::text[])
      FROM src
      ON CONFLICT (table_name, row_id) DO UPDATE SET full_hash = excluded.full_hash
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM ins), (SELECT max(c)::text FROM src)
  $q$, _table, _after, _after, _limit, _table, _table, v_keys)
  INTO v_cnt, v_last;

  RETURN jsonb_build_object('done', v_cnt = 0, 'inserted', v_cnt, 'cursor', v_last);
END; $fn$;

-- Abschluss je Tabelle: Vergleich ueber indizierte Pruefsummen, kein Vollscan der Rohdaten
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
  WHERE f.row_id IS NULL OR f.full_hash IS DISTINCT FROM r.full_hash;

  INSERT INTO public.gobd_restore_checks(run_id, category, check_name, expected, actual, diff, status, details)
  VALUES (_run_id, '6 Inhaltsgleichheit', _table, '0 inhaltliche Abweichungen',
          v_bad::text || ' von ' || v_total::text || ' Datensaetzen abweichend', v_bad,
          CASE WHEN v_bad = 0 THEN 'BESTANDEN' ELSE 'FEHLER' END,
          jsonb_build_object('verfahren','md5 je Datensatz, paketweise Pruefung (max. 250 Datensaetze je Paket)'));

  RETURN jsonb_build_object('total', v_total, 'bad', v_bad);
END; $fn$;

GRANT EXECUTE ON FUNCTION public.gobd_restore_content_index_chunk(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gobd_restore_content_finish(uuid, text) TO service_role;
