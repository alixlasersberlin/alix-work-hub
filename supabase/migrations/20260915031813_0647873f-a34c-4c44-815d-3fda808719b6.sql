
CREATE OR REPLACE FUNCTION public.gobd_restore_load(_run_id uuid, _table text, _rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; v_new boolean := false; c record; v_missing text[];
BEGIN
  PERFORM public.gobd_restore_guard();
  IF _table !~ '^[a-z0-9_]+$' THEN RAISE EXCEPTION 'Ungueltiger Tabellenname %', _table; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table) THEN
    RAISE EXCEPTION 'Tabelle public.% existiert nicht', _table;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='gobd_restore' AND table_name=_table) THEN
    EXECUTE format('CREATE TABLE gobd_restore.%I (LIKE public.%I INCLUDING DEFAULTS)', _table, _table);
    -- Aeltere Sicherungen kennen spaeter ergaenzte Pflichtfelder nicht:
    -- in der isolierten Testumgebung Pflichtvorgaben loesen und Abweichung protokollieren.
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

REVOKE EXECUTE ON FUNCTION public.gobd_restore_load(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gobd_restore_load(uuid, text, jsonb) TO service_role;
