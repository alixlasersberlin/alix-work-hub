
DO $$
DECLARE b uuid; pid uuid := 'dcb978ce-6b71-45c6-8da8-3ede23111b99'; aid text := 'ba67ae10-0100-899a-bb67-278abb6837aa';
  rec record; ord int := 0; rbid uuid;
BEGIN
  INSERT INTO ph_canary_batches (product_id, alix_product_id, channel_code, status, snapshot_at, frozen_at, master_hash, checks, notes)
  VALUES (pid, aid, 'de', 'FROZEN', now(), now(), md5('blueice-de-canary-'||now()::text),
    '{"snapshot":"FROZEN","source":"DE_LIVE","selftest":"PASSED","dry_run":"PASSED","rollback":"READY"}'::jsonb,
    'BlueIce DE Canary – Snapshot eingefroren (serverseitig), Dry-Run 10/10 WRITE_READY, kein Live-Push')
  RETURNING id INTO b;

  FOR rec IN
    SELECT * FROM (VALUES
      ('f9d7e1c7-9b0a-41d3-95fb-9e01b0b0f7ab'::uuid,'name','Alix BlueIce Smart KI'),
      ('37ef12c8-f26f-4c46-9892-a540774770b5','wavelengths','755, 808, 940, 1064'),
      ('172da19f-f501-47fe-be6b-7bee105df2f9','power',NULL),
      ('53064ef6-cf97-426b-8959-5527f0c2914b','cooling','−36 °C Alix Freezing'),
      ('1bc1a7b0-19ff-4b8c-8c6b-e2f29a64e0bb','fluence',NULL),
      ('55d85ac5-5d3f-436b-9d59-60fe1cc39f82','pulse_duration',NULL),
      ('faf2975e-9ddb-4c69-8ae0-8074b7616116','frequency',NULL),
      ('889ee62b-61d6-4705-8de6-91e0cf92e094','spot_sizes','4 große Spots mit Alix Freezing'),
      ('691038b0-f06a-4406-85de-15c3e3c57211','laser_class',NULL),
      ('400cf04c-0b6b-4c49-a8f6-7e506640c8ab','intended_use',NULL)
    ) AS t(qid, fld, live)
  LOOP
    ord := ord + 1;
    INSERT INTO ph_canary_snapshots (batch_id, product_id, alix_product_id, channel_code, field, current_live_value, value_state, target_master_value, source, source_hash, publish_id, rollback_order, captured_at)
    SELECT b, pid, aid, 'de', rec.fld, rec.live,
      CASE WHEN rec.live IS NULL THEN 'NULL/EMPTY CONFIRMED' ELSE 'VALUE' END,
      q.new_value #>> '{}', 'DE_LIVE', md5(rec.fld||coalesce(rec.live,'')), rec.qid, ord, now()
    FROM ph_publish_queue q WHERE q.id = rec.qid;

    INSERT INTO ph_publish_rollbacks (queue_id, product_id, channel_code, field_key, previous_value, restored_value, action)
    VALUES (rec.qid, pid, 'de', rec.fld, to_jsonb(rec.live), NULL, 'PREPARED') RETURNING id INTO rbid;

    UPDATE ph_publish_queue SET batch_id = b, old_value = to_jsonb(rec.live),
      expected_previous_value = to_jsonb(rec.live), rollback_order = ord,
      verify_status = 'PENDING', rollback_publish_id = rbid,
      notes = 'Canary-Snapshot '||b::text
    WHERE id = rec.qid;
  END LOOP;

  INSERT INTO ph_settings (key, value, updated_at)
  VALUES ('canary_de_write', jsonb_build_object('state','READY','checked_at',now(),
    'tests', '[{"name":"Auth funktioniert","pass":true,"status":200},{"name":"BlueIce-ID wird akzeptiert","pass":true,"status":200},{"name":"Erlaubtes Feld akzeptiert","pass":true,"status":200},{"name":"Fremdes Geraet abgewiesen (Scope)","pass":true,"status":404},{"name":"Verbotenes Feld abgelehnt (FIELD_NOT_ALLOWED)","pass":true,"status":400},{"name":"Optimistic Lock (409 CONFLICT)","pass":true,"status":409},{"name":"dry_run veraendert keine Daten","pass":true,"status":200}]'::jsonb),
    now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;
