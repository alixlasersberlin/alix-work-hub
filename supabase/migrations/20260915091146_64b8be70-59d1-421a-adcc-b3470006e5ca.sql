
CREATE OR REPLACE FUNCTION public.gobd_restore_content_index_chunk(
  _table text, _after text DEFAULT NULL, _limit integer DEFAULT 250
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_last text; v_cnt integer := 0;
BEGIN
  PERFORM public.gobd_restore_guard();
  PERFORM public.gobd_restore_rid_ensure();
  PERFORM set_config('statement_timeout', '55s', true);
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='gobd_restore' AND table_name=_table) THEN
    RETURN jsonb_build_object('done', true, 'missing', true, 'inserted', 0);
  END IF;
  IF _after IS NULL THEN
    DELETE FROM gobd_restore.__rid WHERE table_name = _table;
  END IF;

  EXECUTE format($q$
    WITH src AS (
      SELECT x.ctid AS c, to_jsonb(x) AS r
      FROM gobd_restore.%I x
      WHERE (%L::text IS NULL OR x.ctid > %L::tid)
      ORDER BY x.ctid
      LIMIT %s
    ), keyed AS (
      SELECT s.c, s.r, public.gobd_restore_rowid(s.r, %L) AS rid
      FROM src s
    ), ins AS (
      INSERT INTO gobd_restore.__rid(table_name, row_id, full_hash)
      SELECT %L, k.rid,
             CASE WHEN f.key_list IS NULL THEN NULL
                  ELSE public.gobd_restore_hash(k.r, f.key_list) END
      FROM keyed k
      LEFT JOIN gobd_restore.__fp f
        ON f.table_name = %L AND f.row_id = k.rid
      ON CONFLICT (table_name, row_id) DO UPDATE SET full_hash = excluded.full_hash
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM ins), (SELECT max(c)::text FROM src)
  $q$, _table, _after, _after, _limit, _table, _table, _table)
  INTO v_cnt, v_last;

  RETURN jsonb_build_object('done', v_cnt = 0, 'inserted', v_cnt, 'cursor', v_last);
END; $fn$;

REVOKE EXECUTE ON FUNCTION public.gobd_restore_content_index_chunk(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_restore_content_index_chunk(text, text, integer) TO service_role;
