DO $migration$
DECLARE v_definition text; v_old text := $$v_ref, 'Bankzuordnung FIBU LIGHT · Transaktion ' || p_transaction_id::text, false)$$; v_new text := $$v_ref, jsonb_build_object(
        'evidence', 'Bankzuordnung FIBU LIGHT · Transaktion ' || v_tx.id::text || ' · Referenz ' || v_ref,
        'request_id', md5('fibu-light-bank:' || v_tx.id::text || ':' || v_inv.id::text)::uuid,
        'note', 'Bankzuordnung FIBU LIGHT · Transaktion ' || v_tx.id::text
      )::text, false)$$;
BEGIN
  v_definition := pg_get_functiondef('public.fibu_light_bank_confirm(uuid,jsonb,text,text)'::regprocedure);
  IF strpos(v_definition,v_old)=0 THEN RAISE EXCEPTION 'Bankzuordnung entspricht nicht der geprüften Definition'; END IF;
  EXECUTE replace(v_definition,v_old,v_new);
END $migration$;